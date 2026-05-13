import { useMemo } from 'react'
import { useAppData } from '../context/AppDataContext.jsx'

function toNum(value) {
  if (value == null || value === '') return 0
  const n = Number(String(value).replace(/,/g, '').trim())
  return Number.isFinite(n) ? n : 0
}

function compareDateKey(a, b) {
  const ta = Date.parse(a)
  const tb = Date.parse(b)
  if (Number.isFinite(ta) && Number.isFinite(tb) && ta !== tb) return ta - tb
  return String(a).localeCompare(String(b), 'zh-CN')
}

/** @returns {{ date: string, sales: number, orders: number }[]} */
function aggregateByDate(rows) {
  const map = new Map()
  for (const row of rows) {
    const raw = row['日期']
    const key = raw == null ? '' : String(raw).trim()
    if (!key) continue
    const cur = map.get(key) ?? { date: key, sales: 0, orders: 0 }
    cur.sales += toNum(row['销售额'])
    cur.orders += toNum(row['订单数'])
    map.set(key, cur)
  }
  return [...map.values()].sort((x, y) => compareDateKey(x.date, y.date))
}

const ATTRIBUTION_HINTS = [
  '**广告投放**：对比近 7 天与前 7 天的广告费、曝光与点击，排查是否缩量、素材衰退或人群偏移。',
  '**竞品活动**：关注同期竞品大促、降价与新品上架，评估分流与价格带压力。',
  '**节假日效应**：核对是否跨长假、调休或行业淡季；节后回落常被误判为“异常”。',
  '**履约与口径**：排查缺货、延迟发货、退款集中入账或统计口径变更导致的“假性下跌”。',
]

function detectAnomalies(data) {
  const rows = Array.isArray(data) ? data : []
  if (!rows.length) {
    return { kind: 'empty' }
  }

  const series = aggregateByDate(rows)
  if (series.length < 14) {
    return { kind: 'insufficient', dayCount: series.length }
  }

  const prev7 = series.slice(-14, -7)
  const recent7 = series.slice(-7)

  const sumSales = (arr) => arr.reduce((s, x) => s + x.sales, 0)
  const sumOrders = (arr) => arr.reduce((s, x) => s + x.orders, 0)

  const prevSales = sumSales(prev7)
  const recentSales = sumSales(recent7)
  const prevOrders = sumOrders(prev7)
  const recentOrders = sumOrders(recent7)

  const pctChange = (recent, prev) => {
    if (prev === 0) return recent === 0 ? 0 : null
    return (recent - prev) / prev
  }

  const salesMom = pctChange(recentSales, prevSales)
  const ordersMom = pctChange(recentOrders, prevOrders)

  const aovPrev = prevOrders > 0 ? prevSales / prevOrders : null
  const aovRecent = recentOrders > 0 ? recentSales / recentOrders : null
  let aovMom = null
  if (aovPrev != null && aovRecent != null && aovPrev > 0) {
    aovMom = (aovRecent - aovPrev) / aovPrev
  }

  const fmtPct = (v) =>
    v == null
      ? '—'
      : `${(v * 100).toLocaleString('zh-CN', { maximumFractionDigits: 2 })}%`

  const windowLabel = `最近 7 天（${recent7[0].date} ~ ${recent7[6].date}）对比前 7 天（${prev7[0].date} ~ ${prev7[6].date}）`

  /** @type {{ id: string, title: string, severity: 'high'|'medium', detail: string }[]} */
  const anomalies = []

  if (salesMom != null && salesMom < -0.2) {
    anomalies.push({
      id: 'sales',
      title: '销售额异常下降',
      severity: 'high',
      detail: `销售额环比 **${fmtPct(salesMom)}**（阈值：下降超过 20%）。${windowLabel}。`,
    })
  }

  if (ordersMom != null && ordersMom < -0.15) {
    anomalies.push({
      id: 'orders',
      title: '订单量异常下降',
      severity: 'medium',
      detail: `订单量环比 **${fmtPct(ordersMom)}**（阈值：下降超过 15%）。${windowLabel}。`,
    })
  }

  if (aovMom != null && aovMom < -0.1) {
    anomalies.push({
      id: 'aov',
      title: '客单价异常降低',
      severity: 'medium',
      detail: `客单价环比 **${fmtPct(aovMom)}**（阈值：下降超过 10%）。近 7 天客单价约 **￥${aovRecent.toLocaleString('zh-CN', { maximumFractionDigits: 2 })}**，前 7 天约 **￥${aovPrev.toLocaleString('zh-CN', { maximumFractionDigits: 2 })}**。`,
    })
  }

  return {
    kind: 'result',
    windowLabel,
    anomalies,
    meta: {
      prevSales,
      recentSales,
      prevOrders,
      recentOrders,
      salesMom,
      ordersMom,
      aovMom,
    },
  }
}

