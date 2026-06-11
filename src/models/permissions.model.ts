import type { Branch } from "@/src/models/branches.model"

export interface Department {
  id: number
  name: string
  code: string
  is_active: boolean
}

export interface PermissionAssignment {
  action: string
  scope: string
}

export interface PermissionsMe {
  role: {
    id: number
    name?: string
    code: string
    legacy_code?: string
  }
  department?: Department | null
  branch?: Branch | null
  permissions: PermissionAssignment[]
  scopes: Record<string, string>
  menu_sections: string[]
}
