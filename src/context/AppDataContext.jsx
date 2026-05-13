import { createContext, useContext, useEffect, useMemo, useState } from 'react'

const emptyRawData = {
  headers: [],
  rows: [],
  fileName: '',
}

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

  useEffect(() => {
    if (!hasData) setAiAnswer('')
  }, [hasData])

  const value = useMemo(
    () => ({
      rawData,
      setRawData,
      tableData,
      hasData,
      aiAnswer,
      setAiAnswer,
    }),
    [rawData, tableData, hasData, aiAnswer],
  )

  return <AppDataContext.Provider value={value}>{children}</AppDataContext.Provider>
}

export function useAppData() {
  const ctx = useContext(AppDataContext)
  if (!ctx) throw new Error('useAppData 必须在 AppDataProvider 内使用')
  return ctx
}
