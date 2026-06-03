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
