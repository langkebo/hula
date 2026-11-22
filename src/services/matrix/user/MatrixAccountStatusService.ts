/**
 * MSC3720 账号状态服务。
 *
 * SDK 已提供 `client.getAccountStatusManager()`，本服务只做能力探测与响应收口：
 * - `isSupported()` 为 false 时不发请求，直接返回空结果（fail closed）；
 * - 批量查询的 `failures` 只记 warn，不影响其它用户的正常状态展示。
 */

import { createLogger } from '@/utils/Logger'
import { BaseMatrixService } from '../BaseMatrixService'
import type { AccountStatusEntry, AccountStatusManager } from '../sdk'

const logger = createLogger('MatrixAccountStatusService')

type MatrixAccountStatusMap = Record<string, AccountStatusEntry>

export class MatrixAccountStatusService extends BaseMatrixService {
  /**
   * 批量查询账号状态（MSC3720）。
   *
   * 返回 `userId -> AccountStatusEntry`；服务端未声明能力、探测失败或请求异常时
   * 一律返回空对象，调用方据此不渲染状态徽标。
   */
  async getAccountStatuses(userIds: string[]): Promise<MatrixAccountStatusMap> {
    if (!userIds.length) return {}

    let manager: AccountStatusManager
    try {
      manager = this.getClient().getAccountStatusManager()
    } catch (err) {
      logger.warn(`[AccountStatus] 获取 AccountStatusManager 失败，按不支持处理: ${err}`)
      return {}
    }

    try {
      if (!(await manager.isSupported())) {
        logger.info('[AccountStatus] 服务端未声明 MSC3720 账号状态能力，跳过查询')
        return {}
      }
    } catch (err) {
      // SDK 的 isSupported 本身是 fail closed，这里再兜一层防止实现变化。
      logger.warn(`[AccountStatus] 能力探测失败，按不支持处理: ${err}`)
      return {}
    }

    try {
      const response = await manager.getAccountStatuses(userIds)
      const failures = response.failures ?? {}
      const failedIds = Object.keys(failures)
      if (failedIds.length > 0) {
        logger.warn(`[AccountStatus] 部分用户状态获取失败: ${failedIds.join(', ')}; ${JSON.stringify(failures)}`)
      }
      return response.account_statuses ?? {}
    } catch (err) {
      logger.error(`[AccountStatus] 获取账号状态失败: ${err}`)
      return {}
    }
  }
}

export const matrixAccountStatusService = new MatrixAccountStatusService()
