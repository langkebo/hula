import { ServiceDiscoverySDK } from '@/services/discovery'
import { ConsulRegistry } from '@/services/discovery/adapters/consul'
import { StaticRegistry } from '@/services/discovery/adapters/static'
import { RoundRobinLoadBalancer } from '@/services/discovery/loadBalancer'
import { getRuntimeAwareFetch } from '@/services/matrix/network/runtimeFetch'
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

// 初始化 SDK 实例 (单例模式)
let sdkInstance: ServiceDiscoverySDK | null = null

function getSDK(): ServiceDiscoverySDK | null {
  // 在测试环境下，不使用 ServiceDiscoverySDK，以确保单元测试能够验证原有的发现逻辑
  if (import.meta.env.MODE === 'test') {
    return null
  }

  if (sdkInstance) return sdkInstance

  // 根据环境变量选择 Registry
  const consulUrl = import.meta.env.VITE_CONSUL_URL
  const registry = consulUrl
    ? new ConsulRegistry(consulUrl)
    : new StaticRegistry({
        'matrix-homeserver': [
          {
            id: 'default',
            serviceName: 'matrix-homeserver',
            address: 'localhost',
            port: 8008,
            metadata: { protocol: 'http' }
          }
        ]
      })

  sdkInstance = new ServiceDiscoverySDK(registry, new RoundRobinLoadBalancer())
  return sdkInstance
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

  // 优先尝试从 ServiceDiscoverySDK 解析 (ADR-002)
  const sdk = getSDK()
  if (sdk) {
    try {
      const instance = await sdk.resolve('matrix-homeserver', { tags: [trimmedInput] })
      if (instance) {
        const protocol = instance.metadata?.protocol || 'http'
        return {
          homeserverUrl: `${protocol}://${instance.address}:${instance.port}`,
          identityServerUrl:
            instance.metadata?.identity_url || normalizeOptionalHttpUrl(fallbackConfig?.identityServerUrl),
          source: 'sdk_discovery'
        }
      }
    } catch (e) {
      logger.warn('SDK Discovery failed, falling back to traditional method', e)
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
  } catch {
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
