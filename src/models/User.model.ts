export interface User {
  id: string | number
  first_name?: string
  last_name?: string
  middle_name?: string
  full_name?: string
  email: string
  phone?: string
  iin?: string
  address?: string
  extra_info?: string
  avatar_url?: string
  avatar?: {
    url?: string
    crop_x?: number | null
    crop_y?: number | null
    crop_scale?: number | null
    crop_size?: number | null
    has_original_image?: boolean
  }
  position?: string
  role: {
    id: number
    code: string
    legacy_name: string
  }
  branch?: {
    id: number
    name: string
    code: string
    is_active: boolean
  } | null
  is_active?: boolean
  is_verified?: boolean
  telegram?: {
    chat_id: number
    notify_tasks: boolean
  }
  legacy?: {
    company_name: string
    bin_iin: string
  }
  // Legacy fields for backward compatibility
  role_id?: number
  company_name?: string
  bin_iin?: string
  telegram_chat_id?: number
  notify_tasks_telegram?: boolean
  status?: string
  lastLogin?: string
  createdAt?: string
  firstName?: string
  lastName?: string
}

export interface CreateUserRequest {
  firstName: string
  lastName: string
  email: string
  phone?: string
  role?: string
}
