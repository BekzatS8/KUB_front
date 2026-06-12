import api from './index'
import type { Organization, UpdateOrganizationRequest } from '@/src/models/organization.model'

export async function getOrganization(): Promise<Organization> {
  const res = await api.get('/api/v1/organization')
  return res.data
}

export async function updateOrganization(payload: UpdateOrganizationRequest): Promise<Organization> {
  const res = await api.put('/api/v1/organization', payload)
  return res.data
}
