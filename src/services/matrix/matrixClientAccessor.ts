import type { MatrixClient } from 'matrix-js-sdk'
import type { TelemetryManager } from 'matrix-js-sdk/telemetry'
import { createLogger } from '@/utils/Logger'

interface MatrixClientAccessor {
  getClient(): MatrixClient | null
  getAccessToken?(): string | null
  getHomeserverUrl?(): string | null
  getTelemetry?(): TelemetryManager | null
  waitForClientReady?(opts?: { timeoutMs?: number; intervalMs?: number }): Promise<MatrixClient>
}

type MatrixClientAccessorGlobal = typeof globalThis & {
  __TJG_MATRIX_CLIENT_ACCESSOR__?: MatrixClientAccessor | null
}

let hasWarnedLegacyFallback = false
const logger = createLogger('matrixClientAccessor')

function readRuntimeAccessor(): MatrixClientAccessor | null {
  return (globalThis as MatrixClientAccessorGlobal).__TJG_MATRIX_CLIENT_ACCESSOR__ ?? null
}

function writeRuntimeAccessor(accessor: MatrixClientAccessor | null): void {
  ;(globalThis as MatrixClientAccessorGlobal).__TJG_MATRIX_CLIENT_ACCESSOR__ = accessor
}

function warnLegacyFallbackOnce(method: string): void {
  if (hasWarnedLegacyFallback || readRuntimeAccessor()) {
    return
  }

  hasWarnedLegacyFallback = true
  logger.debug(`"${method}" 在 accessor 注册前被调用，请检查 MatrixClientService 初始化顺序`)
}

export function setMatrixClientAccessor(accessor: MatrixClientAccessor): void {
  writeRuntimeAccessor(accessor)
}

export function hasRegisteredMatrixClientAccessor(): boolean {
  return readRuntimeAccessor() !== null
}

export function resetMatrixClientAccessorForTests(): void {
  writeRuntimeAccessor(null)
  hasWarnedLegacyFallback = false
}

function getMatrixClientAccessor(): MatrixClientAccessor | null {
  return readRuntimeAccessor()
}

export function getMatrixClient(): MatrixClient | null {
  warnLegacyFallbackOnce('getClient')
  return getMatrixClientAccessor()?.getClient() ?? null
}

export function getMatrixAccessToken(): string | null {
  warnLegacyFallbackOnce('getAccessToken')
  return getMatrixClientAccessor()?.getAccessToken?.() ?? null
}

export function getMatrixHomeserverUrl(): string | null {
  warnLegacyFallbackOnce('getHomeserverUrl')
  return getMatrixClientAccessor()?.getHomeserverUrl?.() ?? null
}

export function waitForMatrixClientReady(opts?: { timeoutMs?: number; intervalMs?: number }): Promise<MatrixClient> {
  warnLegacyFallbackOnce('waitForClientReady')
  const accessorPromise = getMatrixClientAccessor()?.waitForClientReady?.(opts)
  if (accessorPromise) {
    return accessorPromise
  }

  return Promise.reject(new Error('Matrix client accessor is not registered'))
}
