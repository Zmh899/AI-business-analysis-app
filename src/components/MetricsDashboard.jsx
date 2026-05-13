import { useMemo } from 'react'
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { useAppData } from '../context/AppDataContext.jsx'

function toNum(value) {
  if (value == null || value === '') return 0
  const n = Number(String(value).replace(/,/g, '').trim())
  return Number.isFinite(n) ? n : 0
}

function formatMoney(n) {
  return n.toLocaleString('zh-CN', { minimumFractionDigits: 0, maximumFractionDigits: 2 })
}

function aggregateByDate(rows) {
  const map = new Map()
  for (const row of rows) {
    const rawDate = row['日期']
    const key = rawDate == null ? '' : String(rawDate).trim()
    if (!key) continue
    const cur = map.get(key) ?? { 日期: key, 销售额: 0, 订单数: 0 }
    cur.销售额 += toNum(row['销售额'])
    cur.订单数 += toNum(row['订单数'])
    map.set(key, cur)
  }
  return [...map.values()].sort((a, b) => {
    const ta = Date.parse(a.日期)
    const tb = Date.parse(b.日期)
    if (Number.isFinite(ta) && Number.isFinite(tb) && ta !== tb) return ta - tb
    return String(a.日期).localeCompare(String(b.日期), 'zh-CN')
  })
}

function MetricCard({ title, value, hint }) {
  return (
    <div className="rounded-2xl border border-neutral-100 bg-white p-5 shadow-md shadow-neutral-900/5 ring-1 ring-neutral-900/5">
      <p className="text-xs font-medium uppercase tracking-wide text-neutral-500">{title}</p>
      <p className="mt-2 text-2xl font-semibold tracking-tight text-neutral-900">{value}</p>
      {hint ? <p className="mt-1 text-xs text-neutral-400">{hint}</p> : null}
    </div>
  )
}

