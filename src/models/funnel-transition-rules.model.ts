import type { Funnel } from "@/src/models/funnels.model"
import type { FunnelStage } from "@/src/models/funnel-stages.model"

export interface FunnelTransitionRule {
  id: number
  name: string
  from_funnel_id: number
  from_stage_id: number
  to_funnel_id: number
  to_stage_id: number
  is_active: boolean
  created_at?: string
  updated_at?: string
  from_funnel?: Funnel
  from_stage?: FunnelStage
  to_funnel?: Funnel
  to_stage?: FunnelStage
}

export interface UpsertFunnelTransitionRuleRequest {
  name: string
  from_funnel_id: number
  from_stage_id: number
  to_funnel_id: number
  to_stage_id: number
  is_active?: boolean
}
