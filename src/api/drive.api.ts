import api from './index'

export type DrivePreviewKind = 'image' | 'pdf' | 'video' | 'audio' | 'text' | 'office' | ''

export interface DriveNode {
  id: number
  parent_id: number | null
  kind: 'folder' | 'file'
  name: string
  size_bytes: number
  mime_type: string
  created_by?: number
  created_by_name?: string
  created_at: string
  updated_at: string
  /** Сколько пользователей имеют доступ к узлу (только для администратора). */
  shares_count?: number
  children_count?: number
  /** Срок доступа, по которому пользователь видит узел. Нет поля — бессрочно. */
  share_expires_at?: string
  preview?: DrivePreviewKind
}

export interface DriveBreadcrumb {
  id: number
  name: string
}

export interface DriveListing {
  folder: DriveNode | null
  items: DriveNode[]
  breadcrumbs: DriveBreadcrumb[]
  can_manage: boolean
  /** Пользователь видит не всё хранилище, а только открытое ему. */
  shared_view: boolean
  total_bytes?: number
  total_files?: number
}

export interface DriveShare {
  id: number
  node_id: number
  user_id: number
  user_name: string
  user_email?: string
  expires_at: string | null
  expired: boolean
  created_by_name?: string
  created_at: string
}

export interface DriveUser {
  id: number
  name: string
  email: string
  role_id: number
}

export async function listDrive(parentId: number | null): Promise<DriveListing> {
  const res = await api.get('/api/v1/drive/nodes', {
    params: parentId ? { parent_id: parentId } : undefined,
  })
  return res.data
}

export async function createDriveFolder(parentId: number | null, name: string): Promise<DriveNode> {
  const res = await api.post('/api/v1/drive/folders', { parent_id: parentId, name })
  return res.data
}

export async function uploadDriveFile(
  parentId: number | null,
  file: File,
  onProgress?: (loaded: number, total: number) => void,
  signal?: AbortSignal,
): Promise<DriveNode> {
  const form = new FormData()
  if (parentId) form.append('parent_id', String(parentId))
  form.append('file', file, file.name)
  const res = await api.post('/api/v1/drive/files', form, {
    // Общий таймаут клиента — 30 секунд: большой файл за это время не
    // успеет загрузиться, поэтому для загрузки он отключён.
    timeout: 0,
    signal,
    onUploadProgress: (e) => onProgress?.(e.loaded, e.total ?? file.size),
  })
  return res.data
}

export async function renameDriveNode(id: number, name: string): Promise<DriveNode> {
  const res = await api.patch(`/api/v1/drive/nodes/${id}`, { name })
  return res.data
}

export async function deleteDriveNode(id: number): Promise<{ files_removed: number }> {
  const res = await api.delete(`/api/v1/drive/nodes/${id}`, { timeout: 120000 })
  return res.data
}

export async function listDriveShares(id: number): Promise<DriveShare[]> {
  const res = await api.get(`/api/v1/drive/nodes/${id}/shares`)
  return res.data?.items ?? []
}

/** expiresAt = null — бессрочно. */
export async function shareDriveNode(id: number, userIds: number[], expiresAt: string | null): Promise<DriveShare[]> {
  const res = await api.post(`/api/v1/drive/nodes/${id}/shares`, { user_ids: userIds, expires_at: expiresAt })
  return res.data?.items ?? []
}

export async function revokeDriveShare(shareId: number): Promise<void> {
  await api.delete(`/api/v1/drive/shares/${shareId}`)
}

export async function listDriveUsers(): Promise<DriveUser[]> {
  const res = await api.get('/api/v1/drive/users')
  return res.data?.items ?? []
}

/**
 * Временная ссылка на содержимое файла (живёт час).
 *
 * Ссылка ведёт напрямую на API, минуя прокси Next.js: прокси проставляет
 * X-Frame-Options: DENY, и PDF во встроенном окне просмотра не открылся бы,
 * а крупные файлы и видео не должны идти через лишний узел.
 */
export async function getDriveLink(
  id: number,
  opts: { variant?: 'original' | 'pdf'; download?: boolean } = {},
): Promise<string> {
  const res = await api.get(`/api/v1/drive/nodes/${id}/link`, {
    params: {
      variant: opts.variant ?? 'original',
      disposition: opts.download ? 'attachment' : 'inline',
    },
  })
  return driveApiUrl(res.data.url)
}

function driveApiUrl(path: string): string {
  let base = process.env.NEXT_PUBLIC_API_BASE_URL || 'https://api.kubcrm.kz'
  // На https-странице ссылка на http заблокировалась бы как смешанный контент.
  if (typeof window !== 'undefined' && window.location.protocol === 'https:') {
    base = base.replace(/^http:\/\//i, 'https://')
  }
  return base.replace(/\/+$/, '') + path
}

/** Текст ошибки из ответа API для показа пользователю. */
export function driveErrorMessage(err: any, fallback: string): string {
  const status = err?.response?.status
  if (status === 413) return 'Файл слишком большой'
  return err?.response?.data?.message || fallback
}
