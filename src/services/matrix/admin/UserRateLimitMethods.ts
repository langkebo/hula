import type { AdminManager } from '@/services/matrix/sdk'
import { isValidMatrixUserId } from '@/utils/inputValidation'
import { createLogger } from '@/utils/Logger'
import type { RateLimit } from './AdminTypes'
import { isAdminPermissionDenied } from './adminPermissionGuard'

const logger = createLogger('UserRateLimit')

type UserRateLimitSdkGetter = () => Promise<AdminManager>

/**
 * `AdminUserService` 的速率限制方法片段。
 *
 * 从 `UserService.ts` 抽离：用户级速率限制读写独立成域，
 * 避免用户服务文件随端点增加持续膨胀。子类提供 SDK 管理器 getter。
 */
export abstract class UserRateLimitMethods {
  protected abstract readonly sdkAdmin: UserRateLimitSdkGetter

  /** 读取用户级速率限制覆盖；无覆盖、无权限或失败时返回 null。 */
  async getRateLimit(userId: string): Promise<RateLimit | null> {
    try {
      const admin = await this.sdkAdmin()
      const result = await admin.getRateLimitOverride(userId, false)
      if (!result) return null
      return {
        messagesPerSecond: result.messages_per_second,
        burstCount: result.burst_count
      }
    } catch (err) {
      if (isAdminPermissionDenied(err)) return null
      logger.error(`[Admin] 获取速率限制失败: ${err}`)
      return null
    }
  }

  /** 覆盖指定用户的速率限制
   */
  async overrideUserRateLimit(userId: string): Promise<void> {
    if (!isValidMatrixUserId(userId)) throw new Error(`Invalid user ID: ${userId}`)
    try {
      const admin = await this.sdkAdmin()
      await admin.overrideRateLimit(userId)
      logger.info(`[Admin] 用户速率限制已覆盖（禁用）: ${userId}`)
    } catch (err) {
      if (isAdminPermissionDenied(err)) return
      logger.error(`[Admin] 覆盖速率限制失败: ${err}`)
      throw err
    }
  }

  /** 删除用户级速率限制覆盖；无权限时静默返回。 */
  async deleteRateLimit(userId: string): Promise<void> {
    if (!isValidMatrixUserId(userId)) throw new Error(`Invalid user ID: ${userId}`)
    try {
      const admin = await this.sdkAdmin()
      await admin.deleteRateLimitOverride(userId)
      logger.info(`[Admin] 速率限制已删除: ${userId}`)
    } catch (err) {
      if (isAdminPermissionDenied(err)) return
      logger.error(`[Admin] 删除速率限制失败: ${err}`)
      throw err
    }
  }
}
