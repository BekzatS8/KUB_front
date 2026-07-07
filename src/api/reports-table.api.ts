import api from './index'

// Личные отчёты-таблицы сотрудников (ТЗ 04.07.2026, п.3)

export interface ReportTableContent {
  columns: string[]
  rows: string[][]
}

export interface ManagerReport {
  id?: number
  user_id: number
  user_name?: string
  content: ReportTableContent
  updated_at?: string | null
}

export async function getMyReportTable(): Promise<ManagerReport> {
  const res = await api.get('/reports/table/my')
  return res.data
}

export async function saveMyReportTable(content: ReportTableContent): Promise<void> {
  await api.put('/reports/table/my', { content })
}

export async function listReportTables(): Promise<{ items: ManagerReport[]; count: number }> {
  const res = await api.get('/reports/table')
  return res.data
}

export async function getUserReportTable(userId: number): Promise<ManagerReport> {
  const res = await api.get(`/reports/table/user/${userId}`)
  return res.data
}
