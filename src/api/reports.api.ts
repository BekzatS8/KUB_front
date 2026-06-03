import api from './index'
import type * as Models from '@/src/models/reports.model'

export async function funnel(params?: Models.ReportsRequest): Promise<Models.SalesFunnelResponse> {
  const res = await api.get(`/reports/funnel`, { params })
  return res.data
}

export async function leads_summary(params?: Models.ReportsRequest): Promise<Models.LeadsSummaryResponse> {
  const res = await api.get(`/reports/leads`, { params })
  return res.data
}

export async function revenue(params?: Models.ReportsRequest): Promise<Models.RevenueResponse> {
  const res = await api.get(`/reports/revenue`, { params })
  return res.data
}

export async function revenue_export(params?: Models.ReportsRequest): Promise<Models.RevenueResponse> {
  const res = await api.get(`/reports/revenue/export`, { params })
  return res.data
}

export async function revenue_export_file(params?: Models.ReportsRequest): Promise<Blob> {
  const res = await api.get(`/reports/revenue/export`, { params, responseType: 'blob' as const })
  return res.data
}
