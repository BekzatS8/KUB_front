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

export async function getFunnelBoard(funnelId: number): Promise<FunnelBoard> {
  const res = await api.get(`/funnels/${funnelId}/board`)
  return res.data
}
