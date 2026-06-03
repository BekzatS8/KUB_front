// Sales Funnel Types
export type SalesFunnelItem = {
  status: string;
  count: number;
};

export type SalesFunnelResponse = {
  from: string;
  to: string;
  items: SalesFunnelItem[];
};

// Leads Summary Types
export type LeadsSummaryItem = {
  status: string;
  source: string;
  count: number;
};

export type LeadsSummaryResponse = {
  from: string;
  to: string;
  items: LeadsSummaryItem[];
};

// Revenue Types
export type RevenueItem = {
  period: string;
  total_amount: number;
  currency: string;
};

export type TopClientItem = {
  client_id: number;
  client_name: string;
  total_amount: number;
  currency: string;
};

export type RevenueResponse = {
  from: string;
  to: string;
  period: string;
  items: RevenueItem[];
  top_clients: TopClientItem[];
};

// Dashboard KPI Types
export type DashboardKPI = {
  key: string;
  value: number;
  trend_percent: number;
};

export type DashboardKPIResponse = {
  from: string;
  to: string;
  items: DashboardKPI[];
};

// Request types
export type ReportsRequest = {
  from?: string;
  to?: string;
  period?: 'month' | 'quarter' | 'year';
};

// Legacy types for backward compatibility
export type Reports_Revenue_Request = ReportsRequest;
export type Reports_Revenue_Response = RevenueItem[];
export type Reports_Funnel_Response = SalesFunnelResponse;
export type Reports_Leads_Response = LeadsSummaryResponse;
export type Reports_Revenue_Export_Response = Blob;