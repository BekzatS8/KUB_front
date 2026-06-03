import api from './index';
import type * as Models from '@/src/models/roles.model';

export async function createRole(payload: Models.CreateRoleRequest): Promise<Models.Role> {
  const res = await api.post('/roles', payload);
  return res.data;
}

export async function getRolesCount(): Promise<Models.RoleCount> {
  const res = await api.get('/roles/count');
  return res.data;
}

export async function listRolesWithUserCounts(params?: { page?: number; limit?: number; search?: string }): Promise<Models.RoleWithUserCount[] | { data: Models.RoleWithUserCount[]; total: number }> {
  const res = await api.get('/roles/with-user-counts', { params });
  return res.data;
}

export async function listRoles(params?: { page?: number; limit?: number; search?: string }): Promise<Models.Role[] | { data: Models.Role[]; total: number }> {
  const res = await api.get('/roles', { params });
  return res.data;
}

export async function getRoleById(id: number): Promise<Models.Role> {
  const res = await api.get(`/roles/${id}`);
  return res.data;
}

export async function updateRole(id: number, payload: Models.UpdateRoleRequest): Promise<Models.Role> {
  const res = await api.put(`/roles/${id}`, payload);
  return res.data;
}

export async function deleteRole(id: number): Promise<void> {
  const res = await api.delete(`/roles/${id}`);
  return res.data;
}