export type DocType =
  | "contract_paid_full_ru"
  | "contract_paid_50_50_ru"
  | "contract_free_ru"
  | "refund_application"
  | "pause_application"
  | "avr_kub_group"
  | "receipt_refund_full"
  | "receipt_refund_partial"
  | "cancel_appointment"
  | "documents_handover_act"
  | "visa_questionnaire"
  | "termination_transfer"
  | "termination_waiver"
  | "contract_language_courses"
  | "addendum_korea";

export type DocStatus = "draft" | "under_review" | "approved" | "returned" | "signed";

export type SignStatus = "pending" | "approved" | "expired";

export interface Document {
  id: number;
  archived?: boolean | null;
  is_archived?: boolean;
  deal_id: number;
  client_id?: number;
  doc_type: DocType;
  status: DocStatus | string;
  sign_status?: SignStatus | string;
  file_path: string;
  file_path_docx: string;
  file_path_pdf: string;
  created_at: string;
  updated_at?: string;
}

export type Documents_Create_from_client_Request = {
  client_id: number;
  client_type: string;
  deal_id: number;
  doc_type: string;
  extra?: Record<string, any>;
}

export type Documents_Upload_document_Request = {
  deal_id: number;
  doc_type: DocType;
  file: File;
}

// ─── Signing Contact Options ─────────────────────────────────────

export type SignChannel = 'sms' | 'email';

export interface SignContactOptions {
  document_id: number;
  client_id: number;
  default_phone?: string;
  default_email?: string;
  resolved_full_name?: string;
  resolved_position?: string;
  available_channels: SignChannel[];
  preferred_channel: SignChannel;
}

export interface SignStartRequest {
  channel: SignChannel;
  manual_phone?: string;
  manual_email?: string;
}

export interface SignStartResponse {
  status: string;
  expires_at?: string;
  message?: string;
}