export interface Organization {
  id: number
  name: string
  legal_name?: string
  bin?: string
  phone?: string
  email?: string
  address?: string
  website?: string
  whatsapp?: string
  telegram?: string
  instagram?: string
  tiktok?: string
  logo_url?: string
  created_at?: string
  updated_at?: string
}

export interface UpdateOrganizationRequest {
  name?: string
  legal_name?: string
  bin?: string
  phone?: string
  email?: string
  address?: string
  website?: string
  whatsapp?: string
  telegram?: string
  instagram?: string
  tiktok?: string
  logo_url?: string
}
