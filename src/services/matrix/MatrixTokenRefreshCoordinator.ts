import { hasTauriRuntime } from '@/utils/AppHarness'
import { createLogger } from '@/utils/Logger'
import { persistRefreshedToken } from './matrixClientPlatform'

const logger = createLogger('TokenRefresh')

/**
 * access token refresh 协调器（P-26 并发吊销修复）。
 *
 * 背景：登录/恢复会话时，多个窗口（login、home、tray）会各自调用
 * `client.refreshToken()`。服务端 refresh 是 CAS 轮换：第一个请求成功并作废旧
 * refresh token，后续重放旧 token 会触发 reuse detection，**吊销该用户全部
 * refresh token 与 access token**，表现为登录后数秒必然掉线。
 *
 * 因此 refresh 必须收敛为「单一入口 + 单一执行者」：
 *  1. 同窗口：同一 refresh token 的并发调用共享同一个 Promise（single-flight），
 *     并在成功后保留 60s 的短期结果缓存，避免晚到的调用方重放旧 token。
 *  2. 跨窗口：每个 WebviewWindow 是独立 JS 上下文，内存锁无效，改由 Rust 侧
 *     的租约（`begin_token_refresh` / `finish_token_refresh`）串行化。非 owner
 *     窗口直接复用 owner 刚轮换出的凭证，不发 HTTP。
 *  3. 执行前先读一次持久化凭证：若其他窗口已轮换（存储中的 refresh token 与
 *     内存中的不同），直接采用存储值，避免用过期 token 发起 refresh。
 */

interface RefreshResponseLike {
  access_token?: string
  refresh_token?: string
  expires_in_ms?: number
  expires_in?: number
}

interface RefreshCapableClient {
  refreshToken(refreshToken: string): Promise<RefreshResponseLike>
  setAccessToken?(token: string): void
}

export interface RefreshedTokens {
  accessToken: string
  refreshToken: string
  expiresInMs: number
}

export interface TokenRefreshResult extends RefreshedTokens {
  /** true = 本窗口实际发起了 refresh 并完成轮换；false = 复用了其他调用/窗口的结果 */
  refreshed: boolean
}

type RefreshSource = 'loginWithToken' | 'tokenManager'

interface ClientRefreshState {
  inFlight: Map<string, Promise<TokenRefreshResult>>
  recent: Map<string, { tokens: RefreshedTokens; at: number }>
}

/** 同一 refresh token 成功后 60s 内，晚到的调用直接复用结果（不再发 HTTP） */
const RECENT_SUCCESS_TTL_MS = 60_000
/** 等待其他窗口完成 refresh 的最长时间（Rust 侧租约 TTL 为 30s） */
const LEASE_WAIT_TIMEOUT_MS = 20_000
const LEASE_POLL_INTERVAL_MS = 100

const clientStates = new WeakMap<RefreshCapableClient, ClientRefreshState>()

/**
 * 解析 token 有效期（毫秒）。
 *
 * 规范字段是 `expires_in`（**秒**），`expires_in_ms` 是草案扩展。synapse-rust 只返回
 * `expires_in`（实测 register/refresh 都是 86400），只读 `expires_in_ms` 会恒为 0，
 * 导致 `schedule()` 从不排期、access token 24h 到期即掉线。
 *
 * @returns 毫秒数；无法判定时 0（= 不排期）
 */
export function resolveTokenExpiryMs(response: unknown): number {
  const { expires_in_ms: fromMs, expires_in: fromSeconds } = (response ?? {}) as {
    expires_in_ms?: unknown
    expires_in?: unknown
  }
  if (typeof fromMs === 'number' && Number.isFinite(fromMs) && fromMs > 0) return fromMs
  if (typeof fromSeconds === 'number' && Number.isFinite(fromSeconds) && fromSeconds > 0) {
    return fromSeconds * 1000
  }
  return 0
}

interface TokenRefreshLease {
  /** owner = 由本窗口执行 refresh；wait = 其他窗口正在刷新；reuse = 已轮换，直接复用 */
  status: 'owner' | 'wait' | 'reuse'
  token?: string | null
  refreshToken?: string | null
  expiresInMs?: number | null
}

