import { api } from './index';

export interface WazzupSetupRequest {
  webhooks_base_url: string;
  api_key?: string; // Optional - backend uses default if not provided
  enabled: boolean;
}

export interface WazzupSetupResponse {
  webhook_url: string;
  webhook_token: string;
  crm_key: string;
}

export interface WazzupIframeRequest {
  // Empty body as per technical specification
}

export interface WazzupIframeResponse {
  iframe_url: string;
  url: string;
}

export interface CRMUser {
  id: string;
  name: string;
  email: string;
  phone: string;
  active: boolean;
}

export interface CRMUsersResponse {
  users: CRMUser[];
}

export interface WazzupStatus {
  configured: boolean;
  enabled: boolean;
  iframe_available: boolean;
  channels_count: number;
  last_webhook_at?: string;
  provider: string;
}

export interface WazzupChannel {
  id: number;
  integration_id: number;
  channel_id: string;
  transport: 'whatsapp' | 'telegram' | 'instagram' | string;
  name: string;
  username?: string;
  phone?: string;
  status: string;
  provider: string;
  updated_at: string;
}

export interface WazzupDialog {
  id: number;
  provider: string;
  transport: 'whatsapp' | 'telegram' | 'instagram' | string;
  external_chat_id: string;
  external_channel_id: string;
  display_name: string;
  username?: string;
  phone?: string;
  last_message_text: string;
  last_message_at?: string;
  unread_count: number;
  client_id?: number;
  lead_id?: number;
  branch_id?: number;
}

export interface WazzupDialogMessage {
  id: number;
  chat_id: number;
  sender_id?: number;
  text: string;
  direction: 'incoming' | 'outgoing' | string;
  status: string;
  transport: string;
  external_message_id?: string;
  external_channel_id?: string;
  created_at: string;
}

export interface WazzupListResponse<T> {
  value: T[];
  count: number;
}

// Setup Wazzup integration
export const setupWazzup = async (data: WazzupSetupRequest): Promise<WazzupSetupResponse> => {
  const response = await api.post('/integrations/wazzup/setup', data);
  return response.data;
};

// Get Wazzup iframe URL for chat
// Sends empty JSON body {} as per technical specification
export const getWazzupIframe = async (): Promise<WazzupIframeResponse> => {
  const response = await api.post('/integrations/wazzup/iframe', {});
  return response.data;
};

export const getWazzupStatus = async (): Promise<WazzupStatus> => {
  const response = await api.get('/integrations/wazzup/status');
  return response.data;
};

export const getWazzupChannels = async (): Promise<WazzupListResponse<WazzupChannel>> => {
  const response = await api.get('/integrations/wazzup/channels');
  return response.data;
};

export const getWazzupDialogs = async (transport: string): Promise<WazzupListResponse<WazzupDialog>> => {
  const response = await api.get('/integrations/wazzup/dialogs', { params: { transport } });
  return response.data;
};

export const getWazzupDialogMessages = async (
  dialogId: number,
  limit = 50,
  offset = 0,
): Promise<WazzupListResponse<WazzupDialogMessage>> => {
  const response = await api.get(`/integrations/wazzup/dialogs/${dialogId}/messages`, {
    params: { limit, offset },
  });
  return response.data;
};

export const sendWazzupDialogMessage = async (
  dialogId: number,
  text: string,
): Promise<WazzupDialogMessage> => {
  const response = await api.post(`/integrations/wazzup/dialogs/${dialogId}/messages`, { text });
  return response.data;
};

// Send message via Wazzup
export const sendWazzupMessage = async (chatId: string, text: string): Promise<{ message_id: string }> => {
  const response = await api.post('/integrations/wazzup/send', { chat_id: chatId, text });
  return response.data;
};

// Get CRM users for Wazzup integration (public endpoint)
export const getWazzupCRMUsers = async (token: string): Promise<CRMUsersResponse> => {
  const response = await fetch(`/integrations/wazzup/crm/${token}/users`);
  return response.json();
};

// Get specific CRM user for Wazzup integration (public endpoint)
export const getWazzupCRMUser = async (token: string, userId: string): Promise<CRMUser> => {
  const response = await fetch(`/integrations/wazzup/crm/${token}/users/${userId}`);
  return response.json();
};
