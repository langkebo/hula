import { createLogger } from '@/utils/Logger'
import { deleteSecureSecret, getSecureSecret, setSecureSecret } from './secureStorage'
import { decryptFromSession, encryptForSession } from './sessionCrypto'

const logger = createLogger('RobotAiProviderStorage')

const STORAGE_KEYS = {
  AI_PROVIDER: 'hula-chat-ai-provider',
  OPENCLAW_CONFIG: 'hula-chat-openclaw-config',
  OPENCLAW_TOKEN_SESSION: 'hula-chat-openclaw-token-session',
  OPENCLAW_TOKEN_SECURE: 'hula-chat-openclaw-token',
  TRENDRADAR_CONFIG: 'hula-chat-trendradar-config',
  TRENDRADAR_API_KEY_SESSION: 'hula-chat-trendradar-api-key-session',
  TRENDRADAR_API_KEY_SECURE: 'hula-chat-trendradar-api-key'
} as const

export type RobotAiProvider = 'hula' | 'openclaw' | 'siliconflow' | 'trendradar'

export interface StoredOpenClawConfig {
  gatewayUrl: string
  token: string
  autoConnect: boolean
  reconnect: boolean
  reconnectInterval: number
  maxReconnectAttempts: number
  heartbeatInterval: number
  temperature: number
  maxTokens: number
  topP: number
  presencePenalty: number
  frequencyPenalty: number
}

export interface StoredTrendRadarConfig {
  apiUrl: string
  apiKey: string
}

export interface RobotStorageScopeOptions {
  userId?: string | null
}

const ANONYMOUS_SCOPE = 'anonymous'

function canUseWebStorage(): boolean {
  return typeof window !== 'undefined'
}

function normalizeString(value: unknown): string {
  return typeof value === 'string' ? value.trim() : ''
}

function normalizeBoolean(value: unknown, fallback: boolean): boolean {
  return typeof value === 'boolean' ? value : fallback
}

function normalizePositiveInteger(value: unknown, fallback: number, minimum = 1): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return fallback
  }

  return Math.max(minimum, Math.round(value))
}

function normalizeNumberInRange(value: unknown, fallback: number, minimum: number, maximum: number): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return fallback
  }

  return Math.min(maximum, Math.max(minimum, Number(value.toFixed(2))))
}

function resolveScopeId(options?: RobotStorageScopeOptions): string | null {
  if (!options) {
    return null
  }
  const scopedUserId = normalizeString(options?.userId)
  return scopedUserId || ANONYMOUS_SCOPE
}

function buildScopedKey(baseKey: string, options?: RobotStorageScopeOptions): string {
  const scopeId = resolveScopeId(options)
  if (!scopeId) {
    return baseKey
  }
  return `${baseKey}::${scopeId}`
}

async function persistSecret(secureKey: string, sessionKey: string, value: string): Promise<void> {
  if (!canUseWebStorage()) {
    return
  }

  if (!value) {
    window.sessionStorage.removeItem(sessionKey)
    await deleteSecureSecret(secureKey)
    return
  }

  const storedInSecureStorage = await setSecureSecret(secureKey, value)
  if (storedInSecureStorage) {
    window.sessionStorage.removeItem(sessionKey)
    return
  }

  const encrypted = await encryptForSession(value)
  window.sessionStorage.setItem(sessionKey, encrypted)
}

async function loadSecret(secureKey: string, sessionKey: string): Promise<string> {
  if (!canUseWebStorage()) {
    return ''
  }

  const secureValue = await getSecureSecret(secureKey)
  if (secureValue) {
    return secureValue
  }

  const raw = window.sessionStorage.getItem(sessionKey)
  if (!raw) {
    return ''
  }
  return (await decryptFromSession(raw)).trim()
}

async function loadScopedSecret(
  secureKey: string,
  sessionKey: string,
  options?: RobotStorageScopeOptions
): Promise<string> {
  const scopedSecureKey = buildScopedKey(secureKey, options)
  const scopedSessionKey = buildScopedKey(sessionKey, options)
  const scopedValue = await loadSecret(scopedSecureKey, scopedSessionKey)
  if (scopedValue) {
    return scopedValue
  }

  const legacyValue = await loadSecret(secureKey, sessionKey)
  if (legacyValue && resolveScopeId(options)) {
    await persistSecret(scopedSecureKey, scopedSessionKey, legacyValue)
  }
  return legacyValue
}

async function persistScopedSecret(
  secureKey: string,
  sessionKey: string,
  value: string,
  options?: RobotStorageScopeOptions
): Promise<void> {
  await persistSecret(buildScopedKey(secureKey, options), buildScopedKey(sessionKey, options), value)
}

