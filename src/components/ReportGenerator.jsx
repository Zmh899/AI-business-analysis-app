import { useCallback, useState } from 'react'
import html2pdf from 'html2pdf.js'

/**
 * html2canvas 1.x 无法解析 Tailwind v4 中的 oklab/oklch。
 * 策略：在 onclone 里先用 getComputedStyle 把布局/颜色内联到克隆节点，再移除全部外链与 <style>，
 * 避免解析 oklab；不再移除 class，以免高度链断裂导致「空白 PDF」。
 */
const PDF_SAFE_CSS = `
[data-report-print-host] svg, [data-report-print-host] svg * { vector-effect: non-scaling-stroke; }
[data-report-print-host] .recharts-wrapper { width:100% !important; min-height: 280px !important; }
`

const PROPS_TO_INLINE = [
  'display',
  'flex-direction',
  'flex-wrap',
  'align-items',
  'justify-content',
  'align-content',
  'gap',
  'row-gap',
  'column-gap',
  'padding',
  'padding-top',
  'padding-right',
  'padding-bottom',
  'padding-left',
  'margin',
  'margin-top',
  'margin-right',
  'margin-bottom',
  'margin-left',
  'width',
  'min-width',
  'max-width',
  'height',
  'min-height',
  'max-height',
  'font-size',
  'font-weight',
  'line-height',
  'letter-spacing',
  'text-align',
  'color',
  'background-color',
  'border-top-width',
  'border-right-width',
  'border-bottom-width',
  'border-left-width',
  'border-top-style',
  'border-right-style',
  'border-bottom-style',
  'border-left-style',
  'border-top-color',
  'border-right-color',
  'border-bottom-color',
  'border-left-color',
  'border-radius',
  'box-shadow',
  'overflow',
  'overflow-x',
  'overflow-y',
  'opacity',
  'visibility',
  'white-space',
  'grid-template-columns',
  'grid-template-rows',
]

function mergeStyleAttr(el, cssText) {
  const prev = el.getAttribute('style')
  el.setAttribute('style', [cssText, prev].filter(Boolean).join(';'))
}

