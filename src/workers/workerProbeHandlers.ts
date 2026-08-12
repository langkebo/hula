/**
 * Worker 服务器探测处理器
 *
 * 在登录前/诊断场景下直接通过 fetch 探测 homeserver 的协议版本、
 * 登录流程、Sliding Sync 端点、CORS 头、服务器能力等。
 * 这些请求不依赖 SDK 客户端实例，在 Worker 独立线程执行以避免阻塞主线程。
 *
 * 从 matrixSdk.worker.ts 拆分，保持原有逻辑不变。
 */

import { useI18nGlobal } from '@/services/i18n'

interface GetServerVersionsPayload {
  baseUrl: string
  accessToken?: string
}

interface ServerVersionsResult {
  versions: string[]
  unstable_features?: Record<string, boolean>
}

export async function handleGetServerVersions(payload: GetServerVersionsPayload): Promise<ServerVersionsResult> {
  if (!payload?.baseUrl) {
    throw new Error(useI18nGlobal().t('matrix_error.client.base_url_required'))
  }
  const trimmed = payload.baseUrl.replace(/\/+$/, '')
  const url = `${trimmed}/_matrix/client/versions`
  const headers: Record<string, string> = { Accept: 'application/json' }
  if (payload.accessToken) {
    headers.Authorization = `Bearer ${payload.accessToken}`
  }
  const response = await fetch(url, { method: 'GET', headers })
  if (!response.ok) {
    throw new Error(`getVersions HTTP ${response.status}`)
  }
  const json = (await response.json()) as ServerVersionsResult
  return {
    versions: Array.isArray(json.versions) ? json.versions : [],
    unstable_features: json.unstable_features
  }
}

interface GetLoginFlowsPayload {
  baseUrl: string
}

interface LoginFlow {
  type: string
  [key: string]: unknown
}

interface LoginFlowsResult {
  flows: LoginFlow[]
}

export async function handleGetLoginFlows(payload: GetLoginFlowsPayload): Promise<LoginFlowsResult> {
  if (!payload?.baseUrl) {
    throw new Error(useI18nGlobal().t('matrix_error.client.base_url_required'))
  }
  const trimmed = payload.baseUrl.replace(/\/+$/, '')
  const url = `${trimmed}/_matrix/client/v3/login`
  const response = await fetch(url, { method: 'GET', headers: { Accept: 'application/json' } })
  if (!response.ok) {
    throw new Error(`getLoginFlows HTTP ${response.status}`)
  }
  const json = (await response.json()) as LoginFlowsResult
  return {
    flows: Array.isArray(json.flows) ? json.flows : []
  }
}

interface ProbeSlidingSyncPayload {
  baseUrl: string
  endpoints: string[]
}

interface SlidingSyncProbeResult {
  endpoint: string
  status: number | 'error'
  available: boolean
  error?: string
}

export async function handleProbeSlidingSyncEndpoints(
  payload: ProbeSlidingSyncPayload
): Promise<SlidingSyncProbeResult[]> {
  if (!payload?.baseUrl) {
    throw new Error(useI18nGlobal().t('matrix_error.client.base_url_required'))
  }
  const trimmed = payload.baseUrl.replace(/\/+$/, '')
  const endpoints = Array.isArray(payload.endpoints) ? payload.endpoints : []
  if (endpoints.length === 0) {
    return []
  }

  return Promise.all(
    endpoints.map(async (endpoint): Promise<SlidingSyncProbeResult> => {
      try {
        const response = await fetch(`${trimmed}${endpoint}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({})
        })
        return {
          endpoint,
          status: response.status,
          available: response.status !== 404
        }
      } catch (error) {
        return {
          endpoint,
          status: 'error',
          available: false,
          error: String(error)
        }
      }
    })
  )
}

interface ProbeCorsPayload {
  baseUrl: string
}

interface CorsProbeResult {
  'access-control-allow-origin': string | null
  'access-control-allow-methods': string | null
  'access-control-allow-headers': string | null
}

export async function handleProbeCors(payload: ProbeCorsPayload): Promise<CorsProbeResult> {
  if (!payload?.baseUrl) {
    throw new Error(useI18nGlobal().t('matrix_error.client.base_url_required'))
  }
  const trimmed = payload.baseUrl.replace(/\/+$/, '')
  const response = await fetch(`${trimmed}/_matrix/client/versions`, { method: 'OPTIONS' })
  return {
    'access-control-allow-origin': response.headers.get('access-control-allow-origin'),
    'access-control-allow-methods': response.headers.get('access-control-allow-methods'),
    'access-control-allow-headers': response.headers.get('access-control-allow-headers')
  }
}

interface GetCapabilitiesPayload {
  baseUrl: string
  accessToken: string
}

export async function handleGetCapabilities(payload: GetCapabilitiesPayload): Promise<Record<string, unknown>> {
  if (!payload?.baseUrl) {
    throw new Error(useI18nGlobal().t('matrix_error.client.base_url_required'))
  }
  if (!payload?.accessToken) {
    throw new Error(useI18nGlobal().t('matrix_error.client.access_token_required'))
  }
  const trimmed = payload.baseUrl.replace(/\/+$/, '')
  const url = `${trimmed}/_matrix/client/v3/capabilities`
  const response = await fetch(url, {
    method: 'GET',
    headers: {
      Accept: 'application/json',
      Authorization: `Bearer ${payload.accessToken}`
    }
  })
  if (!response.ok) {
    throw new Error(`getCapabilities HTTP ${response.status}`)
  }
  return (await response.json()) as Record<string, unknown>
}
