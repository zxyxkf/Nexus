/**
 * Nexus 核心类型定义 — 前后端共用
 */

// ==================== API 响应 ====================

export interface ApiResponse<T = unknown> {
  code: number
  msg: string
  data?: T
}

export interface PaginatedResult<T> {
  list: T[]
  total: number
  page: number
  pageSize: number
  totalPages: number
}

// ==================== 用户 ====================

export type UserRole =
  | 'admin'
  | 'sub_admin'
  | 'operator'
  | 'cs_agent'
  | 'designer'
  | 'basic_designer'
  | 'operator_assistant'

export interface User {
  id: number
  username: string
  real_name: string
  role: UserRole
  status: number
  email?: string
  phone?: string
  remark?: string
  last_login_time?: string
  create_time: string
  update_time: string
}

export interface LoginPayload {
  username: string
  password: string
}

export interface LoginResult {
  token: string
  user: User
}

// ==================== 任务 ====================

export type TaskStatus =
  | 'wait'
  | 'accepted'
  | 'doing'
  | 'submitted'
  | 'finished'
  | 'rejected'

export type TaskGroup = 'design' | 'cs' | 'operator'

export type TaskPriority = 1 | 2 | 3

export interface Task {
  id: number
  task_no: string
  title: string
  description?: string
  priority: TaskPriority
  status: TaskStatus
  task_group: TaskGroup
  publisher_id: number
  publisher_name: string
  designer_id?: number
  designer_name?: string
  reject_reason?: string
  deadline?: string
  score_item_id?: number
  score_item_name?: string
  score?: number
  quantity: number
  actual_quantity?: number
  shop_name?: string
  wangwang_id?: string
  style_number?: string
  specified_color?: string
  ref_path?: string
  task_file_path?: string
  create_time: string
  update_time: string
  accept_time?: string
  submit_time?: string
  finish_time?: string
  publish_time?: string
}

export interface CreateTaskParams {
  title: string
  description?: string
  priority?: TaskPriority
  deadline?: string
  taskGroup?: TaskGroup
  scoreItemId?: number
  score?: number
  designerId?: number
  shopName?: string
  wangwangId?: string
  styleNumber?: string
  specifiedColor?: string
  quantity?: number
  refPath?: string
  taskFilePath?: string
}

// ==================== 文件 ====================

export type FileCategory = 'work' | 'reference' | 'attachment'

export interface TaskFile {
  id: number
  task_id: number
  file_name: string
  file_path: string
  file_size: number
  file_type: string
  mime_type: string
  file_category: FileCategory
  uploader_id: number
  create_time: string
}

// ==================== 积分 ====================

export interface ScoreItem {
  id: number
  name: string
  score: number
  task_group: TaskGroup
  status: number
}

export interface ScoreRecord {
  id: number
  user_id: number
  task_id: number
  score_item_id: number
  score: number
  create_time: string
}