function sanitizeCssValue(value) {
  if (!value || typeof value !== 'string') return value
  if (/oklab|oklch|color-mix|lab\(|lch\(/i.test(value)) return 'rgb(51, 65, 85)'
  return value
}

function inlineComputedStylesForPdf(root) {
  if (!root) return
  const win = root.ownerDocument?.defaultView
  if (!win) return

  const nodes = [root, ...root.querySelectorAll('*')]
  for (const el of nodes) {
    if (el.tagName === 'SCRIPT' || el.tagName === 'STYLE' || el.tagName === 'LINK') continue
    if (el.tagName === 'SVG' || el.closest('svg')) continue

    let cs
    try {
      cs = win.getComputedStyle(el)
    } catch {
      continue
    }

    const parts = []
    for (const prop of PROPS_TO_INLINE) {
      const val = sanitizeCssValue(cs.getPropertyValue(prop))
      if (!val) continue
      if (val === 'none' && !prop.includes('border') && prop !== 'display') continue
      if ((prop === 'height' || prop === 'min-height') && (val === '0px' || val === 'auto')) continue
      parts.push(`${prop}:${val}`)
    }
    if (parts.length) mergeStyleAttr(el, parts.join(';'))
  }

  root.querySelectorAll('.recharts-responsive-container').forEach((el) => {
    mergeStyleAttr(el, 'width:100%;min-height:320px;height:320px;display:block')
  })
}

function stripStylesheetsFromClone(documentClone) {
  if (!documentClone) return
  documentClone.querySelectorAll('link[rel="stylesheet"]').forEach((el) => el.remove())
  documentClone.querySelectorAll('style').forEach((el) => el.remove())
}

function sanitizeCloneForHtml2Canvas(documentClone, clonedRoot) {
  if (!clonedRoot) return

  // 1. 在仍有关联样式表时，把最终计算样式写入内联，避免后续删表后布局塌缩
  inlineComputedStylesForPdf(clonedRoot)

  // 2. 去掉会触发 html2canvas 解析 oklab 的样式来源
  stripStylesheetsFromClone(documentClone)

  // 3. 仅补充 SVG/Recharts 相关兜底
  const safe = documentClone?.createElement('style')
  if (safe && documentClone) {
    safe.setAttribute('data-html2pdf-safe', 'true')
    safe.textContent = PDF_SAFE_CSS
    ;(documentClone.head || documentClone.documentElement).appendChild(safe)
  }
}

function getHtml2CanvasOptions(hostWidth) {
  return {
    scale: 2,
    useCORS: true,
    logging: false,
    backgroundColor: '#ffffff',
    scrollY: 0,
    windowWidth: hostWidth,
    onclone: sanitizeCloneForHtml2Canvas,
  }
}

function pad2(n) {
  return String(n).padStart(2, '0')
}

function formatReportDate(d = new Date()) {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`
}

function formatReportDateTime(d = new Date()) {
  return `${formatReportDate(d)} ${pad2(d.getHours())}:${pad2(d.getMinutes())}`
}

const SECTIONS = [
  { id: 'report-section-dashboard', title: '一、经营指标与趋势' },
  { id: 'report-section-ai-answer', title: '二、AI 经营问答（最新回答）' },
  { id: 'report-section-anomaly', title: '三、异常检测与归因' },
]

function buildPrintHost() {
  const host = document.createElement('div')
  host.setAttribute('data-report-print-host', 'true')
  host.style.boxSizing = 'border-box'
  // 勿用大幅负 left：html2pdf 会用 deepClone 把节点放进全屏 overflow:hidden 的 overlay，
  // 负偏移会把整块内容裁到视窗外，导出的 PDF 为空白。
  host.style.position = 'relative'
  host.style.left = '0'
  host.style.top = '0'
  host.style.width = '794px'
  host.style.maxWidth = '100%'
  host.style.minHeight = '200px'
  host.style.padding = '28px 24px 32px'
  host.style.background = '#ffffff'
  host.style.color = '#0f172a'
  host.style.fontFamily = 'system-ui, -apple-system, "Segoe UI", Roboto, "PingFang SC", "Microsoft YaHei", sans-serif'
  host.style.fontSize = '14px'
  host.style.lineHeight = '1.55'
  return host
}

/** 导出前罩一层 opacity:0，避免 host 在 body 上短暂露在视口内；html2pdf 只克隆 host，不会带上本层透明度。 */
function buildPrintVeil() {
  const veil = document.createElement('div')
  veil.setAttribute('aria-hidden', 'true')
  veil.style.cssText = [
    'position:fixed',
    'inset:0',
    'pointer-events:none',
    'z-index:2147482647',
    'opacity:0',
    'overflow:hidden',
  ].join(';')
  return veil
}

function appendHeading(root, text) {
  const h = document.createElement('h2')
  h.textContent = text
  h.style.margin = '0 0 12px'
  h.style.fontSize = '16px'
  h.style.fontWeight = '700'
  h.style.color = '#0f172a'
  h.style.borderBottom = '1px solid #e2e8f0'
  h.style.paddingBottom = '6px'
  h.style.breakInside = 'avoid'
  h.style.pageBreakInside = 'avoid'
  root.appendChild(h)
}

function appendMissing(root, title) {
  const p = document.createElement('p')
  p.textContent = `${title}：未找到对应内容区域（#report-section-*），请检查页面结构。`
  p.style.margin = '0 0 20px'
  p.style.color = '#64748b'
  p.style.fontSize = '13px'
  root.appendChild(p)
}

function appendSpacer(root) {
  const s = document.createElement('div')
  s.style.height = '20px'
  root.appendChild(s)
}

/**
 * 克隆 #report-section-* 节点到离屏容器后使用 html2pdf.js 导出；PDF 失败时尝试 html2canvas 下载 PNG。
 */
export default function ReportGenerator() {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const handleGenerate = useCallback(async () => {
    setError('')
    setBusy(true)

    const dateStr = formatReportDate()
    const filename = `经营报告-${dateStr}.pdf`

    const veil = buildPrintVeil()
    const host = buildPrintHost()
    veil.appendChild(host)
    document.body.appendChild(veil)

    try {
      const title = document.createElement('div')
      title.style.marginBottom = '18px'
      title.style.breakInside = 'avoid'
      title.innerHTML = `<div style="font-size:20px;font-weight:800;letter-spacing:-0.02em;">经营分析报告</div>
        <div style="margin-top:6px;font-size:12px;color:#64748b;">导出时间：${formatReportDateTime()}</div>`
      host.appendChild(title)

      for (const { id, title: sectionTitle } of SECTIONS) {
        appendHeading(host, sectionTitle)
        const src = document.getElementById(id)
        if (!src) {
          appendMissing(host, sectionTitle)
          appendSpacer(host)
          continue
        }
        const box = document.createElement('div')
        box.style.marginBottom = '24px'
        box.style.breakInside = 'auto'
        box.style.pageBreakInside = 'auto'
        box.style.border = '1px solid #e2e8f0'
        box.style.borderRadius = '12px'
        box.style.padding = '12px'
        box.style.background = '#fafafa'
        const clone = src.cloneNode(true)
        clone.id = `${id}-clone`
        box.appendChild(clone)
        host.appendChild(box)
        appendSpacer(host)
      }

      await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)))
      await new Promise((r) => setTimeout(r, 200))

      const opt = {
        margin: [8, 8, 10, 8],
        filename,
        image: { type: 'jpeg', quality: 0.95 },
        html2canvas: getHtml2CanvasOptions(host.scrollWidth),
        jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' },
        pagebreak: { mode: ['css', 'legacy'], avoid: ['.report-pdf-avoid-break'] },
      }

      await html2pdf().set(opt).from(host).save()
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      let pngOk = false
      try {
        const { default: html2canvas } = await import('html2canvas')
        const canvas = await html2canvas(host, getHtml2CanvasOptions(host.scrollWidth))
        const link = document.createElement('a')
        link.download = `经营报告-${dateStr}-备用截图.png`
        link.href = canvas.toDataURL('image/png', 0.92)
        link.rel = 'noopener'
        document.body.appendChild(link)
        link.click()
        link.remove()
        pngOk = true
      } catch {
        pngOk = false
      }
      setError(
        [
          msg ? `${msg}。` : '导出失败。',
          '若图表区域导出异常，可尝试缩小浏览器缩放后重试。',
          pngOk ? '已额外下载 PNG 备用截图（文件名含「备用截图」）。' : '',
        ]
          .filter(Boolean)
          .join(''),
      )
      console.error(e)
    } finally {
      veil.remove()
      setBusy(false)
    }
  }, [])

  return (
    <section className="rounded-2xl border border-neutral-200 bg-white p-5 shadow-md shadow-neutral-900/5 ring-1 ring-neutral-900/5 sm:p-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-lg font-semibold tracking-tight text-neutral-900">经营报告导出</h2>
          <p className="mt-0.5 text-sm text-neutral-500">
            汇总「经营指标」「AI 最新回答」「异常检测」三块区域导出为 PDF；任意页签下均可使用。若 PDF 失败，会自动尝试下载 PNG 备用截图。
          </p>
        </div>
        <button
          type="button"
          onClick={() => void handleGenerate()}
          disabled={busy}
          className="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl bg-neutral-900 px-5 py-2.5 text-sm font-medium text-white shadow-sm transition hover:bg-neutral-800 disabled:pointer-events-none disabled:opacity-55"
        >
          {busy ? (
            <>
              <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none" aria-hidden>
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                />
              </svg>
              生成中…
            </>
          ) : (
            '生成经营报告'
          )}
        </button>
      </div>
      {error ? (
        <p className="mt-3 text-sm text-red-600" role="alert">
          {error}
        </p>
      ) : null}
    </section>
  )
}
