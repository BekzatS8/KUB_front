export type FeedEventType =
  | 'pending_create_lead'
  | 'pending_edit_lead'
  | 'pending_delete_lead'
  | 'pending_create_deal'
  | 'pending_edit_deal'
  | 'pending_delete_deal'
  | 'pending_create_client'
  | 'pending_edit_client'
  | 'pending_delete_client'
  | 'pending_create_document'
  | 'pending_edit_document'
  | 'pending_delete_document'
  | 'pending_send_document'

export type FeedEventStatus = 'pending' | 'approved' | 'rejected'

export interface FeedEvent {
  id: string
  type: FeedEventType
  status: FeedEventStatus
  requestor_id: number
  requestor_name: string
  payload: Record<string, any>
  resource_id?: number | string
  created_at: string
  updated_at?: string
  reject_reason?: string
  admin_name?: string
}

export interface CreateFeedEventRequest {
  type: FeedEventType
  payload: Record<string, any>
  resource_id?: number | string
}

export interface ApproveFeedEventRequest {
  id: string
}

export interface RejectFeedEventRequest {
  id: string
  reason?: string
}
