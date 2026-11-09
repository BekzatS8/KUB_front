import api from './index'

// Календарь встреч (ТЗ «доработки CRM КУБ», п.6)
export interface CalendarEvent {
  id: number
  title: string
  description?: string
  starts_at: string
  ends_at?: string
  lead_id?: number
  lead_title?: string
  client_id?: number
  client_name?: string
  owner_id?: number
  owner_name?: string
  created_by?: number
  creator_name?: string
  branch_id?: number
  branch_name?: string
  can_edit: boolean
}

export interface CalendarEventInput {
  title: string
  description?: string
  starts_at: string
  ends_at?: string
  lead_id?: number | null
  owner_id?: number | null
}

export async function list_calendar_events(params: {
  from: string
  to: string
  owner_id?: number
  branch_id?: number
  lead_id?: number
}): Promise<CalendarEvent[]> {
  const res = await api.get('/calendar/events', { params })
  return Array.isArray(res.data?.items) ? res.data.items : []
}

export async function create_calendar_event(input: CalendarEventInput): Promise<CalendarEvent> {
  const res = await api.post('/calendar/events', input)
  return res.data
}

export async function update_calendar_event(id: number, input: CalendarEventInput): Promise<CalendarEvent> {
  const res = await api.put(`/calendar/events/${id}`, input)
  return res.data
}

export async function delete_calendar_event(id: number): Promise<void> {
  await api.delete(`/calendar/events/${id}`)
}
