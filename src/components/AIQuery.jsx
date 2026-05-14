import { useCallback, useEffect, useMemo, useState } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { useAppData } from '../context/AppDataContext.jsx'

function toNum(value) {
  if (value == null || value === '') return 0
  const n = Number(String(value).replace(/,/g, '').trim())
  return Number.isFinite(n) ? n : 0
}

function formatMoney(n) {
  return n.toLocaleString('zh-CN', { minimumFractionDigits: 0, maximumFractionDigits: 2 })
}

function buildAnalysisContext(data) {
  const rows = Array.isArray(data) ? data : []
  if (!rows.length) {
    return {
      summaryText: '（当前未上传数据或表格为空）',
      stats: {
        rowCount: 0,
        gmv: 0,
        orders: 0,
        adSpend: 0,
        cost: 0,
        visits: 0,
        dateMin: null,
        dateMax: null,
        hasVisits: false,
        hasCost: false,
      },
    }
  }

  const dateStrs = rows
    .map((r) => r['日期'])
    .filter((v) => v != null && String(v).trim() !== '')
    .map((v) => String(v).trim())
  const sortedDates = [...dateStrs].sort((a, b) => {
    const ta = Date.parse(a)
    const tb = Date.parse(b)
    if (Number.isFinite(ta) && Number.isFinite(tb) && ta !== tb) return ta - tb
    return a.localeCompare(b, 'zh-CN')
  })
  const dateMin = sortedDates[0] ?? null
  const dateMax = sortedDates[sortedDates.length - 1] ?? null

  const hasVisits = Object.prototype.hasOwnProperty.call(rows[0], '访问量')
  const hasCost = Object.prototype.hasOwnProperty.call(rows[0], '成本')

  let gmv = 0
  let orders = 0
  let adSpend = 0
  let cost = 0
  let visits = 0
  for (const row of rows) {
    gmv += toNum(row['销售额'])
    orders += toNum(row['订单数'])
    adSpend += toNum(row['广告费'])
    if (hasCost) cost += toNum(row['成本'])
    if (hasVisits) visits += toNum(row['访问量'])
  }

  const avgOrder = orders > 0 ? gmv / orders : null
  const conv =
    hasVisits && visits > 0 ? orders / visits : hasVisits ? null : 0.125

  const lines = [
    `- **数据行数**：${rows.length}`,
    `- **日期范围**：${dateMin && dateMax ? `${dateMin} ~ ${dateMax}` : '无法从「日期」列解析'}`,
    `- **GMV（销售额合计）**：￥${formatMoney(gmv)}`,
    `- **订单总量**：${orders.toLocaleString('zh-CN')}`,
    avgOrder != null ? `- **客单价（估算）**：￥${formatMoney(avgOrder)}` : `- **客单价**：—（无订单）`,
    `- **广告费合计**：￥${formatMoney(adSpend)}`,
    hasCost ? `- **成本合计**：￥${formatMoney(cost)}` : null,
    hasVisits
      ? `- **访问量合计**：${visits.toLocaleString('zh-CN')}；**转化率（订单/访问）**：${
          conv == null ? '—' : `${(conv * 100).toFixed(2)}%`
        }`
      : `- **访问量**：数据表中无「访问量」列；转化率在分析中可按 **12.5%（模拟）** 参考`,
  ].filter(Boolean)

  return {
    summaryText: lines.join('\n'),
    stats: {
      rowCount: rows.length,
      gmv,
      orders,
      adSpend,
      cost,
      visits,
      dateMin,
      dateMax,
      hasVisits,
      hasCost,
    },
  }
}

