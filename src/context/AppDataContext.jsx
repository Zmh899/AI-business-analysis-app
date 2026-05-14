import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'

const emptyRawData = () => ({
  headers: [],
  rows: [],
  fileName: '',
})

const AppDataContext = createContext(null)

export function AppDataProvider({ children }) {
  const [rawData, setRawData] = useState(emptyRawData)
  const [aiAnswer, setAiAnswer] = useState('')

  const tableData = useMemo(() => {
    const { headers, rows } = rawData
    if (!headers?.length || !rows?.length) return []
    return rows.map((row) => Object.fromEntries(headers.map((h, i) => [h, row[i]])))
  }, [rawData])

  const hasData = Boolean(rawData.headers?.length && rawData.rows?.length)

  /** 是否有可预览/可导出的表格内容（表头或数据行任一有即可） */
  const hasExportableData = Boolean(rawData.headers?.length || rawData.rows?.length)

  /** 上传区是否仍有可清除内容（含仅表头、仅有文件名等） */
  const hasUploadPayload = Boolean(
    rawData.headers?.length || rawData.rows?.length || rawData.fileName,
  )

  const clearAllData = useCallback(() => {
    setRawData(emptyRawData())
    setAiAnswer('')
  }, [])

  useEffect(() => {
    if (!hasData) setAiAnswer('')
  }, [hasData])

  const value = useMemo(
    () => ({
      rawData,
      setRawData,
      clearAllData,
      tableData,
      hasData,
      hasExportableData,
      hasUploadPayload,
      aiAnswer,
      setAiAnswer,
    }),
    [rawData, clearAllData, tableData, hasData, hasExportableData, hasUploadPayload, aiAnswer],
  )

  return <AppDataContext.Provider value={value}>{children}</AppDataContext.Provider>
}

export function useAppData() {
  const ctx = useContext(AppDataContext)
  if (!ctx) throw new Error('useAppData 必须在 AppDataProvider 内使用')
  return ctx
}