function getClientState(client: RefreshCapableClient): ClientRefreshState {
  let state = clientStates.get(client)
  if (!state) {
    state = { inFlight: new Map(), recent: new Map() }
    clientStates.set(client, state)
  }
  return state
}

function applyAccessToken(client: RefreshCapableClient, tokens: RefreshedTokens): void {
  client.setAccessToken?.(tokens.accessToken)
}

function rememberRecent(state: ClientRefreshState, key: string, tokens: RefreshedTokens): void {
  state.recent.set(key, { tokens, at: Date.now() })
}

function findRecent(state: ClientRefreshState, key: string): RefreshedTokens | null {
  const cached = state.recent.get(key)
  if (!cached) return null
  if (Date.now() - cached.at > RECENT_SUCCESS_TTL_MS) {
    state.recent.delete(key)
    return null
  }
  return cached.tokens
}

/** Rust 刷新租约命令参数：begin 只带 uid，finish 回写轮换结果，get_user_tokens 无参 */
type TokenRefreshLeaseArgs =
  | { uid: string }
  | {
      uid: string
      token: string | null
      refreshToken: string | null
      expiresInMs: number | null
    }
  | Record<string, never>

async function invokeLease<T>(command: string, args: TokenRefreshLeaseArgs): Promise<T> {
  const { invoke } = await import('@tauri-apps/api/core')
  return invoke<T>(command, args)
}

async function beginLease(uid: string): Promise<TokenRefreshLease | null> {
  if (!hasTauriRuntime() || !uid) return null
  try {
    return await invokeLease<TokenRefreshLease>('begin_token_refresh', { uid })
  } catch (err) {
    // 租约不可用时降级为「本窗口执行」，至少不会完全阻断刷新
    logger.warn(`[TokenRefresh] 获取刷新租约失败，降级为本地执行: ${err}`)
    return null
  }
}

async function finishLease(uid: string, tokens: RefreshedTokens | null): Promise<void> {
  if (!hasTauriRuntime() || !uid) return
  try {
    await invokeLease<void>('finish_token_refresh', {
      uid,
      token: tokens?.accessToken ?? null,
      refreshToken: tokens?.refreshToken ?? null,
      expiresInMs: tokens?.expiresInMs ?? null
    })
  } catch (err) {
    logger.warn(`[TokenRefresh] 释放刷新租约失败: ${err}`)
  }
}

/**
 * 读取 Rust 侧已持久化的凭证，用于识别「其他窗口已轮换」的情况。
 * 非 Tauri 运行期（浏览器 dev / E2E）无共享存储，直接返回 null。
 */
async function readPersistedTokens(uid: string): Promise<RefreshedTokens | null> {
  if (!hasTauriRuntime() || !uid) return null
  try {
    const stored = await invokeLease<{
      uid?: string | null
      token?: string | null
      refreshToken?: string | null
    }>('get_user_tokens', {})
    if (!stored?.token || !stored.refreshToken) return null
    if (stored.uid && stored.uid !== uid) return null
    return { accessToken: stored.token, refreshToken: stored.refreshToken, expiresInMs: 0 }
  } catch (err) {
    logger.warn(`[TokenRefresh] 读取已持久化凭证失败: ${err}`)
    return null
  }
}

/**
 * 竞争刷新租约。返回 null 表示当前环境无跨窗口协调，由本窗口直接执行。
 */
async function acquireLease(uid: string): Promise<TokenRefreshLease | null> {
  if (!hasTauriRuntime() || !uid) return null
  const deadline = Date.now() + LEASE_WAIT_TIMEOUT_MS
  while (Date.now() < deadline) {
    const lease = await beginLease(uid)
    if (!lease) return null
    if (lease.status !== 'wait') return lease
    await new Promise((resolve) => setTimeout(resolve, LEASE_POLL_INTERVAL_MS))
  }
  logger.warn(`[TokenRefresh] 等待其他窗口刷新超时，降级为本窗口执行（uid=${uid}）`)
  return NoneLease
}

const NoneLease: TokenRefreshLease = { status: 'owner' }