function generateMockAnswer(question, stats) {
  const q = question.trim()
  const down = /下降|减少|降低|下滑|变差|萎缩|回落/.test(q)
  const up = /增长|上升|提升|变好|回暖|放量/.test(q)
  const adQ = /广告|投放|ROI|获客/.test(q)
  const orderQ = /订单|转化|流量|访问/.test(q)

  const head =
    '### 模拟回答（未配置 `VITE_OPENAI_KEY`）\n\n> 以下为前端规则生成的示例结论，**不等同于 OpenAI 模型输出**。部署时在环境变量中配置 `VITE_OPENAI_KEY` 即可调用真实接口。\n\n'

  if (!stats.rowCount) {
    return (
      head +
      '当前没有可用的表格数据。请先上传包含 **日期**、**销售额**、**订单数** 等字段的经营数据，再提问可获得更贴近业务的分析。'
    )
  }

  const snapshot = [
    '',
    '#### 数据快照',
    '',
    `- 行数：**${stats.rowCount}**`,
    `- 日期范围：**${stats.dateMin ?? '—'}** ~ **${stats.dateMax ?? '—'}**`,
    `- GMV：**￥${formatMoney(stats.gmv)}**；订单总量：**${stats.orders.toLocaleString('zh-CN')}**`,
    `- 广告费合计：**￥${formatMoney(stats.adSpend)}**`,
    '',
    '#### 结合问题的说明',
    '',
  ].join('\n')

  const blocks = []

  if (down) {
    blocks.push(
      '- **销量走弱**：常见原因包括 **节假日与工作日结构变化**（长假前后、大促后回落）、**需求季节性**、以及 **竞品促销分流**。',
      '- **广告与曝光**：若近期 **广告投放减少** 或预算向低效人群倾斜，**订单量** 往往同步承压；可对比广告费与订单的趋势拐点。',
      '- **成本与毛利压力**：若 **成本** 上行而售价未调，实际利润空间变窄，也可能迫使投放收缩，形成负向循环。',
    )
  } else if (up) {
    blocks.push(
      '- **增长动能**：可能与 **品类需求回暖**、**投放效率提升**、或 **新品/爆款拉动** 有关。',
      '- 建议核对 **GMV 与订单** 是否同向改善，避免「单价提升、单量下滑」的结构性变化被整体数字掩盖。',
    )
  } else {
    blocks.push(
      '- 在缺少更多业务背景时，可从 **GMV = 客单价 × 订单量** 拆解波动来源，并对比 **广告费** 与订单是否同向变化。',
    )
  }

  if (adQ) {
    blocks.push(
      '- **广告相关**：若 **ROI = (GMV − 广告费) / 广告费** 走弱，优先排查投放人群、素材衰退与落地页转化；同时关注是否存在「以价换量」导致 GMV 虚高、利润变薄。',
    )
  }
  if (orderQ) {
    blocks.push(
      '- **订单与转化**：若存在 **访问量** 字段，可关注「订单 / 访问」是否稳定；若无访问量字段，可用行业常用的 **12.5%** 作为粗略基准做敏感性分析（仅作参考）。',
    )
  }

  if (!blocks.length) {
    blocks.push(
      '- 销量波动往往同时受 **节假日**、**促销节奏**、**广告投放** 与 **供应链/库存** 等因素影响；建议把问题聚焦到具体时间段与渠道，便于定位主因。',
    )
  }

  return head + blocks.map((b) => `${b}\n`).join('\n') + snapshot
}

