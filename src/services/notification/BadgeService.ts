import { IsYesEnum } from '@/enums'
import { matrixAccountService } from '@/services/matrix/user/MatrixAccountService'
import { buildBadgeCatalog } from '@/stores/domains/chat/badge'
import { createLogger } from '@/utils/Logger'

const logger = createLogger('BadgeService')

interface Badge {
  id: string
  img: string
  describe: string
  obtain: number
  wearing: number
}

/**
 * 徽章服务
 * 处理用户徽章的获取和佩戴
 */
class BadgeService {
  private readonly accountDataType = 'io.hula.badge.preference'

  private async getCurrentUserBadgeState() {
    const content = await matrixAccountService.getAccountData<{ wearingItemId?: string; ownedIds?: string[] }>(
      this.accountDataType
    )

    const wearingItemId = content?.wearingItemId
    const ownedIds = content?.ownedIds || []

    return {
      ownedIds,
      wearingItemId
    }
  }

  /**
   * 设置用户徽章（佩戴徽章）
   * @param badgeId 徽章 ID
   */
  async setUserBadge(badgeId: string): Promise<void> {
    try {
      const { ownedIds } = await this.getCurrentUserBadgeState()
      await matrixAccountService.setAccountData(this.accountDataType, {
        wearingItemId: badgeId,
        ownedIds
      })
      logger.info(`[Badge] 设置徽章成功: ${badgeId}`)
    } catch (err) {
      logger.error(`[Badge] 设置徽章失败: ${err}`)
      throw err
    }
  }

  /**
   * 获取徽章列表
   * @returns 徽章列表
   */
  async getBadgeList(): Promise<Badge[]> {
    try {
      const { ownedIds, wearingItemId } = await this.getCurrentUserBadgeState()
      const badges = buildBadgeCatalog(ownedIds)
      logger.info('[Badge] 获取徽章列表成功')
      return badges.map((badge) => ({
        ...badge,
        obtain: IsYesEnum.YES,
        wearing: badge.id === wearingItemId ? IsYesEnum.YES : IsYesEnum.NO
      }))
    } catch (err) {
      logger.error(`[Badge] 获取徽章列表失败: ${err}`)
      return []
    }
  }
}

export const badgeService = new BadgeService()
