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

function containsRussianText(message: string) {
  return /[А-Яа-яЁё]/.test(message);
}

function translateClientError(message: string, code?: string, status?: number) {
  const lower = message.toLowerCase();

  if (code === 'READ_ONLY_ROLE' || lower.includes('read-only role') || lower.includes('read-only')) {
    return 'У вашей роли нет права создавать или редактировать клиентов. Обратитесь к администратору.';
  }
  if (code === 'USER_BRANCH_REQUIRED' || lower.includes('user branch is required') || lower.includes('no branch assigned')) {
    return 'Клиент не создан: у вашего пользователя не указан филиал. Попросите администратора назначить филиал в карточке пользователя.';
  }
  if (code === 'FORBIDDEN' || lower === 'forbidden' || status === 403) {
    return 'Нет доступа для создания или изменения клиента. Проверьте вашу роль и филиал пользователя.';
  }
  if (status === 401 || code === 'UNAUTHORIZED' || lower.includes('unauthorized')) {
    return 'Сессия истекла или вы не авторизованы. Войдите в систему заново.';
  }
  if (status === 404 || code === 'CLIENT_NOT_FOUND') {
    return 'Клиент не найден. Обновите список и попробуйте снова.';
  }
  if (code === 'BAD_REQUEST' && lower.includes('invalid client payload')) {
    return 'Некорректные данные формы клиента. Проверьте заполненные поля и попробуйте снова.';
  }
  if (lower.includes('invalid client_type')) {
    return 'Некорректный тип клиента. Выберите физическое или юридическое лицо.';
  }
  if (lower.includes('client_type is immutable')) {
    return 'Тип клиента нельзя менять после создания. Создайте нового клиента с нужным типом.';
  }
  if (code === 'CLIENT_IN_USE' || lower.includes('linked entities')) {
    return 'Клиента нельзя удалить: к нему привязаны сделки, документы или другие записи.';
  }
  if (lower.includes('timeout') || lower.includes('network error')) {
    return 'Нет соединения с сервером или сервер не ответил вовремя. Проверьте интернет и попробуйте снова.';
  }
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

  if (containsRussianText(message)) {
    return message;
  }
  if (status && status >= 500) {
    return 'Ошибка сервера. Попробуйте еще раз или обратитесь к администратору.';
  }
  if (status && status >= 400) {
    return 'Не удалось выполнить действие. Проверьте данные и права доступа.';
  }
  if (message) {
    return 'Произошла ошибка. Попробуйте еще раз.';
  }
  return 'Произошла ошибка. Попробуйте еще раз.';
}

function extractClientErrorMessage(error: any, fallback: string) {
  const status = error?.response?.status;
  const backendError = error?.response?.data;

  if (!backendError) {
    return translateClientError(error?.message || fallback, undefined, status);
  }

  if (typeof backendError === 'string') {
    return translateClientError(backendError, undefined, status);
  }

  if (Array.isArray(backendError)) {
    return backendError.map((err) => translateClientError(err?.message || String(err), err?.error_code || err?.code, status)).join(', ');
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
  try {
    const res = await api.get('/clients', { params: { ...params, paginate: true } });
    return res.data;
  } catch (error: any) {
    throw new Error(extractClientErrorMessage(error, 'Не удалось загрузить клиентов.'));
  }
}

export async function listMyClients(params?: { page?: number; size?: number; search?: string; client_type?: string }): Promise<Models.Client[] | { data: Models.Client[]; total: number }> {
  try {
    const res = await api.get('/clients/my', { params: { ...params, paginate: true } });
    return res.data;
  } catch (error: any) {
    throw new Error(extractClientErrorMessage(error, 'Не удалось загрузить клиентов.'));
  }
}

export async function getClientById(id: string): Promise<Models.Client> {
  try {
    const res = await api.get(`/clients/${id}`);
    return res.data;
  } catch (error: any) {
    throw new Error(extractClientErrorMessage(error, 'Не удалось загрузить клиента.'));
  }
}

export async function getClientProfile(id: string): Promise<any> {
  try {
    const res = await api.get(`/clients/${id}/profile`);
    return res.data;
  } catch (error: any) {
    throw new Error(extractClientErrorMessage(error, 'Не удалось загрузить профиль клиента.'));
  }
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
  try {
    const res = await api.delete(`/clients/${id}`);
    return res.data;
  } catch (error: any) {
    throw new Error(extractClientErrorMessage(error, 'Не удалось удалить клиента.'));
  }
}

export async function archiveClient(id: string, payload?: { reason?: string }): Promise<any> {
  try {
    const res = await api.post(`/clients/${id}/archive`, payload);
    return res.data;
  } catch (error: any) {
    throw new Error(extractClientErrorMessage(error, 'Не удалось архивировать клиента.'));
  }
}

export async function unarchiveClient(id: string): Promise<any> {
  try {
    const res = await api.post(`/clients/${id}/unarchive`);
    return res.data;
  } catch (error: any) {
    throw new Error(extractClientErrorMessage(error, 'Не удалось разархивировать клиента.'));
  }
}

// File upload functions
export async function uploadClientPhoto(clientId: string, file: File): Promise<any> {
  try {
    const formData = new FormData()
    formData.append('file', file)
    formData.append('category', 'photo35x45')
    const res = await api.post(`/clients/${clientId}/files`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
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

// ─── Client Avatar ─────────────────────────────────────────────────

export async function uploadClientAvatar(clientId: string, file: File): Promise<any> {
  try {
    const formData = new FormData()
    formData.append('file', file)
    const res = await api.post(`/clients/${clientId}/avatar`, formData)
    return res.data
  } catch (error: any) {
    throw new Error(extractClientErrorMessage(error, 'Не удалось загрузить аватар.'))
  }
}

export async function updateClientAvatarCrop(clientId: string, crop: { crop_x?: number; crop_y?: number; crop_scale?: number; crop_size?: number }): Promise<any> {
  try {
    const res = await api.patch(`/clients/${clientId}/avatar/crop`, crop)
    return res.data
  } catch (error: any) {
    throw new Error(extractClientErrorMessage(error, 'Не удалось обновить кроп аватара.'))
  }
}

export async function deleteClientAvatar(clientId: string): Promise<void> {
  try {
    await api.delete(`/clients/${clientId}/avatar`)
  } catch (error: any) {
    throw new Error(extractClientErrorMessage(error, 'Не удалось удалить аватар.'))
  }
}

export async function loadClientAvatar(clientId: string): Promise<string | null> {
  try {
    const res = await api.get(`/clients/${clientId}/avatar/content`, { responseType: 'blob' })
    // Revoke previous blob URL if needed (caller handles cleanup via key prop)
    return URL.createObjectURL(res.data)
  } catch {
    return null
  }
}

// ─── Client Documents ──────────────────────────────────────────────

export async function getClientDocuments(clientId: string, params?: { page?: number; size?: number; status?: string; doc_type?: string; q?: string }): Promise<{ items: any[]; total: number }> {
  try {
    const res = await api.get(`/clients/${clientId}/documents`, { params })
    return res.data
  } catch (error: any) {
    throw new Error(extractClientErrorMessage(error, 'Не удалось загрузить документы клиента.'))
  }
}

export async function createClientDocument(clientId: string, payload: { deal_id?: number; doc_type: string }): Promise<any> {
  try {
    const res = await api.post(`/clients/${clientId}/documents`, payload)
    return res.data
  } catch (error: any) {
    throw new Error(extractClientErrorMessage(error, 'Не удалось создать документ.'))
  }
}
