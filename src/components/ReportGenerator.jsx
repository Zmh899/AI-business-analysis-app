import { useCallback, useState } from 'react'
import html2pdf from 'html2pdf.js'

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
  host.style.position = 'absolute'
  host.style.left = '-12000px'
  host.style.top = '0'
  host.style.width = '794px'
  host.style.minHeight = '200px'
  host.style.padding = '28px 24px 32px'
  host.style.background = '#ffffff'
  host.style.color = '#0f172a'
  host.style.fontFamily = 'system-ui, -apple-system, "Segoe UI", Roboto, "PingFang SC", "Microsoft YaHei", sans-serif'
  host.style.fontSize = '14px'
  host.style.lineHeight = '1.55'
  host.style.zIndex = '2147483000'
  return host
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

    const host = buildPrintHost()
    document.body.appendChild(host)

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

      const opt = {
        margin: [8, 8, 10, 8],
        filename,
        image: { type: 'jpeg', quality: 0.95 },
        html2canvas: {
          scale: 2,
          useCORS: true,
          logging: false,
          backgroundColor: '#ffffff',
          scrollY: 0,
          windowWidth: host.scrollWidth,
        },
        jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' },
        pagebreak: { mode: ['css', 'legacy'], avoid: ['.report-pdf-avoid-break'] },
      }

      await html2pdf().set(opt).from(host).save()
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      let pngOk = false
      try {
        const { default: html2canvas } = await import('html2canvas')
        const canvas = await html2canvas(host, {
          scale: 2,
          useCORS: true,
          backgroundColor: '#ffffff',
          logging: false,
          scrollY: 0,
          windowWidth: host.scrollWidth,
        })
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
      host.remove()
      setBusy(false)
    }
  }, [])

  return (
    <section className="rounded-2xl border border-neutral-200 bg-white p-5 shadow-md shadow-neutral-900/5 ring-1 ring-neutral-900/5 sm:p-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-lg font-semibold tracking-tight text-neutral-900">经营报告导出</h2>
          <p className="mt-0.5 text-sm text-neutral-500">
            汇总「经营指标」「AI 最新回答」「异常检测」三块区域导出为 PDF。若 PDF 失败，会自动尝试下载同版式 PNG 备用截图。
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
