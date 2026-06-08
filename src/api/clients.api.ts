import api from './index';
import type * as Models from '@/src/models/clients.model';

const CLIENT_FIELD_LABELS: Record<string, string> = {
  client_type: 'Тип лица',
  country: 'Страна',
  trip_purpose: 'Цель поездки',
  birth_date: 'Дата рождения',
  phone: 'Телефон',
  last_name: 'Фамилия',
  first_name: 'Имя',
  company_name: 'Название компании',
  name: 'Название компании',
  bin: 'БИН',
  bin_iin: 'БИН/ИИН',
  contact_person_name: 'Контактное лицо',
  contact_person_phone: 'Телефон контактного лица',
  legal_address: 'Юридический адрес',
  address: 'Юридический адрес',
  email: 'Email',
  iin: 'ИИН',
};

function fieldLabel(field: string) {
  return CLIENT_FIELD_LABELS[field] || field;
}

function formatMissingFields(fields: unknown) {
  if (!Array.isArray(fields) || fields.length === 0) return '';
  return `Не заполнены обязательные поля: ${fields.map((field) => fieldLabel(String(field))).join(', ')}.`;
}

function translateClientError(message: string, code?: string, status?: number) {
  const lower = message.toLowerCase();

  if (code === 'CLIENT_ALREADY_EXISTS') {
    return 'Клиент с таким БИН/ИИН уже существует.';
  }
  if (code === 'EMAIL_ALREADY_USED' || lower.includes('email already used')) {
    return 'Этот email уже указан у другого клиента.';
  }
  if (code === 'INVALID_EMAIL' || lower.includes('invalid email') || lower.includes('email has invalid format')) {
    return 'Некорректный формат email.';
  }
  if (code === 'INVALID_DATE_FORMAT' || lower.includes('invalid date')) {
    return 'Некорректная дата. Используйте формат дд.мм.гггг.';
  }
  if (lower.includes('individual profile with this iin')) {
    return 'Клиент с таким ИИН уже существует.';
  }
  if (lower.includes('legal profile with this bin')) {
    return 'Клиент с таким БИН уже существует.';
  }
  if (lower.includes('invalid education_level')) {
    return 'Некорректное значение поля “Образование”. Выберите вариант из списка.';
  }
  if (lower.includes('read-only role')) {
    return 'У вашей роли нет права создавать или редактировать клиентов.';
  }
  if (status === 413 || lower.includes('request entity too large') || lower.includes('payload too large')) {
    return 'Файл слишком большой для текущей настройки сервера или внешнего прокси.';
  }
  if (lower.includes('unsupported file extension')) {
    return 'Этот формат файла пока не поддерживается сервером.';
  }
  if (lower.includes('file is required')) {
    return 'Файл не был передан на сервер. Выберите фото еще раз.';
  }
  if (lower.includes('unsupported category')) {
    return 'Фото нельзя прикрепить к этому типу клиента.';
  }
  if (lower.includes('forbidden') || status === 403) {
    return 'Нет доступа для выполнения этого действия.';
  }
  if (lower.includes('database schema mismatch') || lower.includes('missing or outdated database migration')) {
    return `Ошибка базы данных: не применена нужная миграция. ${message}`;
  }
  if (lower.includes('related record not found')) {
    return 'Не найдена связанная запись: пользователь, филиал или другая зависимость.';
  }

  return message;
}

function extractClientErrorMessage(error: any, fallback: string) {
  const status = error?.response?.status;
  const backendError = error?.response?.data;

  if (!backendError) {
    return error?.message || fallback;
  }

  if (typeof backendError === 'string') {
    return translateClientError(backendError, undefined, status);
  }

  if (Array.isArray(backendError)) {
    return backendError.map((err) => err?.message || String(err)).join(', ');
  }

  const missingFieldsText = formatMissingFields(backendError.missing_fields);
  const code = backendError.error_code || backendError.code;
  const rawMessage =
    backendError.message ||
    backendError.error ||
    backendError.detail ||
    backendError.details ||
    fallback;
  const translatedMessage = translateClientError(String(rawMessage), code, status);

  if (missingFieldsText) {
    return missingFieldsText;
  }

  return translatedMessage;
}

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
    
    throw new Error(extractClientErrorMessage(error, 'Не удалось создать клиента.'));
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

    throw new Error(extractClientErrorMessage(error, 'Не удалось обновить клиента.'));
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
  try {
    const res = await api.postForm(`/clients/${clientId}/files`, {
      file,
      category: 'photo35x45',
    }, {
      timeout: 120000,
    });
    return res.data;
  } catch (error: any) {
    throw new Error(extractClientErrorMessage(error, 'Не удалось загрузить фото клиента.'));
  }
}

export async function createClientWithPhoto(payload: Models.CreateClientRequest, photoFile?: File): Promise<Models.Client> {
  // First create client with JSON data
  const client = await createClient(payload);
  
  // Then upload photo if provided
  if (photoFile) {
    try {
      await uploadClientPhoto(client.id.toString(), photoFile);
    } catch (error) {
      throw new Error(`Клиент создан, но фото не загрузилось: ${(error as Error)?.message || 'неизвестная ошибка'}`);
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
      throw new Error(`Клиент обновлен, но фото не загрузилось: ${(error as Error)?.message || 'неизвестная ошибка'}`);
    }
    
    return updatedClient;
  } else {
    // Regular client update without photo
    return updateClient(id, payload);
  }
}
