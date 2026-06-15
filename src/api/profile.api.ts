import api from './index'
import type { User } from '@/src/models/users.model'

export interface UpdateProfileRequest {
  first_name?: string
  last_name?: string
  middle_name?: string
  iin?: string
  phone?: string
  address?: string
  extra_info?: string
}

export interface AvatarCropRequest {
  crop_x?: number
  crop_y?: number
  crop_scale?: number
  crop_size?: number
}

export async function getProfile(): Promise<User> {
  const res = await api.get('/profile')
  return res.data
}

export async function updateProfile(payload: UpdateProfileRequest): Promise<User> {
  const res = await api.patch('/profile', payload)
  return res.data
}

export async function uploadAvatar(file: File): Promise<User> {
  const formData = new FormData()
  formData.append('file', file)
  const res = await api.post('/profile/avatar', formData)
  return res.data
}

export async function updateAvatarCrop(payload: AvatarCropRequest): Promise<User> {
  const res = await api.patch('/profile/avatar/crop', payload)
  return res.data
}

export async function deleteAvatar(): Promise<User> {
  const res = await api.delete('/profile/avatar')
  return res.data
}

export async function loadProtectedImage(path?: string | null): Promise<string | null> {
  if (!path) return null
  const res = await api.get(path, { responseType: 'blob' })
  return URL.createObjectURL(res.data)
}
