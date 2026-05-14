import { useCallback, useId, useRef, useState } from 'react'
import * as XLSX from 'xlsx'
import Papa from 'papaparse'
import { useAppData } from '../context/AppDataContext.jsx'

const ACCEPT_EXT = new Set(['.csv', '.xlsx', '.xls'])
const ACCEPT_ATTR = '.csv,.xlsx,.xls,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel,text/csv'

function getExtension(name) {
  const i = name.lastIndexOf('.')
  return i >= 0 ? name.slice(i).toLowerCase() : ''
}

/** @returns {{ headers: string[], rows: (string|number|null)[][] }} */
function aoaToHeadersAndRows(aoa) {
  if (!aoa?.length) return { headers: [], rows: [] }

  const maxLen = Math.max(
    0,
    ...aoa.map((r) => (Array.isArray(r) ? r.length : 0)),
  )
  const pad = (row) => {
    const r = Array.isArray(row) ? [...row] : []
    while (r.length < maxLen) r.push('')
    return r.slice(0, maxLen)
  }
  const padded = aoa.map((r) => pad(Array.isArray(r) ? r : []))
  const headerRow = padded[0] ?? []
  const headers = headerRow.map((cell, idx) =>
    cell == null || cell === '' ? `列${idx + 1}` : String(cell),
  )
  const colCount = headers.length
  const rows = padded.slice(1).map((row) => {
    const r = pad(row)
    while (r.length < colCount) r.push('')
    return r.slice(0, colCount)
  })
  return { headers, rows }
}

function parseCsvFile(file) {
  return new Promise((resolve, reject) => {
    Papa.parse(file, {
      header: false,
      skipEmptyLines: 'greedy',
      complete: (results) => {
        if (results.errors?.length) {
          const fatal = results.errors.find((e) => e.fatal)
          if (fatal) {
            reject(new Error(fatal.message || 'CSV 解析失败'))
            return
          }
        }
        resolve(results.data)
      },
      error: (err) => reject(err),
    })
  })
}

async function parseExcelFile(file) {
  const buf = await file.arrayBuffer()
  const wb = XLSX.read(buf, { type: 'array' })
  const sheetName = wb.SheetNames[0]
  if (!sheetName) return []
  const ws = wb.Sheets[sheetName]
  return XLSX.utils.sheet_to_json(ws, { header: 1, defval: '', raw: false })
}

