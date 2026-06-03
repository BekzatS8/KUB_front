import api from './index';
import type * as Models from '@/src/models/clients.model';

export async function createClient(payload: Models.CreateClientRequest): Promise<Models.Client> {
  try {
    console.log('Creating client with payload:', payload);
    const res = await api.post('/clients', payload);
    console.log('Client creation response:', res);
    return res.data;
  } catch (error: any) {
    console.error('Client creation failed with detailed error:', {
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
    
    // Extract detailed error message from backend if available
    const backendError = error?.response?.data;
    let errorMessage = 'Failed to create client';

    if (backendError) {
      console.log('Backend error response:', backendError);

      if (typeof backendError === 'string') {
        errorMessage = backendError;
      } else if (backendError.message) {
        errorMessage = backendError.message;
        if (backendError.missing_fields && Array.isArray(backendError.missing_fields)) {
          errorMessage += ` (Missing: ${backendError.missing_fields.join(', ')})`;
        }
      } else if (backendError.error) {
        errorMessage = backendError.error;
      } else if (backendError.detail) {
        errorMessage = backendError.detail;
      } else if (Array.isArray(backendError)) {
        // Handle validation errors array
        errorMessage = backendError.map(err => err.message || err).join(', ');
      } else if (backendError.missing_fields) {
        errorMessage = `Missing required fields: ${backendError.missing_fields.join(', ')}`;
      }
    }

    throw new Error(errorMessage);
  }
}

export async function listClients(params?: { page?: number; size?: number; search?: string; client_type?: string }): Promise<Models.Client[] | { data: Models.Client[]; total: number }> {
  const res = await api.get('/clients', { params: { ...params, paginate: true } });
  return res.data;
}

export async function listMyClients(params?: { page?: number; size?: number; search?: string; client_type?: string }): Promise<Models.Client[] | { data: Models.Client[]; total: number }> {
  const res = await api.get('/clients/my', { params: { ...params, paginate: true } });
  return res.data;
}

export async function getClientById(id: string): Promise<Models.Client> {
  const res = await api.get(`/clients/${id}`);
  return res.data;
}

export async function getClientProfile(id: string): Promise<any> {
  const res = await api.get(`/clients/${id}/profile`);
  return res.data;
}

export async function getClientPhoto(clientId: string): Promise<string> {
  try {
    const res = await api.get(`/clients/${clientId}/files/primary?category=photo35x45`, {
      responseType: 'blob'
    });
    return URL.createObjectURL(res.data);
  } catch (error) {
    console.error('Failed to fetch client photo:', error);
    return '';
  }
}

export async function updateClient(id: string, payload: Models.UpdateClientRequest): Promise<Models.Client> {
  try {
    console.log('Updating client with payload:', payload);
    const res = await api.put(`/clients/${id}`, payload);
    console.log('Client update response:', res);
    return res.data;
  } catch (error: any) {
    console.error('Client update failed with detailed error:', {
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

    // Extract detailed error message from backend if available
    const backendError = error?.response?.data;
    let errorMessage = 'Failed to update client';

    if (backendError) {
      console.log('Backend error response:', backendError);

      if (typeof backendError === 'string') {
        errorMessage = backendError;
      } else if (backendError.message) {
        errorMessage = backendError.message;
        if (backendError.missing_fields && Array.isArray(backendError.missing_fields)) {
          errorMessage += ` (Missing: ${backendError.missing_fields.join(', ')})`;
        }
      } else if (backendError.error) {
        errorMessage = backendError.error;
      } else if (backendError.detail) {
        errorMessage = backendError.detail;
      } else if (Array.isArray(backendError)) {
        errorMessage = backendError.map(err => err.message || err).join(', ');
      } else if (backendError.missing_fields) {
        errorMessage = `Missing required fields: ${backendError.missing_fields.join(', ')}`;
      }
    }

    throw new Error(errorMessage);
  }
}

export async function deleteClient(id: string): Promise<void> {
  const res = await api.delete(`/clients/${id}`);
  return res.data;
}

export async function archiveClient(id: string, payload?: { reason?: string }): Promise<any> {
  const res = await api.post(`/clients/${id}/archive`, payload);
  return res.data;
}

export async function unarchiveClient(id: string): Promise<any> {
  const res = await api.post(`/clients/${id}/unarchive`);
  return res.data;
}

// File upload functions
export async function uploadClientPhoto(clientId: string, file: File): Promise<any> {
  const formData = new FormData();
  formData.append('file', file); // Backend expects 'file' field name
  formData.append('category', 'photo35x45');
  
  const res = await api.post(`/clients/${clientId}/files`, formData, {
    headers: {
      'Content-Type': 'multipart/form-data',
    },
  });
  return res.data;
}

export async function createClientWithPhoto(payload: Models.CreateClientRequest, photoFile?: File): Promise<Models.Client> {
  // First create client with JSON data
  const client = await createClient(payload);
  
  // Then upload photo if provided
  if (photoFile) {
    try {
      await uploadClientPhoto(client.id.toString(), photoFile);
    } catch (error) {
      console.warn('Failed to upload photo but client was created:', error);
    }
  }
  
  return client;
}

export async function updateClientWithPhoto(id: string, payload: Models.UpdateClientRequest, photoFile?: File): Promise<Models.Client> {
  if (photoFile) {
    // First update client data
    const updatedClient = await updateClient(id, payload);
    
    // Then upload photo
    try {
      await uploadClientPhoto(id, photoFile);
    } catch (error) {
      console.warn('Failed to upload photo but client was updated:', error);
    }
    
    return updatedClient;
  } else {
    // Regular client update without photo
    return updateClient(id, payload);
  }
}