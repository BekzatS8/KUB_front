export type CallDirection = 'inbound' | 'outbound';

export type CallStatus =
  | 'incoming'
  | 'outgoing'
  | 'missed'
  | 'answered'
  | 'completed'
  | 'failed'
  | 'unknown';

export interface TelephonyCall {
  id: number;
  provider: string;
  external_call_id?: string;
  direction: CallDirection;
  status: CallStatus;
  phone: string;
  normalized_phone?: string;
  client_id?: number;
  lead_id?: number;
  manager_id?: number;
  branch_id?: number;
  started_at?: string;
  answered_at?: string;
  ended_at?: string;
  duration_seconds?: number;
  recording_url?: string;
  created_at: string;
  updated_at: string;
  // joined fields (from API response)
  client_name?: string;
  lead_title?: string;
  manager_name?: string;
}

export interface TelephonyCallListResponse {
  items: TelephonyCall[];
  total: number;
}

export interface TelephonyCallListFilter {
  status?: CallStatus | '';
  phone?: string;
  date_from?: string;
  date_to?: string;
  manager_id?: number;
  limit?: number;
  offset?: number;
}
