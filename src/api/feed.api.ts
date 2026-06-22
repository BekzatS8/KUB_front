import api from './index'
import type { CreateFeedEventRequest, FeedEvent } from '@/src/models/feed.model'

export async function createFeedEvent(payload: CreateFeedEventRequest): Promise<FeedEvent> {
  const res = await api.post('/feed-events', payload)
  return res.data
}

export async function listFeedEvents(params?: { status?: string; page?: number; size?: number }): Promise<{ items: FeedEvent[]; total: number }> {
  const res = await api.get('/feed-events', { params })
  return res.data
}

export async function approveFeedEvent(id: string): Promise<FeedEvent> {
  const res = await api.post(`/feed-events/${id}/approve`)
  return res.data
}

export async function rejectFeedEvent(id: string, reason?: string): Promise<FeedEvent> {
  const res = await api.post(`/feed-events/${id}/reject`, { reason })
  return res.data
}
