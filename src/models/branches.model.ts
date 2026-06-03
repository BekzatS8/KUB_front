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
