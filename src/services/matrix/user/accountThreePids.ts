import { authedRequestWithPath } from '@/services/matrix/MatrixHttpClient'
import type { MatrixClient } from '@/services/matrix/sdk'

import { createLogger } from '@/utils/Logger'
import { PREFIX_V3 } from '../paths/prefixes'

const logger = createLogger('MatrixAccountService')

/**
 * 第三方标识（3PID）管理。
 *
 * 从 `MatrixAccountService` 抽出：3PID 是账号绑定关系里独立的一块，
 * 与设备管理、邀请策略、capabilities 无共享状态。
 * 通过 `getClient` 访问器取已就绪的客户端（调用方保证此时客户端可用）。
 */

/** 归一化后的 3PID 记录（抹平 SDK 的 `validated_at` 与后端 `validated_ts` 字段差异）。 */
export interface ThreePidEntry {
  medium: string
  address: string
  validated: boolean
  addedAt: number | null
  validatedAt: number | null
}

export interface ThreePidsResponse {
  threepids: ThreePidEntry[]
  pending3pids: ThreePidEntry[]
}

/** 邮箱验证会话：`sid` 用于 submitToken 与 add，`clientSecret` 由调用方保管并回传。 */
export interface ThreePidEmailChallenge {
  sid: string
  submitUrl: string | null
}

/** 后端 `GET /account/3pid` 的原始字段（validated_ts 为 synapse-rust 实现）。 */
interface RawThreePid {
  medium?: string
  address?: string
  validated_at?: number | null
  validated_ts?: number | null
  added_at?: number | null
}

function normalizeThreePid(raw: RawThreePid): ThreePidEntry | null {
  const address = typeof raw.address === 'string' ? raw.address.trim() : ''
  if (!address) {
    return null
  }

  const validatedAt = typeof raw.validated_ts === 'number' ? raw.validated_ts : raw.validated_at
  const addedAt = raw.added_at

  return {
    medium: typeof raw.medium === 'string' && raw.medium ? raw.medium : 'email',
    address,
    validated: typeof validatedAt === 'number' && validatedAt > 0,
    addedAt: typeof addedAt === 'number' && addedAt > 0 ? addedAt : null,
    validatedAt: typeof validatedAt === 'number' && validatedAt > 0 ? validatedAt : null
  }
}

/** 获取已绑定的 3PID 列表；`pending3pids` 当前恒为空。 */
export async function fetchThreePids(getClient: () => MatrixClient): Promise<ThreePidsResponse> {
  const client = getClient()

  try {
    const accountData = await client.getThreePidsManager().getThreePids()
    const threepids = (accountData.threepids || [])
      .map((entry) => normalizeThreePid(entry as RawThreePid))
      .filter((entry): entry is ThreePidEntry => entry !== null)
    logger.info(`[MatrixAccount] 获取 3PID 列表成功: ${threepids.length} 条`)
    return {
      threepids,
      pending3pids: []
    }
  } catch (err) {
    logger.error(`[MatrixAccount] 获取 3PID 列表失败: ${err}`)
    throw err
  }
}

/**
 * 请求向邮箱发送「添加 3PID」验证码（`POST /account/3pid/email/requestToken`）。
 *
 * SDK 的 `requestAdd3pidEmailToken` 只负责发码，验证码仍需 submitToken 提交。
 */
export async function requestAddEmailToken(
  getClient: () => MatrixClient,
  email: string,
  clientSecret: string,
  sendAttempt = 1
): Promise<ThreePidEmailChallenge> {
  const client = getClient()

  try {
    const response = await client.requestAdd3pidEmailToken(email.trim(), clientSecret, sendAttempt)
    if (!response?.sid) {
      throw new Error('服务端未返回 3PID 验证会话 ID (sid)')
    }
    logger.info(`[MatrixAccount] 请求 3PID 邮箱验证码成功: ${response.sid}`)
    return { sid: response.sid, submitUrl: response.submit_url ?? null }
  } catch (err) {
    logger.error(`[MatrixAccount] 请求 3PID 邮箱验证码失败: ${err}`)
    throw err
  }
}

/**
 * 提交邮箱验证码（`POST /account/3pid/email/submitToken`）。
 *
 * SDK 的 `ThreePidsManager` 未封装该端点，这里复用 SDK 的鉴权请求通道
 * （与 `MatrixHttpClient` 一致），不绕过服务层另建 HTTP 客户端。
 */
export async function submitEmailToken(
  getClient: () => MatrixClient,
  sid: string,
  clientSecret: string,
  token: string
): Promise<void> {
  const client = getClient()

  try {
    await authedRequestWithPath<Record<string, never>>(
      client,
      'POST',
      `${PREFIX_V3}/account/3pid/email/submitToken`,
      undefined,
      { sid, client_secret: clientSecret, token: token.trim() }
    )
    logger.info(`[MatrixAccount] 提交 3PID 邮箱验证码成功: ${sid}`)
  } catch (err) {
    logger.error(`[MatrixAccount] 提交 3PID 邮箱验证码失败: ${err}`)
    throw err
  }
}

/**
 * 添加 3PID（`POST /account/3pid/add`）。
 *
 * 后端该端点强制 UIA：`sid` 只证明地址所有权，账户所有权必须由 `auth`
 * （`m.login.password`）证明，否则返回 401 + `flows` 挑战。
 */
export async function addThreePid(
  getClient: () => MatrixClient,
  sid: string,
  clientSecret: string,
  auth?: Record<string, unknown>
): Promise<void> {
  const client = getClient()

  try {
    await client.getThreePidsManager().addThreePidOnly(clientSecret, sid, auth)
    logger.info(`[MatrixAccount] 添加 3PID 成功: ${sid}`)
  } catch (err) {
    logger.error(`[MatrixAccount] 添加 3PID 失败: ${err}`)
    throw err
  }
}

/** 绑定 3PID。后端 add/bind 同 handler，仅消费 sid + clientSecret；medium/address 仅用于日志。 */
export async function bindThreePid(
  getClient: () => MatrixClient,
  sid: string,
  clientSecret: string,
  medium: string,
  address: string
): Promise<void> {
  const client = getClient()

  try {
    // 后端 /account/3pid/bind 与 /add 同一 handler，只读 sid+client_secret；medium/address 仅用于日志
    await client.getThreePidsManager().addThreePidOnly(clientSecret, sid)
    logger.info(`[MatrixAccount] 绑定 3PID 成功: ${medium}:${address}`)
  } catch (err) {
    logger.error(`[MatrixAccount] 绑定 3PID 失败: ${err}`)
    throw err
  }
}

/** 删除已绑定的 3PID。 */
export async function deleteThreePid(getClient: () => MatrixClient, medium: string, address: string): Promise<void> {
  const client = getClient()

  try {
    await client.getThreePidsManager().deleteThreePid(medium, address)
    logger.info(`[MatrixAccount] 删除 3PID 成功: ${medium}:${address}`)
  } catch (err) {
    logger.error(`[MatrixAccount] 删除 3PID 失败: ${err}`)
    throw err
  }
}

/** 解绑已绑定的 3PID。 */
export async function unbindThreePid(getClient: () => MatrixClient, medium: string, address: string): Promise<void> {
  const client = getClient()

  try {
    await client.getThreePidsManager().unbindThreePid(medium, address)
    logger.info(`[MatrixAccount] 解绑 3PID 成功: ${medium}:${address}`)
  } catch (err) {
    logger.error(`[MatrixAccount] 解绑 3PID 失败: ${err}`)
    throw err
  }
}
