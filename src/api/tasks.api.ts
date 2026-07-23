import api from './index'
import type * as Models from '@/src/models/tasks.model'

export async function create_task(payload: Models.Tasks_Create_task_Request, params?: Record<string, any>): Promise<Models.Tasks_Create_task_Response> {
  const res = await api.post(`/tasks`, payload)
  return res.data
}

export async function list_tasks(payload?: void, params?: Record<string, any>): Promise<any> {
  const res = await api.get(`/tasks`, { params: { ...params, paginate: true } })
  return res.data
}

export async function list_my_tasks(payload?: void, params?: Record<string, any>): Promise<any> {
  const res = await api.get(`/tasks/my`, { params: { ...params, paginate: true } })
  return res.data
}

export async function get_task(payload?: void, params?: Record<string, any>): Promise<any> {
  const res = await api.get(`/tasks/${params?.id}`, params ? { params } : {})
  return res.data
}

export async function update_task(payload: Models.Tasks_Update_task_Request, params?: Record<string, any>): Promise<any> {
  const res = await api.put(`/tasks/${params?.id}`, payload)
  return res.data
}

export async function delete_task(payload?: void, params?: Record<string, any>): Promise<any> {
  const res = await api.delete(`/tasks/${params?.id}`, params ? { params } : {})
  return res.data
}

export async function change_task_status(payload: Models.Tasks_Change_task_status_Request, params?: Record<string, any>): Promise<any> {
  const res = await api.post(`/tasks/${params?.id}/status`, payload)
  return res.data
}

export async function assign_task(payload: Models.Tasks_Assign_task_Request, params?: Record<string, any>): Promise<any> {
  const res = await api.post(`/tasks/${params?.id}/assign`, payload)
  return res.data
}

export async function complete_task(payload?: void, params?: Record<string, any>): Promise<any> {
  const res = await api.post(`/tasks/${params?.id}/complete`, payload)
  return res.data
}

export async function remind_later(payload?: void, params?: Record<string, any>): Promise<any> {
  const res = await api.post(`/tasks/${params?.id}/remind-later`, payload)
  return res.data
}

export async function archive_task(payload?: { reason?: string }, params?: Record<string, any>): Promise<any> {
  const res = await api.post(`/tasks/${params?.id}/archive`, payload)
  return res.data
}

export async function unarchive_task(payload?: void, params?: Record<string, any>): Promise<any> {
  const res = await api.post(`/tasks/${params?.id}/unarchive`)
  return res.data
}

// Корзина (мягкое удаление): восстановление и окончательное удаление.
export async function restore_task(payload?: void, params?: Record<string, any>): Promise<any> {
  const res = await api.post(`/tasks/${params?.id}/restore`)
  return res.data
}

export async function purge_task(payload?: void, params?: Record<string, any>): Promise<any> {
  const res = await api.delete(`/tasks/${params?.id}/purge`)
  return res.data
}

export async function getMyNewTaskCount(userId: number): Promise<number> {
  const res = await api.get(`/tasks`, {
    params: { paginate: true, status: 'new', per_page: 1, assignee_id: userId },
  })
  return res.data?.pagination?.total ?? 0
}

// Назойливые уведомления о задачах (ТЗ 04.07.2026, п.4.1)
export async function get_task_notifications(): Promise<{ open_count: number; due: any[] }> {
  const res = await api.get(`/tasks/notifications`)
  return res.data
}

export async function ack_task_notifications(payload: { task_ids: number[] }): Promise<any> {
  const res = await api.post(`/tasks/notifications/ack`, payload)
  return res.data
}
