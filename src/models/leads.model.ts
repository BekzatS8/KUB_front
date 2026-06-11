export type Leads_Create_lead_Request = {
  title: string
  description: string
  owner_id: number
  funnel_id?: number | null
  status: string
}

export type Leads_Update_lead_Request = {
  title: string
  description: string
  owner_id: number
  status: string
}

export type Leads_Convert_lead_to_deal_Request = {
  amount: string
  currency: string
  client_name: string
  client_bin_iin: string
  client_address: string
  client_contact_info: string
}

export type Leads_Assign_lead_Request = {
  assignee_id: number
  comment: string
}

export type Leads_Update_lead_status_Request = {
  to: string
  comment: string
}

export interface Lead {
  id: number
  archived?: boolean | null
  is_archived?: boolean
  title: string
  description: string
  owner_id: number
  funnel_id?: number | null
  status: string
  created_at?: string
  updated_at?: string
}
