import api from './index'
import type * as Models from '@/src/models/chat.model'

export async function getChats(): Promise<Models.Chat[]> {
  const res = await api.get(`/chats`)
  return res.data
}

export async function getMessages(chatId: number, limit: number, offset: number): Promise<Models.Message[]> {
  const res = await api.get(`/chats/${chatId}/messages?limit=${limit}&offset=${offset}`)
  return res.data
}

export async function sendMessage(chatId: number, payload: Models.SendMessageRequest): Promise<Models.Message> {
  const res = await api.post(`/chats/${chatId}/messages`, payload)
  return res.data
}

export async function markAsRead(chatId: number): Promise<void> {
  await api.post(`/chats/${chatId}/read`);
}

export async function searchChats(query: string): Promise<Models.Chat[]> {
  const res = await api.get(`/chats/search?query=${query}`)
  return res.data
}

export async function searchMessages(chatId: number, query: string): Promise<Models.Message[]> {
  const res = await api.get(`/chats/${chatId}/search?query=${query}`)
  return res.data
}

export async function createPersonalChat(payload: Models.CreatePersonalChatRequest): Promise<Models.Chat> {
  const res = await api.post(`/chats/personal`, payload)
  return res.data
}

export async function createGroupChat(payload: Models.CreateGroupChatRequest): Promise<Models.Chat> {
  const res = await api.post(`/chats/group`, payload)
  return res.data
}

export async function addMembers(chatId: number, payload: Models.AddMembersRequest): Promise<any> {
  const res = await api.post(`/chats/${chatId}/add-members`, payload)
  return res.data
}

export async function leaveChat(chatId: number): Promise<any> {
  const res = await api.post(`/chats/${chatId}/leave`)
  return res.data
}

export async function deleteChat(chatId: number): Promise<any> {
  const res = await api.delete(`/chats/${chatId}`)
  return res.data
}

export async function uploadAttachment(chatId: number, file: File): Promise<{ url: string }> {
  const formData = new FormData();
  formData.append('file', file);
  const res = await api.post(`/chats/${chatId}/upload`, formData, { headers: { 'Content-Type': 'multipart/form-data' } })
  return res.data
}