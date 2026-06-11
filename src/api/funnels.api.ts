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
