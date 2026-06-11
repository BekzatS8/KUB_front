import type { Branch } from "@/src/models/branches.model"
import type { Department } from "@/src/models/permissions.model"

export interface Funnel {
  id: number
  name: string
  code: string
  department_id: number
  department?: Department
  branch_id?: number | null
  branch?: Branch | null
  is_active: boolean
  sort_order: number
  created_by?: number | null
  created_at?: string
  updated_at?: string
}

export interface UpsertFunnelRequest {
  name: string
  code: string
  department_id: number
  branch_id?: number | null
  is_active?: boolean
  sort_order?: number
}
