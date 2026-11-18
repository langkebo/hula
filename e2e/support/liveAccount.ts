/// <reference types="node" />
import { execFileSync } from 'node:child_process'
import crypto from 'node:crypto'
import type { MatrixLiveAuthStrategy, MatrixLiveEnv } from './matrixLive'

/**
 * 账号型运行态用例的公共夹具（批次 2 / 报告 §13.11 + §19.57）。
 *
 * 约定：
 * - **Node 侧**直接用 homeserver 原始地址（默认 `http://127.0.0.1:8008`）注册、建房、发消息；
 * - **浏览器侧**把 homeserver 改写为 app 同源（走 vite `/_matrix` 代理），避免 CORS；
 * - 真实部署开启了管理员 MFA（`ADMIN_MFA_REQUIRED`），提权账号必须先用 TOTP 换 token，
 *   再以 `restore-token` 策略注入页面（app 的密码登录不携带 `mfa_code`）。
 */

const BASE32_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567'
const DEFAULT_HOMESERVER_URL = 'http://127.0.0.1:8008'
const DEFAULT_DESKTOP_APP_URL = 'http://127.0.0.1:5211'
const DEFAULT_SERVER_NAME = 'matrix.test'

export interface LiveAccount {
  username: string
  password: string
  userId: string
  accessToken: string
  refreshToken: string
  displayName: string
}

const readEnv = (name: string): string => process.env[name]?.trim() ?? ''

const sleep = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms))

const isEnabledFlag = (value: string): boolean => value === '1' || value.toLowerCase() === 'true'

export const isMatrixLiveEnabled = (): boolean => isEnabledFlag(readEnv('MATRIX_LIVE_E2E'))

export const getLiveAccountSkipReason = (): string | null => (isMatrixLiveEnabled() ? null : '未启用 MATRIX_LIVE_E2E')

export const readLiveHomeserverUrl = (): string => readEnv('MATRIX_LIVE_HOMESERVER_URL') || DEFAULT_HOMESERVER_URL

export const readLiveAppUrl = (fallback = DEFAULT_DESKTOP_APP_URL): string => readEnv('MATRIX_LIVE_APP_URL') || fallback

export const readLiveServerName = (): string => readEnv('MATRIX_LIVE_SERVER_NAME') || DEFAULT_SERVER_NAME

/** 浏览器侧的 homeserver 必须与 app 同源，否则 `/_matrix` 直连会撞 CORS（与 matrixLive 同规则）。 */
const toBrowserHomeserverUrl = (homeserverUrl: string, appUrl: string): string => {
  try {
    const homeserver = new URL(homeserverUrl)
    const app = new URL(appUrl)
    if (!/^https?:$/i.test(app.protocol) || !/^https?:$/i.test(homeserver.protocol)) return homeserverUrl
    if (homeserver.origin === app.origin) return homeserverUrl
    return app.origin
  } catch {
    return homeserverUrl
  }
}

const readErrorMessage = async (response: Response): Promise<string> => {
  try {
    return (await response.text()).slice(0, 400)
  } catch {
    return '<unreadable body>'
  }
}

const matrixRequest = async <T>(
  homeserverUrl: string,
  path: string,
  init: RequestInit & { accessToken?: string } = {}
): Promise<T> => {
  const { accessToken, ...rest } = init
  const headers: Record<string, string> = {
    'content-type': 'application/json',
    ...(rest.headers as Record<string, string> | undefined)
  }
  if (accessToken) {
    headers.authorization = `Bearer ${accessToken}`
  }
  const response = await fetch(`${homeserverUrl}${path}`, { ...rest, headers })
  if (!response.ok) {
    throw new Error(`${init.method ?? 'GET'} ${path} -> ${response.status}: ${await readErrorMessage(response)}`)
  }
  return (await response.json()) as T
}

interface RegisterResponse {
  user_id: string
  access_token?: string
  refresh_token?: string
}

/**
 * 自注册一个临时账号（`m.login.dummy`）。
 *
 * 现有 live spec 已普遍这么做：不依赖环境里的固定账号，避免「账号不存在 / 密码不符」的假红。
 */
