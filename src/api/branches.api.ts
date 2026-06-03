import api from './index'

export interface Branch {
  id: number
  name: string
  code: string
  is_active: boolean
  created_at?: string
  updated_at?: string
}

export interface CreateBranchRequest {
  name: string
  code: string
  is_active?: boolean
}

export interface UpdateBranchRequest {
  name?: string
  code?: string
  is_active?: boolean
}

export async function listBranches(params?: Record<string, any>): Promise<Branch[] | { data: Branch[]; total: number }> {
  const res = await api.get('/branches', { params })
  return res.data
}

export async function getBranchById(id: number): Promise<Branch> {
  const res = await api.get(`/branches/${id}`)
  return res.data
}

export async function createBranch(payload: CreateBranchRequest, params?: Record<string, any>): Promise<Branch> {
  const res = await api.post('/branches', payload, { params })
  return res.data
}

export async function updateBranch(payload: UpdateBranchRequest, params: Record<string, any>): Promise<Branch> {
  const res = await api.put(`/branches/${params.id}`, payload)
  return res.data
}

export async function deleteBranch(params: Record<string, any>): Promise<void> {
  await api.delete(`/branches/${params.id}`)
}
