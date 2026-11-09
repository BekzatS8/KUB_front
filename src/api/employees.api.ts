import api from './index'

// Раздел «Сотрудники» и кадровые документы (ТЗ «доработки CRM КУБ», п.1–2)

export type EmployeeType = 'permanent' | 'intern' | 'fired'

export interface Employee {
  id: number
  full_name: string
  birth_date: string
  iin: string
  address: string
  phone: string
  email?: string
  emergency_name: string
  emergency_relation: string
  emergency_phone: string
  position: string
  salary: number
  hired_at: string
  fired_at?: string
  employee_type: EmployeeType
  has_photo: boolean
  branch_id?: number
  branch_name?: string
  created_at: string
  updated_at: string
}

export type EmployeeInput = Omit<Employee, 'id' | 'has_photo' | 'created_at' | 'updated_at' | 'branch_name'>

export interface HRTemplate {
  id: number
  name: string
  kind: string
  original_name?: string
  created_at: string
}

export type EmployeeDocStatus = 'draft' | 'sent_for_signature' | 'signed' | 'revoked'

export interface EmployeeDocument {
  id: number
  employee_id: number
  template_id?: number
  title: string
  status: EmployeeDocStatus
  created_at: string
  sent_at?: string
  sent_via?: string
  sent_to?: string
  signed_at?: string
  revoked_at?: string
  has_signed_pdf: boolean
}

export const EMPLOYEE_TYPE_LABELS: Record<EmployeeType, string> = {
  permanent: 'Постоянный сотрудник',
  intern: 'Стажёр',
  fired: 'Уволенный',
}

export const HR_TEMPLATE_KINDS: Record<string, string> = {
  labor_contract: 'Трудовой договор',
  nda: 'Соглашение о конфиденциальности',
  non_compete: 'Соглашение о неконкуренции',
  liability: 'Соглашение о полной материальной ответственности',
  job_description: 'Должностная инструкция',
  other: 'Регламент / прочее',
}

export const EMPLOYEE_DOC_STATUS_LABELS: Record<EmployeeDocStatus, string> = {
  draft: 'Черновик',
  sent_for_signature: 'Отправлен',
  signed: 'Подписан',
  revoked: 'Отозван',
}

export async function list_employees(params: Record<string, any>): Promise<{ items: Employee[]; total: number }> {
  const res = await api.get('/employees', { params })
  return { items: res.data?.items || [], total: res.data?.total || 0 }
}

export async function list_employee_positions(): Promise<string[]> {
  const res = await api.get('/employees/positions')
  return res.data?.items || []
}

export async function get_employee(id: number): Promise<Employee> {
  const res = await api.get(`/employees/${id}`)
  return res.data
}

export async function create_employee(input: EmployeeInput): Promise<Employee> {
  const res = await api.post('/employees', input)
  return res.data
}

export async function update_employee(id: number, input: EmployeeInput): Promise<Employee> {
  const res = await api.put(`/employees/${id}`, input)
  return res.data
}

export async function upload_employee_photo(id: number, file: File): Promise<Employee> {
  const form = new FormData()
  form.append('file', file)
  const res = await api.post(`/employees/${id}/photo`, form)
  return res.data
}

// Файлы раздела отдаются только с токеном — берём как blob.
export async function fetch_employee_blob(path: string): Promise<Blob> {
  const res = await api.get(path, { responseType: 'blob' })
  return res.data
}

export async function list_hr_templates(): Promise<HRTemplate[]> {
  const res = await api.get('/employees/templates')
  return res.data?.items || []
}

export async function upload_hr_template(file: File, name: string, kind: string): Promise<HRTemplate> {
  const form = new FormData()
  form.append('file', file)
  form.append('name', name)
  form.append('kind', kind)
  const res = await api.post('/employees/templates', form)
  return res.data
}

export async function delete_hr_template(id: number): Promise<void> {
  await api.delete(`/employees/templates/${id}`)
}

export async function list_employee_documents(id: number): Promise<EmployeeDocument[]> {
  const res = await api.get(`/employees/${id}/documents`)
  return res.data?.items || []
}

export async function issue_employee_documents(id: number, templateIds: number[]): Promise<EmployeeDocument[]> {
  const res = await api.post(`/employees/${id}/documents`, { template_ids: templateIds })
  return res.data?.items || []
}

export async function send_employee_document(id: number, docId: number, channel: 'sms' | 'email'): Promise<EmployeeDocument> {
  const res = await api.post(`/employees/${id}/documents/${docId}/send`, { channel })
  return res.data
}

export async function revoke_employee_document(id: number, docId: number): Promise<EmployeeDocument> {
  const res = await api.post(`/employees/${id}/documents/${docId}/revoke`)
  return res.data
}