export const registerLiveAccount = async (
  homeserverUrl: string,
  options: { prefix?: string; password?: string } = {}
): Promise<LiveAccount> => {
  const prefix = (options.prefix ?? 'e2e').toLowerCase().replace(/[^a-z0-9]/g, '') || 'e2e'
  const username = `${prefix}${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`
  const password = options.password ?? `Pg!${Math.random().toString(36).slice(2, 12)}A1`

  let lastError: unknown = null
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    try {
      const data = await matrixRequest<RegisterResponse>(homeserverUrl, '/_matrix/client/v3/register', {
        method: 'POST',
        body: JSON.stringify({ username, password, auth: { type: 'm.login.dummy' } })
      })
      if (!data.access_token) {
        throw new Error('register 未返回 access_token（该服务器可能禁止注册后自动登录）')
      }
      return {
        username,
        password,
        userId: data.user_id,
        accessToken: data.access_token,
        refreshToken: data.refresh_token ?? '',
        displayName: username
      }
    } catch (error) {
      lastError = error
      if (!/429|M_LIMIT_EXCEEDED/i.test(String(error)) || attempt === 3) break
      await sleep(1500 * attempt)
    }
  }

  throw new Error(
    `注册 live 账号失败（${homeserverUrl}）：${lastError instanceof Error ? lastError.message : lastError}`
  )
}

/** 纯函数：RFC 6238 TOTP（SHA1 / 6 位 / 30s），仅用于对齐部署侧的 `ADMIN_MFA_SHARED_SECRET`。 */
export const generateTotpCode = (secret: string, atMs: number = Date.now()): string => {
  const normalized = secret.replace(/\s+/g, '').replace(/=+$/, '').toUpperCase()
  let bits = ''
  for (const char of normalized) {
    const value = BASE32_ALPHABET.indexOf(char)
    if (value < 0) throw new Error(`非法的 base32 密钥字符：${char}`)
    bits += value.toString(2).padStart(5, '0')
  }
  if (!bits.length) throw new Error('TOTP 密钥为空')

  const key = Buffer.alloc(Math.floor(bits.length / 8))
  for (let index = 0; index < key.length; index += 1) {
    key[index] = Number.parseInt(bits.slice(index * 8, index * 8 + 8), 2)
  }
  const counter = Math.floor(atMs / 1000 / 30)
  const buffer = Buffer.alloc(8)
  buffer.writeUInt32BE(Math.floor(counter / 2 ** 32), 0)
  buffer.writeUInt32BE(counter >>> 0, 4)
  const digest = crypto.createHmac('sha1', key).update(buffer).digest()
  const offset = digest[digest.length - 1] & 0xf
  return ((digest.readUInt32BE(offset) & 0x7fffffff) % 1_000_000).toString().padStart(6, '0')
}

/** 读取管理员 MFA 共享密钥：环境变量优先，其次从 app 容器读取（部署侧唯一事实源）。 */
export const readAdminMfaSecret = (): string => {
  const fromEnv = readEnv('MATRIX_LIVE_ADMIN_TOTP_SECRET') || readEnv('ADMIN_MFA_SHARED_SECRET')
  if (fromEnv) return fromEnv

  const container = readEnv('SYNAPSE_APP_CONTAINER') || 'synapse-app'
  try {
    return execFileSync('docker', ['exec', container, 'printenv', 'ADMIN_MFA_SHARED_SECRET'], {
      encoding: 'utf8'
    }).trim()
  } catch {
    return ''
  }
}

interface LoginResponse {
  user_id: string
  access_token: string
  refresh_token?: string
}

/**
 * 服务端密码登录（可选 TOTP）。
 *
 * `mfaCode` 传入时按 30s 窗口重试一次，抵消客户端与服务器时钟偏差。
 */
export const loginLiveAccount = async (
  homeserverUrl: string,
  credentials: { username: string; password: string; mfaCode?: () => string }
): Promise<LiveAccount> => {
  const maxAttempts = credentials.mfaCode ? 3 : 1
  let lastError: unknown = null

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    const mfaCode = credentials.mfaCode?.()
    try {
      const data = await matrixRequest<LoginResponse>(homeserverUrl, '/_matrix/client/v3/login', {
        method: 'POST',
        body: JSON.stringify({
          type: 'm.login.password',
          identifier: { type: 'm.id.user', user: credentials.username },
          password: credentials.password,
          ...(mfaCode ? { mfa_code: mfaCode } : {}),
          initial_device_display_name: 'TJG Playwright'
        })
      })
      return {
        username: credentials.username,
        password: credentials.password,
        userId: data.user_id,
        accessToken: data.access_token,
        refreshToken: data.refresh_token ?? '',
        displayName: credentials.username
      }
    } catch (error) {
      lastError = error
      if (attempt === maxAttempts) break
      await sleep(2000)
    }
  }

  throw new Error(`登录 live 账号失败：${lastError instanceof Error ? lastError.message : lastError}`)
}

const quoteSqlLiteral = (value: string): string => `'${value.replace(/'/g, "''")}'`