export default function DataUploader() {
  const { rawData, setRawData, clearAllData, hasUploadPayload } = useAppData()
  const inputId = useId()
  const fileRef = useRef(null)
  const { headers, rows, fileName } = rawData
  const rowCount = rows.length
  const [error, setError] = useState('')
  const [isParsing, setIsParsing] = useState(false)
  const [isDragging, setIsDragging] = useState(false)

  const previewRows = rows.slice(0, 100)
  const showPreview = headers.length > 0 || rowCount > 0

  const ingestFile = useCallback(
    async (file) => {
      if (!file) return
      setError('')
      const ext = getExtension(file.name)
      if (!ACCEPT_EXT.has(ext)) {
        setError('仅支持 .csv、.xlsx、.xls 文件')
        return
      }

      setIsParsing(true)
      try {
        let aoa
        if (ext === '.csv') {
          aoa = await parseCsvFile(file)
        } else {
          aoa = await parseExcelFile(file)
        }
        const { headers: h, rows: r } = aoaToHeadersAndRows(aoa)
        if (!h.length && !r.length) {
          setError('文件为空或无法读取有效表格')
          return
        }
        setRawData({ headers: h, rows: r, fileName: file.name })
      } catch (e) {
        setError(e instanceof Error ? e.message : '解析失败，请重试')
      } finally {
        setIsParsing(false)
        if (fileRef.current) fileRef.current.value = ''
      }
    },
    [setRawData],
  )

  const onInputChange = (e) => {
    const file = e.target.files?.[0]
    void ingestFile(file)
  }

  const onDrop = (e) => {
    e.preventDefault()
    setIsDragging(false)
    const file = e.dataTransfer.files?.[0]
    void ingestFile(file)
  }

  const onDragOver = (e) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'copy'
  }

  const onClear = () => {
    setError('')
    clearAllData()
    if (fileRef.current) fileRef.current.value = ''
  }

  return (
    <section className="w-full max-w-5xl space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-lg font-semibold tracking-tight text-neutral-900">数据上传</h2>
          <p className="mt-0.5 text-sm text-neutral-500">支持 CSV / Excel，解析后保存完整数据用于后续分析</p>
        </div>
        <button
          type="button"
          onClick={onClear}
          disabled={!hasUploadPayload}
          className="inline-flex shrink-0 items-center justify-center rounded-xl border border-neutral-200 bg-white px-4 py-2.5 text-sm font-medium text-neutral-700 shadow-sm transition hover:border-neutral-300 hover:bg-neutral-50 disabled:pointer-events-none disabled:opacity-40"
        >
          清除数据
        </button>
      </div>

      <label
        htmlFor={inputId}
        onDragEnter={() => setIsDragging(true)}
        onDragLeave={() => setIsDragging(false)}
        onDragOver={onDragOver}
        onDrop={onDrop}
        className={[
          'flex cursor-pointer flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed px-6 py-12 transition',
          isDragging
            ? 'border-indigo-400 bg-indigo-50/80'
            : 'border-neutral-200 bg-white hover:border-neutral-300 hover:bg-neutral-50/80',
          isParsing && 'pointer-events-none opacity-60',
        ].join(' ')}
      >
        <input
          ref={fileRef}
          id={inputId}
          type="file"
          accept={ACCEPT_ATTR}
          className="sr-only"
          onChange={onInputChange}
          disabled={isParsing}
        />
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-indigo-100 text-indigo-600">
          <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5} aria-hidden>
            <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
          </svg>
        </div>
        <div className="text-center">
          <p className="text-sm font-medium text-neutral-800">
            {isParsing ? '正在解析…' : '点击选择或拖拽文件到此处'}
          </p>
          <p className="mt-1 text-xs text-neutral-500">.csv · .xlsx · .xls · 默认读取第一个工作表</p>
        </div>
      </label>

      {error ? (
        <div
          role="alert"
          className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800"
        >
          {error}
        </div>
      ) : null}

      {showPreview ? (
        <div className="overflow-hidden rounded-2xl border border-neutral-200 bg-white shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-neutral-100 bg-neutral-50/80 px-4 py-3">
            <p className="text-sm font-medium text-neutral-800">
              预览
              {fileName ? (
                <span className="ml-2 font-normal text-neutral-500">· {fileName}</span>
              ) : null}
            </p>
            <p className="text-xs text-neutral-500">
              表头 + 前 {Math.min(100, rowCount)} 行
              {rowCount > 100 ? `（共 ${rowCount.toLocaleString('zh-CN')} 行，完整数据已保存）` : `（共 ${rowCount.toLocaleString('zh-CN')} 行）`}
            </p>
          </div>
          <div className="max-h-[min(70vh,560px)] overflow-auto">
            <table className="min-w-full border-collapse text-left text-sm">
              <thead className="sticky top-0 z-10 bg-neutral-100/95 backdrop-blur">
                <tr>
                  {headers.map((h, i) => (
                    <th
                      key={`h-${i}`}
                      className="whitespace-nowrap border-b border-neutral-200 px-3 py-2.5 font-semibold text-neutral-800"
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-100 text-neutral-700">
                {previewRows.map((row, ri) => (
                  <tr key={`r-${ri}`} className="bg-white even:bg-neutral-50/50">
                    {headers.map((_, ci) => (
                      <td key={`c-${ri}-${ci}`} className="max-w-[14rem] truncate whitespace-nowrap px-3 py-2 font-mono text-xs text-neutral-600">
                        {row[ci] == null || row[ci] === '' ? '—' : String(row[ci])}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : null}
    </section>
  )
}
