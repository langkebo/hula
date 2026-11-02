import { getRuntimeAwareFetch } from '@/services/matrix/network/runtimeFetch'
import { HttpClient } from '@/utils/HttpClient'
import { createLogger } from '@/utils/Logger'
import {
  DEFAULT_MATRIX_IDENTITY_SERVER_URL,
  isValidHttpUrl,
  normalizeHttpUrl,
  saveMatrixHomeserverUrl,
  saveMatrixIdentityServerUrl
} from './config'
import type { MatrixDiscoveryResult, MatrixEndpointConfig } from './types'

const MATRIX_WELL_KNOWN_PATH = '/.well-known/matrix/client'
const logger = createLogger('MatrixDiscovery')

interface ConsulServiceEntry {
  Service: {
    ID: string
    Service: string
    Address: string
    Port: number
    Weights?: {
      Passing: number
    }
    Tags?: string[]
    Meta: Record<string, string>
  }
  Node: {
    Address: string
  }
}

interface ConsulResolvedInstance {
  address: string
  port: number
  metadata: Record<string, string>
}

let roundRobinIndex = 0

function getConsulUrl(): string | null {
  // 在测试环境下不启用 Consul discovery，以确保单元测试能够验证原有的发现逻辑
  if (import.meta.env.MODE === 'test') {
    return null
  }

  // 只有配置了 VITE_CONSUL_URL 时才启用 Consul discovery。
  // 无 Consul 时返回 null，让调用方走 explicit_url / .well-known 传统发现路径，
  // 正确尊重用户输入（避免把用户输入的任意地址强行重定向到默认 homeserver）。
  const consulUrl = import.meta.env.VITE_CONSUL_URL
  return consulUrl || null
}

async function resolveMatrixHomeserverFromConsul(
  consulUrl: string,
  tag: string
): Promise<ConsulResolvedInstance | null> {
  const baseUrl = consulUrl.replace(/\/+$/, '')
  // Consul 支持 ?tag= 参数做服务端过滤（只支持单 tag）。
  const params = new URLSearchParams()
  params.set('passing', 'true')
  params.set('tag', tag)
  const url = `${baseUrl}/v1/health/service/matrix-homeserver?${params.toString()}`

  try {
    // Consul baseUrl 由 env/配置驱动（动态 host）
    const entries = await HttpClient.get<ConsulServiceEntry[]>(url, { allowDynamicHost: true })
    // 客户端二次过滤：实例必须包含请求的 tag（AND 语义），与 Consul 服务端过滤对齐。
    const instances = entries
      .filter((entry) => (entry.Service.Tags ?? []).includes(tag))
      .map((entry) => ({
        address: entry.Service.Address || entry.Node.Address,
        port: entry.Service.Port,
        metadata: entry.Service.Meta
      }))

    if (instances.length === 0) {
      return null
    }

    const instance = instances[roundRobinIndex % instances.length]
    roundRobinIndex = (roundRobinIndex + 1) % instances.length
    return instance
  } catch (error) {
    logger.error('Failed to discover matrix-homeserver from Consul:', error)
    return null
  }
}

type WellKnownDocument = {
  'm.homeserver'?: {
    base_url?: unknown
  }
  'm.identity_server'?: {
    base_url?: unknown
  }
}

function normalizeOptionalHttpUrl(value: string | undefined): string {
  if (!value?.trim()) {
    return ''
  }

  const normalizedUrl = normalizeHttpUrl(value)
  return isValidHttpUrl(normalizedUrl) ? normalizedUrl : ''
}

function buildFallbackConfig(
  serverName: string,
  fallbackConfig?: Partial<MatrixEndpointConfig>
): MatrixDiscoveryResult {
  const fallbackHomeserverUrl = normalizeOptionalHttpUrl(fallbackConfig?.homeserverUrl)
  const fallbackIdentityServerUrl =
    normalizeOptionalHttpUrl(fallbackConfig?.identityServerUrl) || DEFAULT_MATRIX_IDENTITY_SERVER_URL

  if (fallbackHomeserverUrl) {
    return {
      homeserverUrl: fallbackHomeserverUrl,
      identityServerUrl: fallbackIdentityServerUrl,
      source: 'fallback',
      serverName
    }
  }

  return {
    homeserverUrl: `https://${serverName}`,
    identityServerUrl: fallbackIdentityServerUrl,
    source: 'derived_server_name',
    serverName
  }
}