function parseStoredJson<T extends Record<string, unknown>>(key: string): T | null {
  if (!canUseWebStorage()) {
    return null
  }

  const raw = window.localStorage.getItem(key)
  if (!raw) {
    return null
  }

  try {
    return JSON.parse(raw) as T
  } catch (error) {
    logger.warn(`解析存储配置失败: ${key}`, error)
    return null
  }
}

function parseScopedStoredJson<T extends Record<string, unknown>>(
  key: string,
  options?: RobotStorageScopeOptions
): T | null {
  const scopedKey = buildScopedKey(key, options)
  const scopedValue = parseStoredJson<T>(scopedKey)
  if (scopedValue) {
    return scopedValue
  }

  const legacyValue = parseStoredJson<T>(key)
  if (legacyValue && canUseWebStorage() && resolveScopeId(options)) {
    window.localStorage.setItem(scopedKey, JSON.stringify(legacyValue))
  }
  return legacyValue
}

function persistScopedJson(key: string, value: Record<string, unknown>, options?: RobotStorageScopeOptions): void {
  if (!canUseWebStorage()) {
    return
  }
  window.localStorage.setItem(buildScopedKey(key, options), JSON.stringify(value))
}

export function loadRobotAiProvider(options?: RobotStorageScopeOptions): RobotAiProvider | null {
  if (!canUseWebStorage()) {
    return null
  }

  const scopedKey = buildScopedKey(STORAGE_KEYS.AI_PROVIDER, options)
  const stored = window.localStorage.getItem(scopedKey) ?? window.localStorage.getItem(STORAGE_KEYS.AI_PROVIDER)
  if (stored && ['hula', 'openclaw', 'siliconflow', 'trendradar'].includes(stored)) {
    if (resolveScopeId(options) && window.localStorage.getItem(scopedKey) !== stored) {
      window.localStorage.setItem(scopedKey, stored)
    }
    return stored as RobotAiProvider
  }

  return null
}

export function saveRobotAiProvider(provider: RobotAiProvider, options?: RobotStorageScopeOptions): void {
  if (!canUseWebStorage()) {
    return
  }

  window.localStorage.setItem(buildScopedKey(STORAGE_KEYS.AI_PROVIDER, options), provider)
}

export async function loadRobotOpenClawConfig(
  defaults: StoredOpenClawConfig,
  options?: RobotStorageScopeOptions
): Promise<StoredOpenClawConfig> {
  const legacyConfig = parseScopedStoredJson<{
    gatewayUrl?: string
    token?: string
    autoConnect?: boolean
    reconnect?: boolean
    reconnectInterval?: number
    maxReconnectAttempts?: number
    heartbeatInterval?: number
    temperature?: number
    maxTokens?: number
    topP?: number
    presencePenalty?: number
    frequencyPenalty?: number
  }>(STORAGE_KEYS.OPENCLAW_CONFIG, options)
  const gatewayUrl = normalizeString(legacyConfig?.gatewayUrl) || defaults.gatewayUrl
  const legacyToken = normalizeString(legacyConfig?.token)
  const autoConnect = normalizeBoolean(legacyConfig?.autoConnect, defaults.autoConnect ?? true)
  const reconnect = normalizeBoolean(legacyConfig?.reconnect, defaults.reconnect ?? true)
  const reconnectInterval = normalizePositiveInteger(
    legacyConfig?.reconnectInterval,
    defaults.reconnectInterval ?? 3000,
    500
  )
  const maxReconnectAttempts = normalizePositiveInteger(
    legacyConfig?.maxReconnectAttempts,
    defaults.maxReconnectAttempts ?? 5
  )
  const heartbeatInterval = normalizePositiveInteger(
    legacyConfig?.heartbeatInterval,
    defaults.heartbeatInterval ?? 30000,
    1000
  )
  const temperature = normalizeNumberInRange(legacyConfig?.temperature, defaults.temperature ?? 0.7, 0, 2)
  const maxTokens = normalizePositiveInteger(legacyConfig?.maxTokens, defaults.maxTokens ?? 4096, 1)
  const topP = normalizeNumberInRange(legacyConfig?.topP, defaults.topP ?? 1.0, 0, 1)
  const presencePenalty = normalizeNumberInRange(legacyConfig?.presencePenalty, defaults.presencePenalty ?? 0.0, -2, 2)
  const frequencyPenalty = normalizeNumberInRange(
    legacyConfig?.frequencyPenalty,
    defaults.frequencyPenalty ?? 0.0,
    -2,
    2
  )

  if (legacyToken) {
    await persistScopedSecret(
      STORAGE_KEYS.OPENCLAW_TOKEN_SECURE,
      STORAGE_KEYS.OPENCLAW_TOKEN_SESSION,
      legacyToken,
      options
    )
  }

  persistScopedJson(
    STORAGE_KEYS.OPENCLAW_CONFIG,
    {
      gatewayUrl,
      autoConnect,
      reconnect,
      reconnectInterval,
      maxReconnectAttempts,
      heartbeatInterval,
      temperature,
      maxTokens,
      topP,
      presencePenalty,
      frequencyPenalty
    },
    options
  )

  return {
    gatewayUrl,
    token:
      (await loadScopedSecret(STORAGE_KEYS.OPENCLAW_TOKEN_SECURE, STORAGE_KEYS.OPENCLAW_TOKEN_SESSION, options)) ||
      defaults.token,
    autoConnect,
    reconnect,
    reconnectInterval,
    maxReconnectAttempts,
    heartbeatInterval,
    temperature,
    maxTokens,
    topP,
    presencePenalty,
    frequencyPenalty
  }
}

