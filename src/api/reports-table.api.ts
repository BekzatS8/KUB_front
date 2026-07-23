import api from './index'

// Личные отчёты-таблицы сотрудников (ТЗ 04.07.2026, п.3).
// У сотрудника может быть несколько именованных отчётов; руководитель выбирает,
// какой именно отчёт открыть.

export interface ReportTableContent {
  columns: string[]
  rows: string[][]
}

export interface ManagerReport {
  id: number
  user_id: number
  user_name?: string
  title: string
  // в списках content не приходит — только в отчёте, открытом целиком
  content?: ReportTableContent
  created_at?: string
  updated_at?: string
}

// Строка списка «Отчёты сотрудников»: сотрудник и сводка по его отчётам.
export interface ManagerReportOwner {
  user_id: number
  user_name: string
  report_count: number
  updated_at: string
}

export async function listMyReportTables(): Promise<{ items: ManagerReport[]; count: number }> {
  const res = await api.get('/reports/table/my')
  return res.data
}

export async function createMyReportTable(
  title: string,
  content?: ReportTableContent,
): Promise<ManagerReport> {
  const res = await api.post('/reports/table/my', { title, content })
  return res.data
}

export async function getMyReportTable(id: number): Promise<ManagerReport> {
  const res = await api.get(`/reports/table/my/${id}`)
  return res.data
}

export async function saveMyReportTable(
  id: number,
  content: ReportTableContent,
  title?: string,
): Promise<void> {
  await api.put(`/reports/table/my/${id}`, { content, title })
}

export async function deleteMyReportTable(id: number): Promise<void> {
  await api.delete(`/reports/table/my/${id}`)
}

// Корзина сотрудника: список удалённых, восстановление, окончательное удаление.
export async function listMyReportTrash(): Promise<{ items: ManagerReport[]; count: number }> {
  const res = await api.get('/reports/table/my-trash')
  return res.data
}

export async function restoreMyReportTable(id: number): Promise<void> {
  await api.post(`/reports/table/my/${id}/restore`)
}

export async function purgeMyReportTable(id: number): Promise<void> {
  await api.delete(`/reports/table/my/${id}/purge`)
}

export async function listReportTableOwners(): Promise<{ items: ManagerReportOwner[]; count: number }> {
  const res = await api.get('/reports/table')
  return res.data
}

export async function listUserReportTables(userId: number): Promise<{ items: ManagerReport[]; count: number }> {
  const res = await api.get(`/reports/table/user/${userId}`)
  return res.data
}

export async function getReportTable(id: number): Promise<ManagerReport> {
  const res = await api.get(`/reports/table/report/${id}`)
  return res.data
}

// Админ: правка/удаление любого отчёта сотрудника.
export async function saveReportTable(
  id: number,
  content: ReportTableContent,
  title?: string,
): Promise<void> {
  await api.put(`/reports/table/report/${id}`, { content, title })
}

export async function deleteReportTable(id: number): Promise<void> {
  await api.delete(`/reports/table/report/${id}`)
}

// Корзина админа: все удалённые отчёты, восстановление, окончательное удаление.
export async function listReportTrash(): Promise<{ items: ManagerReport[]; count: number }> {
  const res = await api.get('/reports/table/trash')
  return res.data
}

export async function restoreReportTable(id: number): Promise<void> {
  await api.post(`/reports/table/report/${id}/restore`)
}

export async function purgeReportTable(id: number): Promise<void> {
  await api.delete(`/reports/table/report/${id}/purge`)
}

// Скачать отчёт в Excel (руководство/админ/КК). Возвращает blob для сохранения.
export async function exportReportTable(id: number): Promise<Blob> {
  const res = await api.get(`/reports/table/report/${id}/export`, { responseType: 'blob' })
  return res.data as Blob
}