/**
 * 刷新 access token（全局唯一入口）。
 *
 * 并发调用方共享同一个刷新结果；跨窗口由 Rust 租约保证只有一个窗口真正发请求。
 *
 * @throws 底层 SDK/网络错误（由调用方按各自策略处理重试或登出）
 */
export async function refreshAccessToken(
  client: RefreshCapableClient,
  uid: string,
  refreshToken: string,
  source: RefreshSource
): Promise<TokenRefreshResult> {
  if (!refreshToken) {
    throw new Error('缺少 refresh token，无法刷新')
  }

  const state = getClientState(client)
  const key = `${uid}:${refreshToken}`

  const recent = findRecent(state, key)
  if (recent) {
    applyAccessToken(client, recent)
    logger.info(`[TokenRefresh] 复用近期刷新结果（source=${source}, uid=${uid}）`)
    return { ...recent, refreshed: false }
  }

  const inFlight = state.inFlight.get(key)
  if (inFlight) {
    logger.info(`[TokenRefresh] 合并并发刷新请求（source=${source}, uid=${uid}）`)
    return inFlight
  }

  const task = runRefresh(client, uid, refreshToken, source, state, key)
  state.inFlight.set(key, task)
  try {
    return await task
  } finally {
    state.inFlight.delete(key)
  }
}

async function runRefresh(
  client: RefreshCapableClient,
  uid: string,
  refreshToken: string,
  source: RefreshSource,
  state: ClientRefreshState,
  key: string
): Promise<TokenRefreshResult> {
  const lease = await acquireLease(uid)

  if (lease?.status === 'reuse') {
    const tokens: RefreshedTokens = {
      accessToken: lease.token ?? '',
      refreshToken: lease.refreshToken ?? refreshToken,
      expiresInMs: lease.expiresInMs ?? 0
    }
    if (tokens.accessToken) {
      applyAccessToken(client, tokens)
      rememberRecent(state, key, tokens)
      logger.info(`[TokenRefresh] 复用其他窗口已轮换的 token（source=${source}, uid=${uid}）`)
      return { ...tokens, refreshed: false }
    }
    // 租约返回的凭证不可用时按 owner 处理，继续走本地刷新
  }

  try {
    // 关键：执行前读取共享存储。其他窗口可能已轮换，用旧 token 重放会触发 reuse detection。
    const persisted = await readPersistedTokens(uid)
    if (persisted && persisted.refreshToken !== refreshToken) {
      applyAccessToken(client, persisted)
      rememberRecent(state, key, persisted)
      await finishLease(uid, persisted)
      logger.info(`[TokenRefresh] 检测到其他窗口已轮换，采用最新持久化凭证（source=${source}, uid=${uid}）`)
      return { ...persisted, refreshed: false }
    }

    logger.info(`[TokenRefresh] Attempting token refresh（source=${source}, uid=${uid}）`)
    const response = await client.refreshToken(persisted?.refreshToken ?? refreshToken)
    const accessToken = response?.access_token
    if (!accessToken) {
      throw new Error('refresh 响应缺少 access_token')
    }

    const tokens: RefreshedTokens = {
      accessToken,
      refreshToken: response.refresh_token || persisted?.refreshToken || refreshToken,
      expiresInMs: resolveTokenExpiryMs(response)
    }

    applyAccessToken(client, tokens)
    if (uid) {
      try {
        await persistRefreshedToken(uid, tokens.accessToken, tokens.refreshToken)
      } catch (err) {
        // 持久化失败不退化为刷新失败：内存态已切换，下次刷新前会再次对齐存储
        logger.error(`[TokenRefresh] 持久化刷新结果失败（source=${source}, uid=${uid}）: ${err}`)
      }
    }
    await finishLease(uid, tokens)

    rememberRecent(state, key, tokens)
    rememberRecent(state, `${uid}:${tokens.refreshToken}`, tokens)
    logger.info(
      `[TokenRefresh] Access token refreshed successfully（source=${source}, uid=${uid}, expiresInMs=${tokens.expiresInMs}）`
    )
    return { ...tokens, refreshed: true }
  } catch (err) {
    // 失败也必须释放租约，否则其他窗口会一直等待
    await finishLease(uid, null)
    throw err
  }
}
