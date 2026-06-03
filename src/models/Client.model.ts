export interface Client {
  id: string | number
  name: string
  contactPerson?: string
  email?: string
  phone?: string
  status?: string
  city?: string
  lastContact?: string
  deals?: number
  revenue?: string
}

export interface CreateClientRequest {
  name: string
  contactPerson?: string
  email?: string
  phone?: string
  address?: string
  city?: string
  website?: string
  industry?: string
  description?: string
  status?: string
}
