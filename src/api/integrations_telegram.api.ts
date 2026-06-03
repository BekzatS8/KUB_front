import api from './index'
import type * as Models from '@/src/models/integrations_telegram.model'

export async function telegram_webhook(payload: Models.Integrations_Telegram_Telegram_webhook_Request, params?: Record<string, any>): Promise<any> {
  const res = await api.post(`/integrations/telegram/webhook`, payload)
  return res.data
}

export async function confirm_telegram_link(payload?: void, params?: Record<string, any>): Promise<any> {
  const res = await api.get(`/integrations/telegram/link`, { params })
  return res.data
}

export async function request_telegram_link(payload?: void, params?: Record<string, any>): Promise<any> {
  const res = await api.post(`/integrations/telegram/request-link`, payload)
  return res.data
}
