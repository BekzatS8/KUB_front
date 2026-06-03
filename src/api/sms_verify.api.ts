import api from './index'
import type * as Models from '@/src/models/sms_verify.model'

export async function send_sms(payload: Models.SMS_Verify_Send_SMS_Request, params?: Record<string, any>): Promise<any> {
  const res = await api.post(`/sms/send`, payload)
  return res.data
}

export async function resend_sms(payload: Models.SMS_Verify_Resend_SMS_Request, params?: Record<string, any>): Promise<any> {
  const res = await api.post(`/sms/resend`, payload)
  return res.data
}

export async function confirm_sms(payload: Models.SMS_Verify_Confirm_SMS_Request, params?: Record<string, any>): Promise<any> {
  const res = await api.post(`/sms/confirm`, payload)
  return res.data
}

export async function get_latest_sms(payload?: void, params?: Record<string, any>): Promise<any> {
  const res = await api.get(`/sms/latest/${params.document_id}`, { params })
  return res.data
}

export async function delete_sms(payload?: void, params?: Record<string, any>): Promise<any> {
  const res = await api.delete(`/sms/${params.document_id}`, { params })
  return res.data
}
