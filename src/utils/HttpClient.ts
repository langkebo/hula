import { getRuntimeAwareFetch } from '@/services/matrix/network/runtimeFetch'

export class HttpClientError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly statusText: string,
    public readonly body: string
  ) {
    super(message)
    this.name = 'HttpClientError'
  }
}

export interface HttpClientConfig {
  timeoutMs?: number
  signal?: AbortSignal
  headers?: Record<string, string>
}

const DEFAULT_TIMEOUT_MS = 30_000

function mergeHeaders(config?: HttpClientConfig): Record<string, string> | undefined {
  return config?.headers
}

async function fetchWithTimeout(
  url: string,
  init: RequestInit,
  timeoutMs: number,
  externalSignal?: AbortSignal
): Promise<Response> {
  if (externalSignal?.aborted) {
    throw new DOMException('The operation was aborted', 'AbortError')
  }

  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs)

  if (externalSignal) {
    externalSignal.addEventListener('abort', () => controller.abort(), {
      once: true
    })
  }

  const combinedInit: RequestInit = {
    ...init,
    signal: controller.signal
  }

  try {
    const runtimeFetch = getRuntimeAwareFetch()
    return await runtimeFetch(url, combinedInit)
  } catch (err) {
    if (err instanceof DOMException && err.name === 'AbortError') {
      if (externalSignal?.aborted) {
        throw new DOMException('The operation was aborted', 'AbortError')
      }
      throw new Error(`Request to ${url} timeout after ${timeoutMs}ms`)
    }
    throw err
  } finally {
    clearTimeout(timeoutId)
  }
}

async function toHttpClientError(response: Response, method: string, url: string): Promise<HttpClientError> {
  let body = ''
  try {
    body = await response.text()
  } catch {
    // ignore body read failures
  }
  return new HttpClientError(
    `${method} ${url} failed with ${response.status} ${response.statusText}`,
    response.status,
    response.statusText,
    body
  )
}

export class HttpClient {
  static async get<T = unknown>(url: string, config?: HttpClientConfig): Promise<T> {
    const response = await fetchWithTimeout(
      url,
      { method: 'GET', headers: mergeHeaders(config) },
      config?.timeoutMs ?? DEFAULT_TIMEOUT_MS,
      config?.signal
    )
    if (!response.ok) {
      throw await toHttpClientError(response, 'GET', url)
    }
    return response.json() as Promise<T>
  }

  private static isRawBody(
    body: unknown
  ): body is Blob | File | ArrayBuffer | ArrayBufferView | FormData | ReadableStream {
    return (
      body instanceof Blob ||
      body instanceof File ||
      body instanceof ArrayBuffer ||
      ArrayBuffer.isView(body) ||
      (typeof FormData !== 'undefined' && body instanceof FormData) ||
      (typeof ReadableStream !== 'undefined' && body instanceof ReadableStream)
    )
  }

  static async post<T = unknown>(url: string, body?: unknown, config?: HttpClientConfig): Promise<T> {
    const rawBody = body !== undefined && body !== null && HttpClient.isRawBody(body)
    const headers: Record<string, string> = {
      'Content-Type': rawBody ? (config?.headers?.['Content-Type'] ?? 'application/octet-stream') : 'application/json',
      ...config?.headers
    }
    const response = await fetchWithTimeout(
      url,
      {
        method: 'POST',
        headers,
        body: rawBody ? (body as BodyInit) : body !== undefined ? JSON.stringify(body) : undefined
      },
      config?.timeoutMs ?? DEFAULT_TIMEOUT_MS,
      config?.signal
    )
    if (!response.ok) {
      throw await toHttpClientError(response, 'POST', url)
    }
    return response.json() as Promise<T>
  }

  static async put<T = unknown>(url: string, body?: unknown, config?: HttpClientConfig): Promise<T> {
    const rawBody = body !== undefined && body !== null && HttpClient.isRawBody(body)
    const headers: Record<string, string> = {
      'Content-Type': rawBody ? (config?.headers?.['Content-Type'] ?? 'application/octet-stream') : 'application/json',
      ...config?.headers
    }
    const response = await fetchWithTimeout(
      url,
      {
        method: 'PUT',
        headers,
        body: rawBody ? (body as BodyInit) : body !== undefined ? JSON.stringify(body) : undefined
      },
      config?.timeoutMs ?? DEFAULT_TIMEOUT_MS,
      config?.signal
    )
    if (!response.ok) {
      throw await toHttpClientError(response, 'PUT', url)
    }
    return response.json() as Promise<T>
  }

  static async head(url: string, config?: HttpClientConfig): Promise<Response> {
    const response = await fetchWithTimeout(
      url,
      { method: 'HEAD' },
      config?.timeoutMs ?? DEFAULT_TIMEOUT_MS,
      config?.signal
    )
    if (!response.ok) {
      throw await toHttpClientError(response, 'HEAD', url)
    }
    return response
  }

  static async downloadBytes(url: string, config?: HttpClientConfig): Promise<ArrayBuffer> {
    const response = await fetchWithTimeout(
      url,
      { method: 'GET', headers: mergeHeaders(config) },
      config?.timeoutMs ?? DEFAULT_TIMEOUT_MS,
      config?.signal
    )
    if (!response.ok) {
      throw await toHttpClientError(response, 'GET', url)
    }
    return response.arrayBuffer()
  }

  static async streamResponse(url: string, body: unknown, config?: HttpClientConfig): Promise<Response> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...config?.headers
    }
    const response = await fetchWithTimeout(
      url,
      {
        method: 'POST',
        headers,
        body: JSON.stringify(body)
      },
      config?.timeoutMs ?? DEFAULT_TIMEOUT_MS,
      config?.signal
    )
    if (!response.ok) {
      throw await toHttpClientError(response, 'POST', url)
    }
    return response
  }
}
