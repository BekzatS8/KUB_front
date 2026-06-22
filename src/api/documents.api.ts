import api from './index'
import type * as Models from '@/src/models/documents.model'

// ─── List / Get ──────────────────────────────────────────────────

export async function getDocuments(params?: { page?: number; size?: number; search?: string }): Promise<Models.Document[] | { data: Models.Document[]; total: number }> {
  const res = await api.get(`/documents`, { params: { ...params, paginate: true } })
  return res.data
}

export async function getDocumentsByDeal(dealId: number, params?: { page?: number; size?: number; search?: string }): Promise<Models.Document[] | { data: Models.Document[]; total: number }> {
  const res = await api.get(`/documents/deal/${dealId}`, { params: { ...params, paginate: true } })
  return res.data
}

export async function getDocumentById(id: number): Promise<Models.Document> {
  const res = await api.get(`/documents/${id}`)
  return res.data
}

// ─── Create (only stable endpoint) ──────────────────────────────

export async function createDocumentFromClient(payload: Models.Documents_Create_from_client_Request): Promise<Models.Document> {
  try {
    console.log('Creating document with payload:', payload);
    const res = await api.post('/documents/create-from-client', payload);
    console.log('Document creation response:', res);
    return res.data;
  } catch (error: any) {
    console.error('Document creation failed with detailed error:', {
      message: error?.message,
      status: error?.response?.status,
      statusText: error?.response?.statusText,
      data: error?.response?.data,
      config: {
        url: error?.config?.url,
        method: error?.config?.method,
        data: error?.config?.data,
        headers: error?.config?.headers
      }
    });
    
    console.log('Full error object:', error);
    console.log('error.response:', error?.response);
    console.log('error.response.data:', error?.response?.data);
    
    // Extract detailed error message from backend if available
    const backendError = error?.response?.data;
    console.log('backendError:', backendError);
    let errorMessage = 'Failed to create document';
    
    if (backendError) {
      if (typeof backendError === 'string') {
        errorMessage = backendError;
      } else if (backendError.message) {
        errorMessage = backendError.message;
      } else if (backendError.error === 'missing_fields') {
        const scope = backendError.scope || 'unknown';
        const missingFields = backendError.missing_fields || [];
        console.log('missingFields array:', missingFields);
        console.log('First missing field:', missingFields[0]);
        const fieldNames = missingFields.map((field: any) => 
          typeof field === 'string' ? field : field.key || field.name || field.Key || field.toString()
        );
        
        const source = missingFields[0]?.source || 'unknown';
        let messagePrefix = '';
        if (source === 'client') {
          messagePrefix = 'У выбранного клиента отсутствуют обязательные данные. Заполните в профиле клиента: ';
        } else if (source === 'deal') {
          messagePrefix = 'У выбранной сделки отсутствуют обязательные данные: ';
        } else {
          messagePrefix = `Отсутствуют обязательные поля в ${scope}: `;
        }
        
        errorMessage = messagePrefix + fieldNames.join(', ');
      } else if (backendError.error) {
        errorMessage = backendError.error;
      } else if (backendError.detail) {
        errorMessage = backendError.detail;
      } else if (Array.isArray(backendError)) {
        // Handle validation errors array
        errorMessage = backendError.map(err => err.message || err).join(', ');
      }
    }
    
    throw new Error(errorMessage);
  }
}

export async function uploadDocument(payload: Models.Documents_Upload_document_Request): Promise<any> {
  const formData = new FormData();
  formData.append('deal_id', payload.deal_id.toString());
  formData.append('doc_type', payload.doc_type);
  formData.append('file', payload.file);

  const res = await api.post(`/documents/upload`, formData)
  return res.data
}

// ─── File operations ─────────────────────────────────────────────

export async function viewDocumentFile(id: number): Promise<Blob> {
  const res = await api.get(`/documents/${id}/file`, { responseType: 'blob' })
  return res.data
}

