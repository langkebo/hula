import { defineStore } from 'pinia'
import { StoresEnum } from '@/enums'
import { matrixClientService } from '@/services/matrix'

export interface Badge {
  id: string
  img: string
  describe: string
}

export const useBadgeStore = defineStore(StoresEnum.BADGE, () => {
  const badges = ref<Badge[]>([])

  const badgeById = computed(() => (id?: string) => {
    if (!id) return undefined
    return badges.value.find((badge) => badge.id === id)
  })

  const setBadges = (list: Badge[]) => {
    badges.value = list
  }

  const addBadge = (badge: Badge) => {
    const exists = badges.value.some((b) => b.id === badge.id)
    if (!exists) {
      badges.value.push(badge)
    }
  }

  const loadBadges = async () => {
    try {
      const client = matrixClientService.getClient()
      if (!client) {
        console.warn('[BadgeStore] Matrix client not initialized')
        return
      }

      // 从账户数据加载徽章
      const accountData = client.getAccountData('m.badges' as any)
      if (accountData) {
        const content = accountData.getContent()
        if (content?.badges && Array.isArray(content.badges)) {
          badges.value = content.badges as Badge[]
        }
      }
    } catch (error) {
      console.error('[BadgeStore] Failed to load badges:', error)
    }
  }

  return {
    badges,
    badgeById,
    setBadges,
    addBadge,
    loadBadges
  }
})
