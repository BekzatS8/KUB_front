import api from './index';
import type * as Models from '@/src/models/users.model';

export async function createUser(payload: Models.CreateUserRequest): Promise<Models.User> {
  const res = await api.post('/users', payload);
  return res.data;
}

export async function getUsersCount(): Promise<Models.UserCount> {
  const res = await api.get('/users/count');
  return res.data;
}

export async function getUsersCountByRole(roleId: number): Promise<Models.UserCount> {
  const res = await api.get(`/users/count/role/${roleId}`);
  return res.data;
}

export async function listUsers(page?: number, limit?: number): Promise<Models.User[] | { data: Models.User[], total: number }> {
  const params: any = {};
  if (page) params.page = page;
  if (limit) params.limit = limit;
  const res = await api.get('/users', { params });
  return res.data;
}

export async function getUserById(id: string): Promise<Models.User> {
  const res = await api.get(`/users/${id}`);
  return res.data;
}

export async function updateUser(id: string, payload: Models.UpdateUserRequest): Promise<Models.User> {
  const res = await api.put(`/users/${id}`, payload);
  return res.data;
}

export async function deleteUser(id: string): Promise<void> {
  const res = await api.delete(`/users/${id}`);
  return res.data;
}