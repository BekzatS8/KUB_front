import api from './index'

export interface UserApprovalRequest {
  id: number
  requester_id: number
  requester_name: string
  action: 'create' | 'delete'
  target_user_id?: number
  target_user_name?: string
  request_data?: Record<string, any>
  status: 'pending' | 'approved' | 'rejected'
  reviewer_id?: number
  reviewer_name?: string
  reject_reason?: string
  reviewed_at?: string
  created_at: string
}

export async function listUserRequests(params?: { status?: string; page?: number; size?: number }): Promise<{ data: UserApprovalRequest[] }> {
  const res = await api.get('/api/v1/user-requests', { params })
  return res.data
}

export async function listMyUserRequests(params?: { page?: number; size?: number }): Promise<{ data: UserApprovalRequest[] }> {
  const res = await api.get('/api/v1/user-requests/my', { params })
  return res.data
}

export async function approveUserRequest(id: number): Promise<void> {
  await api.post(`/api/v1/user-requests/${id}/approve`)
}

export async function rejectUserRequest(id: number, reason?: string): Promise<void> {
  await api.post(`/api/v1/user-requests/${id}/reject`, { reason: reason || '' })
}