export default function MetricsDashboard() {
  const { tableData } = useAppData()
  const data = tableData
  const rows = Array.isArray(data) ? data : []

  const {
    gmv,
    orders,
    avgOrderValue,
    conversionRate,
    conversionSimulated,
    roi,
    roiLabel,
    chartSeries,
    hasVisitsColumn,
  } = useMemo(() => {
    let gmvAcc = 0
    let ordersAcc = 0
    let adAcc = 0
    let visitsAcc = 0

    const hasVisits =
      rows.length > 0 &&
      Object.prototype.hasOwnProperty.call(rows[0], '访问量')

    for (const row of rows) {
      gmvAcc += toNum(row['销售额'])
      ordersAcc += toNum(row['订单数'])
      adAcc += toNum(row['广告费'])
      if (hasVisits) visitsAcc += toNum(row['访问量'])
    }

    const avgOrder = ordersAcc > 0 ? gmvAcc / ordersAcc : null

    let convRate
    let convSimulated = false
    if (hasVisits) {
      convRate = visitsAcc > 0 ? ordersAcc / visitsAcc : null
    } else {
      convRate = 0.125
      convSimulated = true
    }

    let roiVal = null
    let roiHint = ''
    if (adAcc > 0) {
      roiVal = (gmvAcc - adAcc) / adAcc
      roiHint = '（GMV − 广告费）÷ 广告费'
    }

    return {
      gmv: gmvAcc,
      orders: ordersAcc,
      avgOrderValue: avgOrder,
      conversionRate: convRate,
      conversionSimulated: convSimulated,
      roi: roiVal,
      roiLabel: roiHint,
      chartSeries: aggregateByDate(rows),
      hasVisitsColumn: hasVisits,
    }
  }, [rows])

  if (!rows.length) {
    return (
      <section className="rounded-2xl border border-dashed border-neutral-200 bg-white/60 px-6 py-14 text-center shadow-sm">
        <p className="text-sm font-medium text-neutral-700">暂无数据</p>
        <p className="mt-1 text-xs text-neutral-500">上传包含「日期」「销售额」「订单数」等列的表格后，将在此展示经营指标与趋势图。</p>
      </section>
    )
  }

  const conversionDisplay =
    conversionRate == null
      ? '—'
      : `${(conversionRate * 100).toLocaleString('zh-CN', { maximumFractionDigits: 2 })}%`

  const conversionHint = conversionSimulated
    ? '未检测到「访问量」列，已按 12.5% 模拟'
    : hasVisitsColumn && conversionRate != null
      ? '订单数 ÷ 访问量（汇总）'
      : undefined

  const roiDisplay =
    roi == null ? '—' : `${roi.toLocaleString('zh-CN', { maximumFractionDigits: 2 })}x`

  return (
    <section className="space-y-8">
      <div>
        <h2 className="text-lg font-semibold tracking-tight text-neutral-900">经营指标</h2>
        <p className="mt-0.5 text-sm text-neutral-500">基于已上传数据自动汇总（同一日期在图中会合并展示）</p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <MetricCard title="GMV（总销售额）" value={`￥${formatMoney(gmv)}`} />
        <MetricCard title="订单总量" value={orders.toLocaleString('zh-CN')} />
        <MetricCard
          title="客单价"
          value={avgOrderValue == null ? '—' : `￥${formatMoney(avgOrderValue)}`}
          hint={orders > 0 ? 'GMV ÷ 订单数' : '无订单时无法计算'}
        />
        <MetricCard title="转化率" value={conversionDisplay} hint={conversionHint} />
        <MetricCard title="ROI" value={roiDisplay} hint={roiLabel || (roi == null ? '广告费合计为 0 时无法计算' : '')} />
      </div>

      <div className="rounded-2xl border border-neutral-100 bg-white p-5 shadow-lg shadow-neutral-900/8 ring-1 ring-neutral-900/5 sm:p-6">
        <div className="mb-4 flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h3 className="text-base font-semibold text-neutral-900">销售与订单趋势</h3>
            <p className="text-xs text-neutral-500">双轴：左销售额 · 右订单数</p>
          </div>
        </div>
        {chartSeries.length === 0 ? (
          <div className="flex min-h-[280px] items-center justify-center rounded-xl bg-neutral-50 px-4 py-10 text-center text-sm text-neutral-500">
            未找到有效的「日期」列数据，无法绘制趋势图。
          </div>
        ) : (
          <div className="h-[min(22rem,50vh)] w-full min-h-[280px]">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartSeries} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis dataKey="日期" tick={{ fontSize: 11 }} stroke="#9ca3af" />
                <YAxis
                  yAxisId="left"
                  tick={{ fontSize: 11 }}
                  stroke="#6366f1"
                  tickFormatter={(v) => (v >= 1e4 ? `${v / 1e4}万` : String(v))}
                />
                <YAxis
                  yAxisId="right"
                  orientation="right"
                  tick={{ fontSize: 11 }}
                  stroke="#0ea5e9"
                  allowDecimals={false}
                />
                <Tooltip
                  contentStyle={{
                    borderRadius: '12px',
                    border: '1px solid #e5e7eb',
                    boxShadow: '0 10px 40px rgba(0,0,0,0.08)',
                  }}
                  formatter={(value, name) => [
                    name === '销售额' ? `￥${formatMoney(Number(value))}` : Number(value).toLocaleString('zh-CN'),
                    name,
                  ]}
                />
                <Legend />
                <Line
                  yAxisId="left"
                  type="monotone"
                  dataKey="销售额"
                  name="销售额"
                  stroke="#4f46e5"
                  strokeWidth={2}
                  dot={{ r: 3 }}
                  activeDot={{ r: 5 }}
                />
                <Line
                  yAxisId="right"
                  type="monotone"
                  dataKey="订单数"
                  name="订单数"
                  stroke="#0284c7"
                  strokeWidth={2}
                  dot={{ r: 3 }}
                  activeDot={{ r: 5 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>
    </section>
  )
}
