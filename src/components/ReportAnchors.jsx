import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { useAppData } from '../context/AppDataContext.jsx'
import { aiMarkdownComponents } from './AIQuery.jsx'
import AnomalyDetector from './AnomalyDetector.jsx'
import MetricsDashboard from './MetricsDashboard.jsx'

/**
 * 离屏挂载与 ReportGenerator 同 id 的 DOM，避免 Tab 切换卸载后无法导出 PDF。
 */
export default function ReportAnchors() {
  const { hasData, aiAnswer } = useAppData()
  if (!hasData) return null

  return (
    <div
      aria-hidden="true"
      className="pointer-events-none fixed -left-[12000px] top-0 z-[-1] w-[794px] max-w-[100vw] space-y-8 bg-white p-6 text-left text-neutral-900 shadow-none"
    >
      <div id="report-section-dashboard" className="report-pdf-avoid-break">
        <MetricsDashboard />
      </div>
      <div id="report-section-anomaly" className="report-pdf-avoid-break">
        <AnomalyDetector />
      </div>
      <div
        id="report-section-ai-answer"
        className="report-pdf-avoid-break rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm"
      >
        <h3 className="mb-3 text-sm font-semibold text-neutral-800">回答</h3>
        {aiAnswer ? (
          <div className="max-w-none text-sm">
            <ReactMarkdown remarkPlugins={[remarkGfm]} components={aiMarkdownComponents}>
              {aiAnswer}
            </ReactMarkdown>
          </div>
        ) : (
          <p className="text-sm text-neutral-500">暂无回答。请在「AI 问答」页签发送问题后导出报告。</p>
        )}
      </div>
    </div>
  )
}
