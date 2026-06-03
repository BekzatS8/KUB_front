export interface Lead {
  id: number;
  archived?: boolean | null;
  is_archived?: boolean;
  title: string;
  description: string;
  created_at: string;
  owner_id: number;
  status: "new" | "in_progress" | "confirmed" | "converted" | "cancelled";
}

export interface Deal {
  id: string
  archived?: boolean | null
  is_archived?: boolean
  leadId?: string
  title: string
  description: string
  clientName: string
  clientEmail: string
  clientPhone: string
  clientCompany?: string
  value: number
  currency: string
  status: "draft" | "proposal_sent" | "negotiation" | "contract_sent" | "signed" | "completed" | "cancelled"
  stage: "qualification" | "proposal" | "negotiation" | "contract" | "closing"
  probability: number
  expectedCloseDate: string
  actualCloseDate?: string
  assignedTo: string
  createdBy: string
  createdAt: string
  updatedAt: string
}