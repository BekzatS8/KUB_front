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
  /** Можно менять содержимое этой папки (администратор или доступ «редактирование»). */
  can_edit?: boolean
  /** Пользователь видит не всё хранилище, а только открытое ему. */
  shared_view: boolean
  total_bytes?: number
  total_files?: number
}

/** Кому выдан доступ: сотруднику, филиалу, отделу или всем. */
export type DriveShareTarget = 'user' | 'branch' | 'department' | 'all'

/** view — смотреть и скачивать; edit — ещё и работать внутри папки. */
export type DriveShareAccess = 'view' | 'edit'

export interface DriveShare {
  id: number
  node_id: number
  target: DriveShareTarget
  access?: DriveShareAccess
  /** ФИО сотрудника или название группы. */
  label: string
  branch_id?: number
  department_id?: number
  /** 0 у доступа группе. */
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

// Файлы больше этого размера уходят частями: nginx перед сайтом и API
// пропускает запрос до ~50 МБ, прокси Next.js — до 10 МБ. Кусок по 8 МБ
// проходит везде, поэтому размер файла ограничен только хранилищем
// (у администратора хранилища — ничем).
const DRIVE_CHUNK_THRESHOLD = 8 * 1024 * 1024

export async function uploadDriveFile(
  parentId: number | null,
  file: File,
  onProgress?: (loaded: number, total: number) => void,
  signal?: AbortSignal,
): Promise<DriveNode> {
  if (file.size > DRIVE_CHUNK_THRESHOLD) {
    return uploadDriveFileChunked(parentId, file, onProgress, signal)
  }
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

// Загрузка частями: начало → куски по порядку → завершение. Оборвавшийся
// кусок повторяется до 3 раз; при отмене сервер удаляет недогруженное.
async function uploadDriveFileChunked(
  parentId: number | null,
  file: File,
  onProgress?: (loaded: number, total: number) => void,
  signal?: AbortSignal,
): Promise<DriveNode> {
  const start = await api.post('/api/v1/drive/uploads', {
    parent_id: parentId,
    name: file.name,
    size: file.size,
    content_type: file.type || '',
  }, { signal })
  const uploadId: string = start.data.upload_id
  const chunkSize: number = Number(start.data.chunk_size) || DRIVE_CHUNK_THRESHOLD

  try {
    let offset = 0
    while (offset < file.size) {
      const chunk = file.slice(offset, Math.min(offset + chunkSize, file.size))
      let attempt = 0
      for (;;) {
        try {
          const res = await api.put(`/api/v1/drive/uploads/${uploadId}`, chunk, {
            params: { offset },
            headers: { 'Content-Type': 'application/octet-stream' },
            timeout: 0,
            signal,
            onUploadProgress: (e) => onProgress?.(offset + (e.loaded || 0), file.size),
          })
          offset = Number(res.data?.received ?? offset + chunk.size)
          break
        } catch (err: any) {
          if (signal?.aborted) throw err
          // Сервер уже принял больше (ответ потерялся) — продолжаем с его позиции.
          if (err?.response?.status === 409 && typeof err.response.data?.received === 'number') {
            offset = err.response.data.received
            break
          }
          const status = err?.response?.status
          const retriable = !status || status >= 500
          if (!retriable || ++attempt >= 3) throw err
          await new Promise((r) => setTimeout(r, 1000 * attempt))
        }
      }
      onProgress?.(offset, file.size)
    }
    const done = await api.post(`/api/v1/drive/uploads/${uploadId}/complete`, {}, { timeout: 0, signal })
    return done.data
  } catch (err) {
    api.delete(`/api/v1/drive/uploads/${uploadId}`).catch(() => {})
    throw err
  }
}

export async function renameDriveNode(id: number, name: string): Promise<DriveNode> {
  const res = await api.patch(`/api/v1/drive/nodes/${id}`, { name })
  return res.data
}

/** Переносит в корзину — восстановить можно оттуда. */
export async function deleteDriveNode(id: number): Promise<{ trashed: number }> {
  const res = await api.delete(`/api/v1/drive/nodes/${id}`)
  return res.data
}

/** В корзину несколько элементов сразу — одно событие в Ленте. */
export async function deleteDriveNodes(ids: number[]): Promise<{ trashed: number }> {
  const res = await api.post('/api/v1/drive/delete', { ids })
  return res.data
}

// ── Корзина ─────────────────────────────────────────────────────────────────

export interface DriveTrashItem {
  id: number
  kind: 'folder' | 'file'
  name: string
  mime_type: string
  parent_id: number | null
  /** Папка, откуда удалили; пусто — корень. */
  parent_name?: string
  /** Исходную папку тоже удалили — восстановится в корень. */
  parent_trashed?: boolean
  /** Всё, что удалено вместе с записью. */
  size_bytes: number
  files: number
  deleted_at: string
  deleted_by_name?: string
}

export async function listDriveTrash(): Promise<{ items: DriveTrashItem[]; total_bytes: number }> {
  const res = await api.get('/api/v1/drive/trash')
  return { items: res.data?.items ?? [], total_bytes: res.data?.total_bytes ?? 0 }
}

export async function restoreDriveNodes(ids: number[]): Promise<{ restored: number }> {
  const res = await api.post('/api/v1/drive/trash/restore', { ids })
  return res.data
}

/** Удалить навсегда — записи и файлы в хранилище, без возможности вернуть. */
export async function purgeDriveNodes(ids: number[]): Promise<{ files_removed: number }> {
  const res = await api.post('/api/v1/drive/trash/purge', { ids }, { timeout: 300000 })
  return res.data
}

export async function emptyDriveTrash(): Promise<{ files_removed: number }> {
  const res = await api.delete('/api/v1/drive/trash', { timeout: 600000 })
  return res.data
}

export async function listDriveShares(id: number): Promise<DriveShare[]> {
  const res = await api.get(`/api/v1/drive/nodes/${id}/shares`)
  return res.data?.items ?? []
}

/** Кому открыть доступ. Группа (филиал, отдел, все) проверяется в момент
 *  доступа — новые сотрудники группы получают его сами. */
export interface DriveShareTargets {
  userIds?: number[]
  branchIds?: number[]
  departmentIds?: number[]
  all?: boolean
  access?: DriveShareAccess
}

/** expiresAt = null — бессрочно. */
export async function shareDriveNode(
  id: number,
  to: DriveShareTargets,
  expiresAt: string | null,
): Promise<DriveShare[]> {
  const res = await api.post(`/api/v1/drive/nodes/${id}/shares`, {
    user_ids: to.userIds ?? [],
    branch_ids: to.branchIds ?? [],
    department_ids: to.departmentIds ?? [],
    all: !!to.all,
    access: to.access ?? 'edit',
    expires_at: expiresAt,
  })
  return res.data?.items ?? []
}

export interface DriveShareGroup {
  id: number
  name: string
  /** Активных сотрудников в группе. */
  members: number
}

export async function listDriveShareGroups(): Promise<{ branches: DriveShareGroup[]; departments: DriveShareGroup[] }> {
  const res = await api.get('/api/v1/drive/groups')
  return { branches: res.data?.branches ?? [], departments: res.data?.departments ?? [] }
}

// ── Переместить, копировать, свойства, отправить ────────────────────────────

/** targetId = null — корень хранилища. При совпадении имени элемент получает номер. */
export async function moveDriveNodes(ids: number[], targetId: number | null): Promise<{ moved: number }> {
  const res = await api.post('/api/v1/drive/move', { ids, target_id: targetId })
  return res.data
}

/** Копия папки — со всем содержимым; доступы не копируются. */
export async function copyDriveNodes(ids: number[], targetId: number | null): Promise<{ copied: number }> {
  // Большие папки копируются долго: объекты переписываются в хранилище.
  const res = await api.post('/api/v1/drive/copy', { ids, target_id: targetId }, { timeout: 600000 })
  return res.data
}

export interface DriveProperties {
  node: DriveNode
  path: DriveBreadcrumb[]
  /** Только у папки — содержимое всех уровней. */
  total_bytes?: number
  files?: number
  folders?: number
}

export async function getDriveProperties(id: number): Promise<DriveProperties> {
  const res = await api.get(`/api/v1/drive/nodes/${id}/properties`)
  return res.data
}

export type DriveSendChannel = 'whatsapp' | 'telegram' | 'instagram' | 'email'

export interface DriveSendRequest {
  ids: number[]
  channel: DriveSendChannel
  /** Телефон / username или адрес почты. */
  to: string
  /** Номер Wazzup, с которого писать; пусто — подберётся. */
  channel_id?: string
  text?: string
  subject?: string
}

/** Файлы клиенту через мессенджер CRM или на почту. */
export async function sendDriveFiles(req: DriveSendRequest): Promise<{ sent: number }> {
  const res = await api.post(
    '/api/v1/drive/send',
    // Мессенджер скачивает файл по ссылке на API из интернета — сервер
    // использует этот адрес, если у него не задан свой (API_PUBLIC_URL).
    { ...req, api_base_url: process.env.NEXT_PUBLIC_API_BASE_URL || '' },
    { timeout: 120000 },
  )
  return res.data
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
