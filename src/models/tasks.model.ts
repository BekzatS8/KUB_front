export type Tasks_Create_task_Request = {
  title: string
  description: string
  entity_id: number
  entity_type: string
  assignee_id: number
  assignee_ids?: number[]
  due_date: string
  priority: string
}

export type Tasks_Create_task_Response = {
  id: number
  title: string
  status: string
}

export type Tasks_Update_task_Request = {
  title: string
  description: string
  entity_id: number
  entity_type: string
  assignee_id: number
  assignee_ids?: number[]
  due_date: string
  priority: string
}

export type Tasks_Change_task_status_Request = {
  to: string
  comment?: string
}

export type Tasks_Assign_task_Request = {
  assignee_id: number
}

export interface Task {
  id: number
  archived?: boolean | null
  is_archived?: boolean
  title: string
  description: string
  entity_id: number
  entity_type: string
  assignee_id: number
  assignee_ids?: number[]
  due_date: string
  priority: string
  status: string
  created_at?: string
  updated_at?: string
}