function normalizeServerName(input: string): string {
  return input
    .trim()
    .replace(/^https?:\/\//, '')
    .replace(/\/+$/, '')
    .replace(/\/.*$/, '')
}

function parseWellKnownEndpoint(document: WellKnownDocument, serverName: string): MatrixDiscoveryResult | null {
  const homeserverBaseUrl =
    typeof document['m.homeserver']?.base_url === 'string' ? document['m.homeserver']?.base_url : ''

  const normalizedHomeserverUrl = normalizeOptionalHttpUrl(homeserverBaseUrl)
  if (!normalizedHomeserverUrl) {
    return null
  }

  const identityServerBaseUrl =
    typeof document['m.identity_server']?.base_url === 'string' ? document['m.identity_server']?.base_url : ''

  return {
    homeserverUrl: normalizedHomeserverUrl,
    identityServerUrl: normalizeOptionalHttpUrl(identityServerBaseUrl),
    source: 'well_known',
    serverName
  }
}

export async function discoverMatrixEndpoints(
  input: string,
  fallbackConfig?: Partial<MatrixEndpointConfig>
): Promise<MatrixDiscoveryResult> {
  const trimmedInput = input.trim()
  if (!trimmedInput) {
    throw new Error('缺少服务发现输入')
  }

  // 优先尝试从 Consul 服务发现解析 (ADR-002)
  // 注意：只有用户输入的不是 explicit URL 时才尝试 Consul discovery。
  // explicit URL（http://... 或 https://...）直接走 explicit_url 路径，
  // 避免把完整 URL 当作 Consul tag 传入。
  const isExplicitUrl = trimmedInput.startsWith('http://') || trimmedInput.startsWith('https://')
  const consulUrl = getConsulUrl()
  if (consulUrl && !isExplicitUrl) {
    // 用 server_name（去协议、去路径、去尾部斜杠后的主机[:端口]）作为 tag，
    // 与 Consul 中注册的 matrix-homeserver 实例 tags 匹配。
    const serverNameTag = normalizeServerName(trimmedInput)
    const instance = await resolveMatrixHomeserverFromConsul(consulUrl, serverNameTag)
    if (instance) {
      const protocol = instance.metadata?.protocol || 'http'
      return {
        homeserverUrl: `${protocol}://${instance.address}:${instance.port}`,
        identityServerUrl:
          instance.metadata?.identity_url || normalizeOptionalHttpUrl(fallbackConfig?.identityServerUrl),
        source: 'sdk_discovery'
      }
    }
  }

  if (trimmedInput.startsWith('http://') || trimmedInput.startsWith('https://')) {
    const homeserverUrl = normalizeHttpUrl(trimmedInput)
    if (!isValidHttpUrl(homeserverUrl)) {
      throw new Error('无效的 homeserver 地址')
    }

    return {
      homeserverUrl,
      identityServerUrl: normalizeOptionalHttpUrl(fallbackConfig?.identityServerUrl),
      source: 'explicit_url'
    }
  }

  const serverName = normalizeServerName(trimmedInput)
  const fallbackResult = buildFallbackConfig(serverName, fallbackConfig)

  try {
    const response = await getRuntimeAwareFetch()(`https://${serverName}${MATRIX_WELL_KNOWN_PATH}`)
    if (!response.ok) {
      return fallbackResult
    }

    const document = (await response.json()) as WellKnownDocument
    return parseWellKnownEndpoint(document, serverName) ?? fallbackResult
  } catch (err) {
    logger.debug(`well-known 发现失败，回退默认端点 (${serverName}): ${err}`)
    return fallbackResult
  }
}

export async function discoverAndSaveMatrixEndpoints(
  input: string,
  fallbackConfig?: Partial<MatrixEndpointConfig>
): Promise<MatrixDiscoveryResult> {
  const discovery = await discoverMatrixEndpoints(input, fallbackConfig)

  return {
    ...discovery,
    homeserverUrl: saveMatrixHomeserverUrl(discovery.homeserverUrl),
    identityServerUrl: saveMatrixIdentityServerUrl(discovery.identityServerUrl)
  }
}