export const aiMarkdownComponents = {
  h1: ({ children, ...props }) => (
    <h1 className="mb-3 text-xl font-semibold text-neutral-900" {...props}>
      {children}
    </h1>
  ),
  h2: ({ children, ...props }) => (
    <h2 className="mb-2 mt-6 text-lg font-semibold text-neutral-900" {...props}>
      {children}
    </h2>
  ),
  h3: ({ children, ...props }) => (
    <h3 className="mb-2 mt-5 text-base font-semibold text-neutral-900" {...props}>
      {children}
    </h3>
  ),
  h4: ({ children, ...props }) => (
    <h4 className="mb-2 mt-4 text-sm font-semibold text-neutral-800" {...props}>
      {children}
    </h4>
  ),
  p: ({ children, ...props }) => (
    <p className="mb-3 text-sm leading-relaxed text-neutral-700" {...props}>
      {children}
    </p>
  ),
  ul: ({ children, ...props }) => (
    <ul className="mb-3 list-disc space-y-1 pl-5 text-sm text-neutral-700" {...props}>
      {children}
    </ul>
  ),
  ol: ({ children, ...props }) => (
    <ol className="mb-3 list-decimal space-y-1 pl-5 text-sm text-neutral-700" {...props}>
      {children}
    </ol>
  ),
  li: ({ children, ...props }) => (
    <li className="leading-relaxed" {...props}>
      {children}
    </li>
  ),
  strong: ({ children, ...props }) => (
    <strong className="font-semibold text-neutral-900" {...props}>
      {children}
    </strong>
  ),
  a: ({ children, ...props }) => (
    <a className="font-medium text-indigo-600 underline-offset-2 hover:underline" {...props}>
      {children}
    </a>
  ),
  blockquote: ({ children, ...props }) => (
    <blockquote
      className="mb-3 border-l-4 border-indigo-200 bg-indigo-50/60 py-2 pl-4 text-sm text-neutral-700"
      {...props}
    >
      {children}
    </blockquote>
  ),
  code: ({ inline, className, children, ...props }) => {
    if (inline) {
      return (
        <code
          className="rounded bg-neutral-200/80 px-1.5 py-0.5 font-mono text-[0.8rem] text-neutral-800"
          {...props}
        >
          {children}
        </code>
      )
    }
    return (
      <code
        className={`block w-full overflow-x-auto rounded-lg bg-neutral-900 p-3 text-xs text-neutral-100 ${className ?? ''}`}
        {...props}
      >
        {children}
      </code>
    )
  },
  pre: ({ children, ...props }) => (
    <pre className="mb-3 overflow-x-auto rounded-lg bg-neutral-900 p-0" {...props}>
      {children}
    </pre>
  ),
  table: ({ children, ...props }) => (
    <div className="mb-3 overflow-x-auto rounded-lg border border-neutral-200">
      <table className="min-w-full border-collapse text-left text-sm" {...props}>
        {children}
      </table>
    </div>
  ),
  th: ({ children, ...props }) => (
    <th className="border-b border-neutral-200 bg-neutral-50 px-3 py-2 font-semibold text-neutral-800" {...props}>
      {children}
    </th>
  ),
  td: ({ children, ...props }) => (
    <td className="border-b border-neutral-100 px-3 py-2 text-neutral-700" {...props}>
      {children}
    </td>
  ),
}

