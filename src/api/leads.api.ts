import api from './index'
import type * as Models from '@/src/models/leads.model'

export async function create_lead(payload: Models.Leads_Create_lead_Request, params?: Record<string, any>): Promise<any> {
  const res = await api.post(`/leads`, payload)
  return res.data
}

export async function get_lead(payload?: void, params?: Record<string, any>): Promise<any> {
  const res = await api.get(`/leads/${params?.id}`, params ? { params } : {})
  return res.data
}

export async function update_lead(payload: Models.Leads_Update_lead_Request, params?: Record<string, any>): Promise<any> {
  const res = await api.put(`/leads/${params?.id}`, payload)
  return res.data
}

export async function delete_lead(payload?: void, params?: Record<string, any>): Promise<any> {
  const res = await api.delete(`/leads/${params?.id}`, params ? { params } : {})
  return res.data
}

export async function convert_lead_to_deal(payload: Models.Leads_Convert_lead_to_deal_Request, params?: Record<string, any>): Promise<any> {
  const res = await api.put(`/leads/${params?.id}/convert`, payload)
  return res.data
}

export async function list_leads(payload?: void, params?: Record<string, any>): Promise<any> {
  const res = await api.get(`/leads`, { params: { ...params, paginate: true } })
  return res.data
}

export async function list_my_leads(payload?: void, params?: Record<string, any>): Promise<any> {
  const res = await api.get(`/leads/my`, { params: { ...params, paginate: true } })
  return res.data
}

export async function assign_lead(payload: Models.Leads_Assign_lead_Request, params?: Record<string, any>): Promise<any> {
  const res = await api.post(`/leads/${params?.id}/assign`, payload)
  return res.data
}

export async function update_lead_status(payload: Models.Leads_Update_lead_status_Request, params?: Record<string, any>): Promise<any> {
  const res = await api.post(`/leads/${params?.id}/status`, payload)
  return res.data
}

export async function archive_lead(payload?: { reason?: string }, params?: Record<string, any>): Promise<any> {
  const res = await api.post(`/leads/${params?.id}/archive`, payload)
  return res.data
}

export async function unarchive_lead(payload?: void, params?: Record<string, any>): Promise<any> {
  const res = await api.post(`/leads/${params?.id}/unarchive`)
  return res.data
}
