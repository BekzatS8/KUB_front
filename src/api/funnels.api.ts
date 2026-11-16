import api from "./index"
import type { Funnel, UpsertFunnelRequest } from "@/src/models/funnels.model"

export async function listFunnels(): Promise<Funnel[]> {
  const res = await api.get("/funnels")
  return res.data
}

export async function getFunnel(id: number): Promise<Funnel> {
  const res = await api.get(`/funnels/${id}`)
  return res.data
}

export async function createFunnel(payload: UpsertFunnelRequest): Promise<Funnel> {
  const res = await api.post("/funnels", payload)
  return res.data
}

export async function updateFunnel(id: number, payload: UpsertFunnelRequest): Promise<Funnel> {
  const res = await api.patch(`/funnels/${id}`, payload)
  return res.data
}

export async function deleteFunnel(id: number): Promise<void> {
  await api.delete(`/funnels/${id}`)
}

export async function reorderFunnels(ids: number[]): Promise<void> {
  await api.patch("/funnels/reorder", { ids })
}

// Отделы, для которых можно завести воронку (продажи, визовый, партнёрский,
// колл-центр) — раньше список брался из уже существующих воронок.
export interface FunnelDepartmentOption {
  id: number
  name: string
  code: string
}

export async function listFunnelDepartments(): Promise<FunnelDepartmentOption[]> {
  const res = await api.get("/funnels/departments")
  return res.data?.items || []
}

// Маршрут входящих лидов: сначала в колл-центр (оператор передаёт в продажи).
export interface InboundRouting {
  to_callcenter: boolean
  funnel_exists: boolean
  funnel_id?: number
  operators_active: number
}

export async function getInboundRouting(): Promise<InboundRouting> {
  const res = await api.get("/funnels/inbound-routing")
  return res.data
}

export async function setInboundRouting(toCallcenter: boolean): Promise<InboundRouting> {
  const res = await api.put("/funnels/inbound-routing", { to_callcenter: toCallcenter })
  return res.data
}
