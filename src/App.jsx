import { useEffect, useState } from 'react'
import { AppDataProvider, useAppData } from './context/AppDataContext.jsx'
import AIQuery from './components/AIQuery.jsx'
import AnomalyDetector from './components/AnomalyDetector.jsx'
import DataUploader from './components/DataUploader.jsx'
import MetricsDashboard from './components/MetricsDashboard.jsx'
import ReportAnchors from './components/ReportAnchors.jsx'
import ReportGenerator from './components/ReportGenerator.jsx'

const TABS = [
  { id: 'import', label: '数据导入' },
  { id: 'metrics', label: '指标看板' },
  { id: 'ai', label: 'AI 问答' },
  { id: 'anomaly', label: '异常归因' },
]

export default function App() {
  return (
    <AppDataProvider>
      <AppShell />
    </AppDataProvider>
  )
}

function AppShell() {
  const { hasData, hasExportableData } = useAppData()
  const [tab, setTab] = useState('import')

  useEffect(() => {
    if (!hasData && tab !== 'import') setTab('import')
  }, [hasData, tab])

  return (
    <div className="min-h-dvh bg-gradient-to-b from-neutral-50 to-neutral-100 text-neutral-900 antialiased">
      <header className="sticky top-0 z-40 border-b border-neutral-200/90 bg-white/90 shadow-sm shadow-neutral-900/5 backdrop-blur-md">
        <div className="mx-auto max-w-5xl px-4 pb-0 pt-4 sm:pt-5">
          <h1 className="text-xl font-semibold tracking-tight sm:text-2xl">AI经营分析助手</h1>
          <p className="mt-1 max-w-2xl text-xs leading-relaxed text-neutral-500 sm:text-sm">
            先完成数据导入后，可切换页签查看指标看板、AI 问答与异常归因；小屏幕下导航支持横向滑动。
          </p>
          <nav
            className="-mx-4 mt-4 flex gap-2 overflow-x-auto overscroll-x-contain px-4 pb-3 sm:mx-0 sm:flex-wrap sm:px-0 sm:pb-4"
            role="tablist"
            aria-label="主导航"
          >
            {TABS.map((t) => {
              const locked = t.id !== 'import' && !hasData
              const active = tab === t.id
              return (
                <button
                  key={t.id}
                  type="button"
                  role="tab"
                  aria-selected={active}
                  aria-disabled={locked}
                  disabled={locked}
                  onClick={() => {
                    if (!locked) setTab(t.id)
                  }}
                  className={[
                    'shrink-0 rounded-full border px-3.5 py-2 text-sm font-medium transition sm:px-4',
                    active
                      ? 'border-indigo-600 bg-indigo-600 text-white shadow-sm'
                      : 'border-neutral-200 bg-white text-neutral-700 hover:border-neutral-300 hover:bg-neutral-50',
                    locked ? 'cursor-not-allowed opacity-45' : '',
                  ].join(' ')}
                >
                  {t.label}
                </button>
              )
            })}
          </nav>
        </div>
      </header>

      <main className="mx-auto max-w-5xl space-y-6 px-4 py-6 sm:space-y-8 sm:py-10">
        {!hasData ? (
          <div
            className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950 shadow-sm ring-1 ring-amber-100/80"
            role="status"
          >
            <span className="font-semibold">请先导入数据。</span>
            指标看板、AI 问答、异常归因等页签需在上传有效表格后才会启用。
          </div>
        ) : null}

        {tab === 'import' && (
          <div className="space-y-6 sm:space-y-8">
            <DataUploader />
          </div>
        )}

        {tab === 'metrics' && hasData && (
          <div className="space-y-6">
            <MetricsDashboard />
          </div>
        )}

        {tab === 'ai' && hasData && (
          <div>
            <AIQuery />
          </div>
        )}

        {tab === 'anomaly' && hasData && (
          <div>
            <AnomalyDetector />
          </div>
        )}
        {hasExportableData ? (
          <section className="mt-8 border-t border-neutral-200 pt-8 sm:mt-10 sm:pt-10" aria-label="经营报告导出">
            <ReportGenerator />
          </section>
        ) : null}
      </main>

      {hasExportableData ? <ReportAnchors /> : null}
    </div>
  )
}
