// lib/api-proxy.ts

/**
 * Прокси-функция для API запросов на сервере
 * Используется в getServerSideProps для обхода CORS
 */
export async function serverFetch<T = any>(
  endpoint: string,
  options?: RequestInit
): Promise<T> {
  const baseURL = process.env.NEXT_PUBLIC_API_BASE_URL || "https://api.kubcrm.kz"
  const url = `${baseURL}${endpoint}`
  
  console.log('Server fetch to:', url)
  
  const response = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options?.headers,
    },
  })

  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status}`)
  }

  return response.json()
}

/**
 * Клиентская функция для API запросов
 * Использует наш axios инстанс с проксированием
 */
export function clientFetch(endpoint: string) {
  return `/api-proxy${endpoint}`
}