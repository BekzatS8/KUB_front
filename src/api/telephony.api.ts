import { api } from './index';
import type {
  TelephonyCall,
  TelephonyCallListFilter,
  TelephonyCallListResponse,
} from '../models/telephony.model';

export const getCalls = async (
  filter: TelephonyCallListFilter = {},
): Promise<TelephonyCallListResponse> => {
  const params: Record<string, string | number> = {};
  if (filter.status) params.status = filter.status;
  if (filter.phone) params.phone = filter.phone;
  if (filter.date_from) params.date_from = filter.date_from;
  if (filter.date_to) params.date_to = filter.date_to;
  if (filter.manager_id) params.manager_id = filter.manager_id;
  if (filter.limit !== undefined) params.limit = filter.limit;
  if (filter.offset !== undefined) params.offset = filter.offset;

  const response = await api.get('/api/v1/telephony/calls', { params });
  return response.data;
};

export const getCallById = async (id: number): Promise<TelephonyCall> => {
  const response = await api.get(`/api/v1/telephony/calls/${id}`);
  return response.data;
};

export const getClientCalls = async (
  clientId: number,
  limit = 20,
  offset = 0,
): Promise<TelephonyCallListResponse> => {
  const response = await api.get(`/api/v1/clients/${clientId}/calls`, {
    params: { limit, offset },
  });
  return response.data;
};

export const getLeadCalls = async (
  leadId: number,
  limit = 20,
  offset = 0,
): Promise<TelephonyCallListResponse> => {
  const response = await api.get(`/api/v1/leads/${leadId}/calls`, {
    params: { limit, offset },
  });
  return response.data;
};

export const initiateCall = async (
  phone: string,
  managerId?: number,
): Promise<{ general_call_id: string }> => {
  const response = await api.post('/api/v1/telephony/calls/initiate', {
    phone,
    ...(managerId ? { manager_id: managerId } : {}),
  });
  return response.data;
};