export default function AIQuery() {
  const { tableData, aiAnswer, setAiAnswer, hasData } = useAppData()
  const [question, setQuestion] = useState('')
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!hasData) setQuestion('')
  }, [hasData])

  const { summaryText, stats } = useMemo(() => buildAnalysisContext(tableData), [tableData])

  const runQuery = useCallback(async () => {
    const q = question.trim()
    if (!q) return

    const proxyUrl = import.meta.env.VITE_OPENAI_PROXY_URL?.trim()
    const apiKey = import.meta.env.VITE_OPENAI_KEY?.trim()
    const directBase = (import.meta.env.VITE_OPENAI_BASE_URL || 'https://api.openai.com/v1').replace(/\/$/, '')
    const model = import.meta.env.VITE_OPENAI_MODEL?.trim() || 'gpt-4o-mini'

    const useProxy = Boolean(proxyUrl)
    const useDirectKey = Boolean(apiKey)

    setLoading(true)
    setAiAnswer('')

    const delay = (ms) => new Promise((r) => setTimeout(r, ms))

    try {
      if (!useProxy && !useDirectKey) {
        await delay(350)
        setAiAnswer(generateMockAnswer(q, stats))
        return
      }

      const userContent = [
        '你是一名中文「经营分析」助手，请结合下方**数据摘要**回答用户问题；如信息不足请明确说明假设与局限。',
        '',
        '【数据摘要】',
        summaryText,
        '',
        '【用户问题】',
        q,
      ].join('\n')

      const body = JSON.stringify({
        model,
        temperature: 0.35,
        messages: [
          {
            role: 'system',
            content:
              '你是资深经营分析师。输出使用 GitHub Flavored Markdown（标题、列表、加粗等），语言为简体中文，条理清晰，避免编造摘要中不存在的数据字段。',
          },
          { role: 'user', content: userContent },
        ],
      })

      const url = useProxy
        ? `${proxyUrl.replace(/\/$/, '')}/v1/chat/completions`
        : `${directBase}/chat/completions`

      const headers = { 'Content-Type': 'application/json' }
      if (!useProxy) {
        headers.Authorization = `Bearer ${apiKey}`
      }

      const res = await fetch(url, {
        method: 'POST',
        headers,
        body,
      })

      const payload = await res.json().catch(() => ({}))
      if (!res.ok) {
        const msg = payload?.error?.message || res.statusText || '请求失败'
        const hint = useProxy
          ? '> 请确认后端已设置 `OPENAI_API_KEY`，且 `CORS_ORIGINS` 包含当前前端来源。'
          : '> 浏览器直连可能受 **CORS** 限制；推荐改用 `VITE_OPENAI_PROXY_URL` 走自建代理。'
        setAiAnswer(`### 调用失败（HTTP ${res.status}）\n\n${msg}\n\n${hint}`)
        return
      }

      const text = payload?.choices?.[0]?.message?.content
      if (!text) {
        setAiAnswer('### 未收到有效回复\n\n接口返回结构异常，请稍后重试。')
        return
      }
      setAiAnswer(text)
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      setAiAnswer(
        `### 网络错误\n\n${msg}\n\n请确认代理服务已启动且地址与 \`VITE_OPENAI_PROXY_URL\` 一致；若使用直连模式，请检查网络与 CORS。`,
      )
    } finally {
      setLoading(false)
    }
  }, [question, stats, summaryText, setAiAnswer])

  return (
    <section className="space-y-5">
      <div>
        <h2 className="text-lg font-semibold tracking-tight text-neutral-900">AI 经营问答</h2>
        <p className="mt-0.5 text-sm text-neutral-500">
          推荐配置自建后端代理（<code className="rounded bg-neutral-200 px-1 py-0.5 text-xs">VITE_OPENAI_PROXY_URL</code>
          ），密钥仅存服务端；未配置代理且无前端 Key 时使用本地模拟回答。
        </p>
      </div>

      <div className="rounded-2xl border border-neutral-100 bg-white p-5 shadow-md shadow-neutral-900/5 ring-1 ring-neutral-900/5 sm:p-6">
        <label htmlFor="ai-query-input" className="sr-only">
          输入经营分析问题
        </label>
        <textarea
          id="ai-query-input"
          rows={3}
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          disabled={loading}
          placeholder="例如：最近销量下降的主要原因可能有哪些？"
          className="w-full resize-y rounded-xl border border-neutral-200 bg-neutral-50/50 px-4 py-3 text-sm text-neutral-900 outline-none ring-indigo-500/0 transition placeholder:text-neutral-400 focus:border-indigo-300 focus:bg-white focus:ring-4 disabled:opacity-60"
        />
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={() => void runQuery()}
            disabled={loading || !question.trim()}
            className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-5 py-2.5 text-sm font-medium text-white shadow-sm transition hover:bg-indigo-700 disabled:pointer-events-none disabled:opacity-50"
          >
            {loading ? (
              <>
                <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none" aria-hidden>
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                  />
                </svg>
                分析中…
              </>
            ) : (
              '发送'
            )}
          </button>
          {import.meta.env.VITE_OPENAI_PROXY_URL?.trim() ? (
            <span className="text-xs text-emerald-600">已配置后端代理（前端不包含 API Key）</span>
          ) : import.meta.env.VITE_OPENAI_KEY ? (
            <span className="text-xs text-amber-700">直连模式：Key 会暴露在前端包中，仅建议本地调试</span>
          ) : (
            <span className="text-xs text-amber-700">未配置代理或 Key，将使用模拟回答</span>
          )}
        </div>
      </div>

      <div className="report-pdf-avoid-break rounded-2xl border border-neutral-100 bg-white p-5 shadow-md shadow-neutral-900/5 ring-1 ring-neutral-900/5 sm:p-6">
        <h3 className="mb-4 text-sm font-semibold text-neutral-800">回答</h3>
        {loading && !aiAnswer ? (
          <div className="flex items-center gap-3 text-sm text-neutral-500">
            <svg className="h-5 w-5 animate-spin text-indigo-600" viewBox="0 0 24 24" fill="none" aria-hidden>
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
              />
            </svg>
            正在生成回答…
          </div>
        ) : aiAnswer ? (
          <div className="max-w-none">
            <ReactMarkdown remarkPlugins={[remarkGfm]} components={aiMarkdownComponents}>
              {aiAnswer}
            </ReactMarkdown>
          </div>
        ) : (
          <p className="text-sm text-neutral-500">
            暂无回答。先在上方输入问题并发送后，最新结果将出现在此区域（并可被导出到报告）。
          </p>
        )}
      </div>
    </section>
  )
}
