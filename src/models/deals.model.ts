export type Deals_Create_deal_Request = {
  lead_id?: number
  client_id?: number
  client_type?: string
  owner_id?: number
  funnel_id?: number | null
  amount: number
  currency: string
  status: string
}

export type Deals_Update_deal_Request = {
  lead_id?: number
  client_id?: number
  client_type?: string
  owner_id?: number
  amount?: number
  currency?: string
  status?: string
}

export type Deals_Update_deal_status_Request = {
  to: string
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
  amount: number
  currency: string
  status: string
  created_at?: string
  updated_at?: string
}