function renderInlineBold(text) {
  const parts = text.split(/(\*\*.+?\*\*)/g)
  return parts.map((part, i) => {
    const m = /^\*\*(.+)\*\*$/.exec(part)
    if (m) {
      return (
        <strong key={i} className="font-semibold">
          {m[1]}
        </strong>
      )
    }
    return <span key={i}>{part}</span>
  })
}

function SeverityCard({ severity, title, detail }) {
  const isHigh = severity === 'high'
  return (
    <li
      className={[
        'rounded-xl border-l-4 px-4 py-3 shadow-sm',
        isHigh
          ? 'border-red-500 bg-red-50/90 text-red-950 ring-1 ring-red-200/70'
          : 'border-amber-500 bg-amber-50/90 text-amber-950 ring-1 ring-amber-200/70',
      ].join(' ')}
    >
      <p className="text-sm font-semibold">{title}</p>
      <p className="mt-2 text-sm leading-relaxed opacity-95">{renderInlineBold(detail)}</p>
    </li>
  )
}

export default function AnomalyDetector() {
  const { tableData } = useAppData()
  const data = tableData
  const result = useMemo(() => detectAnomalies(data), [data])

  if (result.kind === 'empty') {
    return (
      <section className="rounded-2xl border border-dashed border-neutral-200 bg-white/70 px-5 py-10 text-center text-sm text-neutral-600 shadow-sm">
        暂无数据，无法运行异常检测。请先上传包含「日期」「销售额」「订单数」的表格。
      </section>
    )
  }

  if (result.kind === 'insufficient') {
    return (
      <section className="rounded-2xl border border-amber-200 bg-amber-50/80 px-5 py-6 text-sm text-amber-950 shadow-sm ring-1 ring-amber-200/60">
        <p className="font-semibold">数据不足以计算「最近 7 天 vs 前 7 天」</p>
        <p className="mt-2 text-amber-900/90">
          当前仅有 <strong>{result.dayCount}</strong> 个不同日期；至少需要 <strong>14</strong> 个有数据的日期才能按规则对比两周窗口。
        </p>
      </section>
    )
  }

  const { anomalies, windowLabel } = result

  return (
    <section className="space-y-5">
      <div>
        <h2 className="text-lg font-semibold tracking-tight text-neutral-900">异常检测（规则）</h2>
        <p className="mt-0.5 text-sm text-neutral-500">{windowLabel}</p>
      </div>

      {anomalies.length === 0 ? (
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50/80 px-5 py-5 text-sm text-emerald-950 shadow-sm ring-1 ring-emerald-200/60">
          <p className="font-semibold">未发现规则范围内的异常</p>
          <p className="mt-1 text-emerald-900/90">
            销售额环比未低于 −20%，订单量未低于 −15%，客单价环比未低于 −10%。（仍为启发式规则，不代表业务无风险。）
          </p>
        </div>
      ) : (
        <ul className="space-y-3">
          {anomalies.map((a) => (
            <SeverityCard key={a.id} severity={a.severity} title={a.title} detail={a.detail} />
          ))}
        </ul>
      )}

      <div className="rounded-2xl border border-red-200/80 bg-gradient-to-br from-red-50/90 to-amber-50/80 px-5 py-5 shadow-sm ring-1 ring-red-100">
        <p className="text-sm font-semibold text-red-950">
          {anomalies.length > 0 ? '归因与排查建议' : '归因与排查建议（参考维度）'}
        </p>
        <ul className="mt-3 list-disc space-y-2 pl-5 text-sm leading-relaxed text-red-950/90 marker:text-red-400">
          {ATTRIBUTION_HINTS.map((t) => (
            <li key={t}>{renderInlineBold(t)}</li>
          ))}
        </ul>
      </div>
    </section>
  )
}