export async function saveRobotOpenClawConfig(
  config: StoredOpenClawConfig,
  options?: RobotStorageScopeOptions
): Promise<StoredOpenClawConfig> {
  const normalized = {
    gatewayUrl: normalizeString(config.gatewayUrl),
    token: normalizeString(config.token),
    autoConnect: normalizeBoolean(config.autoConnect, true),
    reconnect: normalizeBoolean(config.reconnect, true),
    reconnectInterval: normalizePositiveInteger(config.reconnectInterval, 3000, 500),
    maxReconnectAttempts: normalizePositiveInteger(config.maxReconnectAttempts, 5),
    heartbeatInterval: normalizePositiveInteger(config.heartbeatInterval, 30000, 1000),
    temperature: normalizeNumberInRange(config.temperature, 0.7, 0, 2),
    maxTokens: normalizePositiveInteger(config.maxTokens, 4096, 1),
    topP: normalizeNumberInRange(config.topP, 1.0, 0, 1),
    presencePenalty: normalizeNumberInRange(config.presencePenalty, 0.0, -2, 2),
    frequencyPenalty: normalizeNumberInRange(config.frequencyPenalty, 0.0, -2, 2)
  }

  persistScopedJson(
    STORAGE_KEYS.OPENCLAW_CONFIG,
    {
      gatewayUrl: normalized.gatewayUrl,
      autoConnect: normalized.autoConnect,
      reconnect: normalized.reconnect,
      reconnectInterval: normalized.reconnectInterval,
      maxReconnectAttempts: normalized.maxReconnectAttempts,
      heartbeatInterval: normalized.heartbeatInterval,
      temperature: normalized.temperature,
      maxTokens: normalized.maxTokens,
      topP: normalized.topP,
      presencePenalty: normalized.presencePenalty,
      frequencyPenalty: normalized.frequencyPenalty
    },
    options
  )

  await persistScopedSecret(
    STORAGE_KEYS.OPENCLAW_TOKEN_SECURE,
    STORAGE_KEYS.OPENCLAW_TOKEN_SESSION,
    normalized.token,
    options
  )
  return normalized
}

export async function loadRobotTrendRadarConfig(
  defaults: StoredTrendRadarConfig,
  options?: RobotStorageScopeOptions
): Promise<StoredTrendRadarConfig> {
  const legacyConfig = parseScopedStoredJson<{ apiUrl?: string; apiKey?: string }>(
    STORAGE_KEYS.TRENDRADAR_CONFIG,
    options
  )
  const apiUrl = normalizeString(legacyConfig?.apiUrl) || defaults.apiUrl
  const legacyApiKey = normalizeString(legacyConfig?.apiKey)

  if (legacyApiKey) {
    await persistScopedSecret(
      STORAGE_KEYS.TRENDRADAR_API_KEY_SECURE,
      STORAGE_KEYS.TRENDRADAR_API_KEY_SESSION,
      legacyApiKey,
      options
    )
  }

  persistScopedJson(
    STORAGE_KEYS.TRENDRADAR_CONFIG,
    {
      apiUrl
    },
    options
  )

  return {
    apiUrl,
    apiKey:
      (await loadScopedSecret(
        STORAGE_KEYS.TRENDRADAR_API_KEY_SECURE,
        STORAGE_KEYS.TRENDRADAR_API_KEY_SESSION,
        options
      )) || defaults.apiKey
  }
}

export async function saveRobotTrendRadarConfig(
  config: StoredTrendRadarConfig,
  options?: RobotStorageScopeOptions
): Promise<StoredTrendRadarConfig> {
  const normalized = {
    apiUrl: normalizeString(config.apiUrl),
    apiKey: normalizeString(config.apiKey)
  }

  persistScopedJson(
    STORAGE_KEYS.TRENDRADAR_CONFIG,
    {
      apiUrl: normalized.apiUrl
    },
    options
  )

  await persistScopedSecret(
    STORAGE_KEYS.TRENDRADAR_API_KEY_SECURE,
    STORAGE_KEYS.TRENDRADAR_API_KEY_SESSION,
    normalized.apiKey,
    options
  )
  return normalized
}
