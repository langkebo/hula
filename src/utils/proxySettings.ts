import type { ProxySettings } from '@/typings/global'
import { safeJsonParse, validateObject } from '@/utils/typeGuard'

const LEGACY_PROXY_PORT = '28008'
const LEGACY_PROXY_HOSTS = new Set(['localhost', '127.0.0.1'])

export function createEmptyProxySettings(): ProxySettings {
  return {
    apiType: '',
    apiIp: '',
    apiPort: '',
    apiSuffix: '',
    wsType: '',
    wsIp: '',
    wsPort: '',
    wsSuffix: ''
  }
}

function isRemoteHomeserverUrl(homeserverUrl: string): boolean {
  try {
    const url = new URL(homeserverUrl)
    return !LEGACY_PROXY_HOSTS.has(url.hostname)
  } catch {
    return false
  }
}

function isLegacyApiProxy(settings: ProxySettings): boolean {
  return (
    (settings.apiType === 'http' || settings.apiType === 'https') &&
    LEGACY_PROXY_HOSTS.has(settings.apiIp) &&
    settings.apiPort === LEGACY_PROXY_PORT
  )
}

function isLegacyWsProxy(settings: ProxySettings): boolean {
  return (
    (settings.wsType === 'ws' || settings.wsType === 'wss') &&
    LEGACY_PROXY_HOSTS.has(settings.wsIp) &&
    settings.wsPort === LEGACY_PROXY_PORT
  )
}

export function migrateLegacyProxySettings(settings: ProxySettings, defaultHomeserverUrl: string): ProxySettings {
  if (!isRemoteHomeserverUrl(defaultHomeserverUrl)) {
    return settings
  }

  const migrated = { ...settings }

  if (isLegacyApiProxy(migrated)) {
    migrated.apiType = ''
    migrated.apiIp = ''
    migrated.apiPort = ''
    migrated.apiSuffix = ''
  }

  if (isLegacyWsProxy(migrated)) {
    migrated.wsType = ''
    migrated.wsIp = ''
    migrated.wsPort = ''
    migrated.wsSuffix = ''
  }

  return migrated
}

export function hasActiveProxySettings(settings: ProxySettings): boolean {
  return Boolean(settings.apiType || settings.wsType)
}

export function parseStoredProxySettings(value: string | null, defaultHomeserverUrl: string): ProxySettings | null {
  if (!value) {
    return null
  }

  const isValidProxySettings = (val: unknown): val is Partial<ProxySettings> =>
    validateObject<Record<string, unknown>>(val, [], {
      apiType: (v) => v === undefined || typeof v === 'string',
      apiIp: (v) => v === undefined || typeof v === 'string',
      apiPort: (v) => v === undefined || typeof v === 'string',
      apiSuffix: (v) => v === undefined || typeof v === 'string',
      wsType: (v) => v === undefined || typeof v === 'string',
      wsIp: (v) => v === undefined || typeof v === 'string',
      wsPort: (v) => v === undefined || typeof v === 'string',
      wsSuffix: (v) => v === undefined || typeof v === 'string'
    })

  const parsed = safeJsonParse(value, isValidProxySettings, createEmptyProxySettings())
  const merged = {
    ...createEmptyProxySettings(),
    ...parsed
  }
  const migrated = migrateLegacyProxySettings(merged, defaultHomeserverUrl)

  if (!hasActiveProxySettings(migrated)) {
    return null
  }

  return migrated
}