export async function downloadDocument(id: number, format: string = 'pdf'): Promise<Blob> {
  const res = await api.get(`/documents/${id}/download`, { params: { format }, responseType: 'blob' })
  return res.data
}

// ─── Delete ──────────────────────────────────────────────────────

export async function deleteDocument(id: number): Promise<any> {
  const res = await api.delete(`/documents/${id}`)
  return res.data
}

export async function archiveDocument(id: number, payload?: { reason?: string }): Promise<any> {
  const res = await api.post(`/documents/${id}/archive`, payload)
  return res.data
}

export async function unarchiveDocument(id: number): Promise<any> {
  const res = await api.post(`/documents/${id}/unarchive`)
  return res.data
}

// ─── Lifecycle / Review ──────────────────────────────────────────

export async function submitDocument(id: number): Promise<any> {
  const res = await api.post(`/documents/${id}/submit`)
  return res.data
}

export async function reviewDocument(id: number, action: 'approve' | 'return'): Promise<any> {
  const res = await api.post(`/documents/${id}/review`, { action })
  return res.data
}

// ─── Signing Workflow ────────────────────────────────────────────

export async function getSignContactOptions(id: number): Promise<Models.SignContactOptions> {
  const res = await api.get(`/documents/${id}/sign/contact-options`)
  return res.data
}

export async function startSignWithChannel(id: number, payload: Models.SignStartRequest): Promise<Models.SignStartResponse> {
  const res = await api.post(`/documents/${id}/sign/start`, payload)
  return res.data
}

export async function startSign(id: number, email?: string): Promise<any> {
  const body = email ? { email } : undefined
  const res = await api.post(`/documents/${id}/sign/start`, body)
  return res.data
}

export async function confirmSignEmail(id: number, token: string, code: string): Promise<any> {
  const res = await api.post(`/documents/${id}/sign/confirm/email`, { token, code })
  return res.data
}

export async function getSignStatus(id: number): Promise<any> {
  const res = await api.get(`/documents/${id}/sign/status`)
  return res.data
}

export async function getSignHistory(id: number): Promise<{ document: { id: number; status: string }; events: SignHistoryEvent[] }> {
  const res = await api.get(`/documents/${id}/sign/history`)
  return res.data
}

export interface SignHistoryEvent {
  type: string
  at: string
  channel?: string
  by?: string
  method?: string
  ip?: string
  user_agent?: string
  status?: string
}

export async function finalSign(signSessionId: string, token: string): Promise<any> {
  const res = await api.post(`/api/v1/sign/sessions/id/${signSessionId}/sign`, { token, agree: true })
  return res.data
}

// ─── Client Signing (link-based) ─────────────────────────────────

export async function generateSignLink(id: number): Promise<{ url: string; token: string }> {
  const res = await api.post(`/documents/${id}/generate-sign-link`)
  return res.data
}

// ─── Public endpoints (no auth) ──────────────────────────────────

import axios from 'axios'

/** Force https:// protocol on any URL */
function enforceHttps(url: string): string {
  return url.replace(/^http:\/\//i, 'https://')
}

const publicApiBaseURL = typeof window !== 'undefined'
  ? '/api-proxy'
  : enforceHttps(process.env.NEXT_PUBLIC_API_BASE_URL || 'https://api.kubcrm.kz')

const publicApi = axios.create({
  baseURL: publicApiBaseURL,
  headers: { 'Content-Type': 'application/json' },
  timeout: 30000,
})

export async function getPublicDocument(token: string): Promise<any> {
  const res = await publicApi.get(`/public/documents/${token}`)
  return res.data
}

export async function submitPublicSign(token: string, signatureData: string, email?: string): Promise<any> {
  const res = await publicApi.post(`/public/documents/${token}/sign`, { signature: signatureData, email })
  return res.data
}

export interface SignPublicDocumentPayload {
  signer_name: string
  signer_phone?: string
  signature?: string
}

export async function signPublicDocument(token: string, payload: SignPublicDocumentPayload): Promise<any> {
  const res = await publicApi.post(`/public/documents/${token}/sign`, payload)
  return res.data
}
