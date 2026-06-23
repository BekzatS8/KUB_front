import api from './index';
import type * as Models from '@/src/models/users.model';

function translateUserError(error: any, fallback: string) {
  const status = error?.response?.status;
  const data = error?.response?.data;
  const raw =
    (typeof data === 'string' && data) ||
    data?.message ||
    data?.error ||
    data?.detail ||
    error?.message ||
    fallback;
  const message = String(raw).trim();
  const lower = message.toLowerCase();

  if (/[А-Яа-яЁё]/.test(message)) return message;
  if (lower.includes('branch_id') || lower.includes('branch')) return 'Выберите филиал.';
  if (lower.includes('email already')) return 'Этот email уже используется.';
  if (lower.includes('invalid role')) return 'Некорректная роль.';
  if (lower.includes('phone')) return 'Телефон должен быть в международном формате, например +77001234567.';
  if (status === 403 || lower.includes('forbidden')) return 'У вас нет прав для выполнения этого действия.';
  if (status === 401 || lower.includes('unauthorized')) return 'Сессия истекла. Войдите в систему заново.';
  if (status && status >= 500) return 'Ошибка сервера. Попробуйте еще раз или обратитесь к администратору.';
  return fallback;
}

export async function createUser(payload: Models.CreateUserRequest): Promise<Models.User | { pending: boolean; request_id: number; message: string }> {
  try {
    const res = await api.post('/users', payload);
    return res.data;
  } catch (error: any) {
    throw new Error(translateUserError(error, 'Не удалось создать пользователя.'));
  }
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

export async function updateUser(id: string, payload: Models.UpdateUserRequest): Promise<Models.User | { pending: boolean; request_id: number; message: string }> {
  try {
    const res = await api.put(`/users/${id}`, payload);
    return res.data;
  } catch (error: any) {
    throw new Error(translateUserError(error, 'Не удалось обновить пользователя.'));
  }
}

export async function deleteUser(id: string): Promise<{ pending?: boolean; message?: string } | void> {
  try {
    const res = await api.delete(`/users/${id}`);
    return res.data;
  } catch (error: any) {
    throw new Error(translateUserError(error, 'Не удалось удалить пользователя.'));
  }
}

export async function changeUserPassword(id: string, password: string): Promise<void> {
  try {
    await api.put(`/users/${id}/password`, { password });
  } catch (error: any) {
    throw new Error(translateUserError(error, 'Не удалось изменить пароль.'));
  }
}
