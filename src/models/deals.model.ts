export type Deals_Create_deal_Request = {
  lead_id?: number
  client_id?: number
  client_type?: string
  owner_id?: number
  funnel_id?: number | null
  amount: number
  prepayment?: number
  currency: string
  status: string
}

export type Deals_Update_deal_Request = {
  lead_id?: number
  client_id?: number
  client_type?: string
  owner_id?: number
  amount?: number
  prepayment?: number
  currency?: string
  status?: string
}

export type Deals_Update_deal_status_Request = {
  to: string
  comment?: string
}

export type Deals_Move_deal_stage_Request = {
  stage_id: number
  comment?: string
}

// Response types
export interface Deal {
  id: number
  archived?: boolean | null
  is_archived?: boolean
  lead_id?: number
  client_id?: number
  client_type?: string
  owner_id?: number
  funnel_id?: number | null
  stage_id?: number | null
  branch_id?: number | null
  amount: number
  prepayment?: number
  currency: string
  status: string
  created_at?: string
  updated_at?: string
}
