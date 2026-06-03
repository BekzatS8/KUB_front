import api from './index'
import type * as Models from '@/src/models/deals.model'

export async function create_deal(
  payload: Models.Deals_Create_deal_Request, 
  params?: Record<string, any>
): Promise<any> {
  const res = await api.post(`/deals`, payload)
  return res.data
}

export async function get_deal(
  payload?: void, 
  params?: Record<string, any>
): Promise<any> {
  const res = await api.get(`/deals/${params?.id}`, params ? { params } : {})
  return res.data
}

export async function update_deal(
  payload: Models.Deals_Update_deal_Request, 
  params?: Record<string, any>
): Promise<any> {
  const res = await api.put(`/deals/${params?.id}`, payload)
  return res.data
}

export async function delete_deal(
  payload?: void, 
  params?: Record<string, any>
): Promise<any> {
  const res = await api.delete(`/deals/${params?.id}`, params ? { params } : {})
  return res.data
}

export async function list_deals(
  payload?: void, 
  params?: Record<string, any>
): Promise<any> {
  const res = await api.get(`/deals`, { params: { ...params, paginate: true } })
  return res.data
}

export async function list_my_deals(
  payload?: void, 
  params?: Record<string, any>
): Promise<any> {
  const res = await api.get(`/deals/my`, { params: { ...params, paginate: true } })
  return res.data
}

export async function update_deal_status(
  payload: Models.Deals_Update_deal_status_Request, 
  params?: Record<string, any>
): Promise<any> {
  const res = await api.post(`/deals/${params?.id}/status`, payload)
  return res.data
}

export async function archive_deal(payload?: { reason?: string }, params?: Record<string, any>): Promise<any> {
  const res = await api.post(`/deals/${params?.id}/archive`, payload)
  return res.data
}

export async function unarchive_deal(payload?: void, params?: Record<string, any>): Promise<any> {
  const res = await api.post(`/deals/${params?.id}/unarchive`)
  return res.data
}