export interface User {
  id: string | number;
  first_name?: string;
  last_name?: string;
  middle_name?: string;
  full_name?: string;
  email: string;
  phone: string;
  position?: string;
  role: {
    id: number;
    code: string;
    legacy_name: string;
  };
  branch?: {
    id: number;
    name: string;
    code: string;
    is_active: boolean;
  } | null;
  is_active?: boolean;
  is_verified: boolean;
  telegram?: {
    chat_id: number;
    notify_tasks: boolean;
  };
  legacy?: {
    company_name: string;
    bin_iin: string;
  };
  // Legacy fields for backward compatibility
  role_id?: number;
  company_name?: string;
  bin_iin?: string;
  notify_tasks_telegram?: boolean;
  telegram_chat_id?: number;
  created_at?: string;
  updated_at?: string;
}

export interface CreateUserRequest {
  first_name?: string;
  last_name?: string;
  middle_name?: string;
  email: string;
  password?: string;
  phone: string;
  role_id: number;
  branch_id?: number;
  position?: string;
  is_active?: boolean;
  is_verified?: boolean;
  // Legacy fields for backward compatibility
  company_name?: string;
  bin_iin?: string;
  notify_tasks_telegram?: boolean;
  telegram_chat_id?: number;
}

export interface UpdateUserRequest {
  first_name?: string;
  last_name?: string;
  middle_name?: string;
  email?: string;
  phone?: string;
  role_id?: number;
  branch_id?: number;
  position?: string;
  is_active?: boolean;
  is_verified?: boolean;
  // Legacy fields for backward compatibility
  company_name?: string;
  bin_iin?: string;
  notify_tasks_telegram?: boolean;
  telegram_chat_id?: number;
}

export interface UserCount {
  count: number;
}