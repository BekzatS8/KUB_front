import api from './index'

// Личные отчёты-таблицы сотрудников (ТЗ 04.07.2026, п.3).
// У сотрудника может быть несколько именованных отчётов; руководитель выбирает,
// какой именно отчёт открыть.

export interface ReportTableContent {
  columns: string[]
  rows: string[][]
  // Ширины столбцов в px (как в Excel — тянутся мышью). Необязательно: если нет
  // или длина не совпадает с columns — берутся значения по умолчанию.
  widths?: number[]
  // Вид документа: таблица (по умолчанию) или блокнот с текстом (ТЗ
  // «доработки CRM КУБ», п.12).
  kind?: 'table' | 'note'
  text?: string
}

export interface ManagerReport {
  id: number
  user_id: number
  user_name?: string
  title: string
  kind?: 'table' | 'note'
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

// Порядок вкладок «Мои отчёты»: ids идут в нужном порядке слева направо.
// Открытие отчёта (getMyReportTable) само поднимает его в начало списка на
// сервере — этот вызов нужен для ручной перестановки.
export async function reorderMyReportTables(ids: number[]): Promise<void> {
  await api.put(`/reports/table/my/order`, { ids })
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
// trash — отчёт из корзины (открыть/скачать, не восстанавливая).
export async function exportReportTable(id: number, trash = false): Promise<Blob> {
  const res = await api.get(`/reports/table/report/${id}/export`, {
    responseType: 'blob',
    params: trash ? { trash: 1 } : undefined,
  })
  return res.data as Blob
}

// Отчёт из корзины сотрудников — просмотр без восстановления.
export async function getTrashedReportTable(id: number): Promise<ManagerReport> {
  const res = await api.get(`/reports/table/report/${id}`, { params: { trash: 1 } })
  return res.data
}

// Свой отчёт из своей корзины — просмотр и Excel.
export async function getMyTrashedReportTable(id: number): Promise<ManagerReport> {
  const res = await api.get(`/reports/table/my/${id}`, { params: { trash: 1 } })
  return res.data
}

export async function exportMyReportTable(id: number, trash = false): Promise<Blob> {
  const res = await api.get(`/reports/table/my/${id}/export`, {
    responseType: 'blob',
    params: trash ? { trash: 1 } : undefined,
  })
  return res.data as Blob
}

// Блокнот (отчёт-текст) — файлом .txt.
export function saveReportNoteText(text: string, title?: string) {
  const blob = new Blob([text || ''], { type: 'text/plain;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `${title || 'report'}.txt`
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}

// Сохранить blob отчёта файлом .xlsx.
export function saveReportBlob(blob: Blob, title?: string) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `${title || 'report'}.xlsx`
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}


// Поиск по названию отчётов сотрудников и тексту внутри (п.12).
export interface ReportSearchHit {
  id: number
  user_id: number
  user_name: string
  title: string
  kind: 'table' | 'note'
  updated_at: string
  title_match: boolean
  snippet?: string
}

export async function searchReportTables(q: string): Promise<ReportSearchHit[]> {
  const res = await api.get('/reports/table/search', { params: { q } })
  return res.data?.items || []
}
