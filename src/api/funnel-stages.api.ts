import api from "./index"
import type {
  FunnelStage,
  UpsertFunnelStageRequest,
  FunnelBoard,
} from "@/src/models/funnel-stages.model"

export async function listFunnelStages(funnelId: number): Promise<FunnelStage[]> {
  const res = await api.get(`/funnels/${funnelId}/stages`)
  return res.data
}

export async function createFunnelStage(
  funnelId: number,
  payload: UpsertFunnelStageRequest
): Promise<FunnelStage> {
  const res = await api.post(`/funnels/${funnelId}/stages`, payload)
  return res.data
}

export async function updateFunnelStage(
  id: number,
  payload: UpsertFunnelStageRequest
): Promise<FunnelStage> {
  const res = await api.patch(`/stages/${id}`, payload)
  return res.data
}

export async function deleteFunnelStage(id: number, reassignToStageId?: number): Promise<void> {
  await api.delete(`/stages/${id}`, {
    params: reassignToStageId ? { reassign_to_stage_id: reassignToStageId } : undefined,
  })
}

export async function reorderFunnelStages(funnelId: number, ids: number[]): Promise<void> {
  await api.patch(`/funnels/${funnelId}/stages/reorder`, { ids })
}

export async function duplicateFunnelStage(id: number): Promise<FunnelStage> {
  const res = await api.post(`/stages/${id}/duplicate`)
  return res.data
}

// Фильтры доски (обратная связь заказчика 17.09.2026):
//   owner    — "mine" (свои + новые ничьи) | "all" (все лиды филиала);
//              по умолчанию бэкенд сам ставит mine менеджеру и all руководству;
//   ownerId  — конкретный менеджер (сортировка по менеджерам);
//   branchId — только карточки филиала (фильтр админа «весь филиал»);
//   q        — поиск лида по названию/телефону, чтобы не листать сотни карточек.
export interface FunnelBoardParams {
  owner?: "mine" | "all"
  ownerId?: number | null
  branchId?: number | null
  q?: string
}

export async function getFunnelBoard(
  funnelId: number,
  params: FunnelBoardParams = {},
): Promise<FunnelBoard> {
  const query: Record<string, string | number> = {}
  if (params.owner) query.owner = params.owner
  if (params.ownerId) query.owner_id = params.ownerId
  if (params.branchId) query.branch_id = params.branchId
  if (params.q && params.q.trim()) query.q = params.q.trim()
  const res = await api.get(`/funnels/${funnelId}/board`, { params: query })
  return res.data
}
