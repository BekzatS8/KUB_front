import type { Funnel } from "@/src/models/funnels.model"

export type FunnelStageType = "regular" | "won" | "lost"

export interface FunnelStage {
  id: number
  funnel_id: number
  name: string
  code: string
  color: string
  type: FunnelStageType
  position: number
  probability: number
  description?: string
  is_active: boolean
  /** При переходе на этот этап карточка автоматически уходит в архив. */
  auto_archive?: boolean
  created_at?: string
  updated_at?: string
}

export interface UpsertFunnelStageRequest {
  name: string
  code: string
  color?: string
  type?: FunnelStageType
  probability?: number
  description?: string
  is_active?: boolean
  auto_archive?: boolean
}

export type FunnelBoardCardKind = "deal" | "lead"

export interface FunnelBoardDeal {
  id: number
  /** "deal" — сделка, "lead" — необработанный лид на доске (ТЗ п.1.1) */
  kind: FunnelBoardCardKind
  lead_id: number
  funnel_id?: number | null
  stage_id?: number | null
  client_id: number
  client_type: string
  client_name: string
  owner_id: number
  owner_name: string
  branch_id?: number | null
  amount: number
  currency: string
  status: string
  phone?: string
  source?: string
  created_at: string
}

export interface FunnelBoardColumn {
  stage: FunnelStage | null
  deals: FunnelBoardDeal[]
  count: number
  total_amount: number
}

export interface FunnelBoard {
  funnel: Funnel
  columns: FunnelBoardColumn[]
}

export interface DealStageHistoryEntry {
  id: number
  deal_id: number
  from_stage_id?: number | null
  to_stage_id?: number | null
  changed_by?: number | null
  changed_by_name?: string
  comment?: string
  created_at: string
  from_stage?: FunnelStage | null
  to_stage?: FunnelStage | null
}