/**
 * 授予 / 回收管理端权限，并清掉管理端缓存。
 *
 * 两个开关都必须改：
 * - `users.is_admin`：synapse-rust 的前置校验（false 时直接 "Admin access required"）；
 * - `users.user_type`：RBAC 角色来源。空值被 `normalize_admin_role` 归一为 `none`，
 *   所有 RBAC 端点 403（`Admin role 'none' is not allowed to access this resource`）。
 *
 * 注意：权限不是 JWT claim，而是服务端 `user:admin:{userId}` 缓存（TTL 60s）。
 * 只改库不清缓存，最坏要等 60s 才生效。
 */
export const setLiveAdminFlag = (username: string, isAdmin = true): void => {
  const dbContainer = readEnv('SYNAPSE_DB_CONTAINER') || 'synapse-postgres'
  const dbUser = readEnv('SYNAPSE_DB_USER') || 'synapse'
  const dbName = readEnv('SYNAPSE_DB_NAME') || 'synapse'
  const role = isAdmin ? "'admin'" : 'null'
  const sql = `update users set is_admin=${isAdmin ? 'true' : 'false'}, user_type=${role} where username=${quoteSqlLiteral(username)}`

  execFileSync('docker', ['exec', dbContainer, 'psql', '-U', dbUser, '-d', dbName, '-tAc', sql], {
    encoding: 'utf8'
  })

  const redisContainer = readEnv('SYNAPSE_REDIS_CONTAINER') || 'synapse-redis'
  const serverName = readLiveServerName()
  for (const key of [`user:admin:@${username}:${serverName}`, `user:admin:${username}:${serverName}`]) {
    try {
      execFileSync('docker', ['exec', redisContainer, 'redis-cli', 'DEL', key], { encoding: 'utf8' })
    } catch {
      // 缓存键不存在 / redis 不可用时忽略：最坏退化为等待 TTL
    }
  }
}

interface CreateRoomResponse {
  room_id: string
}

export const createLiveRoom = async (
  homeserverUrl: string,
  accessToken: string,
  options: { name: string; topic?: string; invite?: string[] }
): Promise<string> => {
  const data = await matrixRequest<CreateRoomResponse>(homeserverUrl, '/_matrix/client/v3/createRoom', {
    method: 'POST',
    accessToken,
    body: JSON.stringify({
      name: options.name,
      topic: options.topic ?? '',
      preset: 'private_chat',
      visibility: 'private',
      ...(options.invite?.length ? { invite: options.invite } : {})
    })
  })
  return data.room_id
}

export const sendLiveRoomMessage = async (
  homeserverUrl: string,
  accessToken: string,
  roomId: string,
  body: string,
  transactionId: string = `pw-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
): Promise<string> => {
  const data = await matrixRequest<{ event_id: string }>(
    homeserverUrl,
    `/_matrix/client/v3/rooms/${encodeURIComponent(roomId)}/send/m.room.message/${encodeURIComponent(transactionId)}`,
    {
      method: 'PUT',
      accessToken,
      body: JSON.stringify({ msgtype: 'm.text', body })
    }
  )
  return data.event_id
}

export interface BuildLiveEnvOptions {
  account: LiveAccount
  appUrl?: string
  homeserverUrl?: string
  authStrategy?: MatrixLiveAuthStrategy
  roomId?: string
  roomName?: string
  messagePrefix?: string
}

/** 合成 `MatrixLiveEnv`：把账号凭据 + 正确的浏览器侧 homeserver 一次性组装好。 */
export const buildLiveEnv = (options: BuildLiveEnvOptions): MatrixLiveEnv => {
  const appUrl = options.appUrl || readLiveAppUrl()
  const rawHomeserver = options.homeserverUrl || readLiveHomeserverUrl()

  return {
    enabled: true,
    authStrategy: options.authStrategy ?? 'password-api',
    homeserverUrl: toBrowserHomeserverUrl(rawHomeserver, appUrl),
    appUrl,
    identityServerUrl: '',
    username: options.account.username,
    password: options.account.password,
    userId: options.account.userId,
    accessToken: options.account.accessToken,
    refreshToken: options.account.refreshToken,
    displayName: options.account.displayName,
    roomId: options.roomId ?? '',
    roomName: options.roomName ?? '',
    expectedTimelineText: '',
    messagePrefix: options.messagePrefix ?? '[pw-account-live]',
    peerUsername: '',
    peerPassword: '',
    peerUserId: '',
    peerAccessToken: '',
    peerRefreshToken: '',
    peerDisplayName: '',
    localUnlockPassword: readEnv('MATRIX_LIVE_LOCAL_UNLOCK_PASSWORD')
  }
}
