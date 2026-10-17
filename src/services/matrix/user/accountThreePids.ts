import type { MatrixClient } from '@/services/matrix/sdk'

import { createLogger } from '@/utils/Logger'

const logger = createLogger('MatrixAccountService')

/**
 * 第三方标识（3PID）管理。
 *
 * 从 `MatrixAccountService` 抽出：3PID 是账号绑定关系里独立的一块，
 * 与设备管理、邀请策略、capabilities 无共享状态。
 * 通过 `getClient` 访问器取已就绪的客户端（调用方保证此时客户端可用）。
 */

export interface ThreePidEntry {
  medium: string
  address: string
  validated_at: number
  added_at: number
}

export interface ThreePidsResponse {
  threepids: ThreePidEntry[]
  pending3pids: ThreePidEntry[]
}

/** 获取已绑定的 3PID 列表；`pending3pids` 当前恒为空。 */
export async function fetchThreePids(getClient: () => MatrixClient): Promise<ThreePidsResponse> {
  const client = getClient()

  try {
    const accountData = await client.getThreePidsManager().getThreePids()
    logger.info('[MatrixAccount] 获取 3PID 列表成功')
    return {
      threepids: accountData.threepids || [],
      pending3pids: []
    }
  } catch (err) {
    logger.error(`[MatrixAccount] 获取 3PID 列表失败: ${err}`)
    throw err
  }
}

/** 添加 3PID。`bind` 为历史遗留参数：后端 add/bind 同 handler，仅消费 sid + clientSecret。 */
export async function addThreePid(getClient: () => MatrixClient, sid: string, clientSecret: string): Promise<void> {
  const client = getClient()

  try {
    // 后端 /account/3pid/add 只读 sid+client_secret；bind 参数历史遗留（add/bind 同 handler），已忽略
    await client.getThreePidsManager().addThreePidOnly(clientSecret, sid)
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
