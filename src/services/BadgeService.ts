import { IsYesEnum } from '@/enums'
import { matrixClientService } from '@/services/matrix'
import { useUserStore } from '@/stores/domains/user/user'
import { buildBadgeCatalog } from '@/stores/domains/chat/badge'
import { info, error } from '@tauri-apps/plugin-log'

export interface Badge {
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

  private getCurrentUserBadgeState() {
    const userStore = useUserStore()
    const ownedIds = [...(userStore.userInfo?.itemIds ?? [])]
    const defaultWearingId = userStore.userInfo?.wearingItemId
    const client = matrixClientService.getClient()
    const accountData = client?.getAccountData(this.accountDataType as never)
    const persistedWearingId = accountData?.getContent?.().wearingItemId as string | undefined
    const wearingItemId = persistedWearingId || defaultWearingId

    if (wearingItemId && !ownedIds.includes(wearingItemId)) {
      ownedIds.push(wearingItemId)
    }

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
      const client = matrixClientService.getClient()
      if (!client) {
        throw new Error('Matrix 客户端未初始化')
      }

      await client.setAccountData(this.accountDataType as never, { wearingItemId: badgeId } as never)
      info(`[Badge] 设置徽章成功: ${badgeId}`)
    } catch (err) {
      error(`[Badge] 设置徽章失败: ${err}`)
      throw err
    }
  }

  /**
   * 获取徽章列表
   * @returns 徽章列表
   */
  async getBadgeList(): Promise<Badge[]> {
    try {
      const { ownedIds, wearingItemId } = this.getCurrentUserBadgeState()
      const badges = buildBadgeCatalog(ownedIds)
      info('[Badge] 获取徽章列表成功')
      return badges.map((badge) => ({
        ...badge,
        obtain: IsYesEnum.YES,
        wearing: badge.id === wearingItemId ? IsYesEnum.YES : IsYesEnum.NO
      }))
    } catch (err) {
      error(`[Badge] 获取徽章列表失败: ${err}`)
      return []
    }
  }

  /**
   * 批量获取徽章
   * @param badgeIds 徽章 ID 列表
   * @returns 徽章列表
   */
  async getBadgesBatch(badgeIds: string[]): Promise<Badge[]> {
    try {
      const { wearingItemId } = this.getCurrentUserBadgeState()
      const badges = buildBadgeCatalog(badgeIds)
      info('[Badge] 批量获取徽章成功')
      return badges.map((badge) => ({
        ...badge,
        obtain: IsYesEnum.YES,
        wearing: badge.id === wearingItemId ? IsYesEnum.YES : IsYesEnum.NO
      }))
    } catch (err) {
      error(`[Badge] 批量获取徽章失败: ${err}`)
      return []
    }
  }
}

export const badgeService = new BadgeService()
export default badgeService
