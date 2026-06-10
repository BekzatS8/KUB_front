export type Auth_Login_Response = {
  message: string
  tokens: {
    access_token: string
    refresh_token: string
  }
  user: {
    id: number
    full_name: string
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
    is_active: boolean
    is_verified: true
    branch: {
      id: number
      code: string
      name: string
      is_active: boolean
    }
    legacy: {
      company_name: string
      bin_iin: string
    }
    role: {
      id: number
      code: string
      legacy_name: string
    }
    telegram: {
      chat_id: number
      notify_tasks: boolean
    }
  }
}

export type Auth_Login_Request = {
  email: string
  password: string
}

export type Auth_Refresh_token_Request = {
  refresh_token: string
}

export type Auth_Forgot_password_Request = {
  email: string
}

export type Auth_Reset_password_Request = {
  token: string
  password: string
}

export type Auth_Register_Request = {
  company_name: string
  bin_iin: string
  email: string
  password: string
  phone: string
  role_id: number
}

export type Auth_Register_Response = {
  message: string
  user: {
    id: number
    company_name: string
    bin_iin: string
    email: string
    role_id: number
    phone: string
    is_verified: boolean
    telegram_chat_id: number
    notify_tasks_telegram: boolean
  }
}

export type Auth_Confirm_registration_Request = {
  user_id: number
  code: string
}

export type Auth_Resend_confirmation_Request = {
  user_id: number
  phone: string
}
