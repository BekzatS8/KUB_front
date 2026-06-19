import api from "./index"
import type {
  FunnelTransitionRule,
  UpsertFunnelTransitionRuleRequest,
} from "@/src/models/funnel-transition-rules.model"

export async function listFunnelTransitionRules(): Promise<FunnelTransitionRule[]> {
  const res = await api.get("/funnel-transition-rules")
  return res.data
}

export async function getFunnelTransitionRule(id: number): Promise<FunnelTransitionRule> {
  const res = await api.get(`/funnel-transition-rules/${id}`)
  return res.data
}

export async function createFunnelTransitionRule(
  payload: UpsertFunnelTransitionRuleRequest
): Promise<FunnelTransitionRule> {
  const res = await api.post("/funnel-transition-rules", payload)
  return res.data
}

export async function updateFunnelTransitionRule(
  id: number,
  payload: UpsertFunnelTransitionRuleRequest
): Promise<FunnelTransitionRule> {
  const res = await api.put(`/funnel-transition-rules/${id}`, payload)
  return res.data
}

export async function deleteFunnelTransitionRule(id: number): Promise<void> {
  await api.delete(`/funnel-transition-rules/${id}`)
}

export async function toggleFunnelTransitionRule(
  id: number,
  isActive: boolean
): Promise<{ id: number; is_active: boolean }> {
  const res = await api.patch(`/funnel-transition-rules/${id}/toggle`, { is_active: isActive })
  return res.data
}
