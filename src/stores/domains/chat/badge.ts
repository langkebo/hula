import { defineStore } from 'pinia'
import { StoresEnum } from '@/enums'
import { matrixAccountService } from '@/services/matrix/user/MatrixAccountService'
import { type BadgeCatalogItem, buildBadgeCatalog, KNOWN_BADGE_IDS } from '@/services/notification/badgeCatalog'
import { createLogger } from '@/utils/Logger'

const logger = createLogger('BadgeStore')

type Badge = BadgeCatalogItem

export const useBadgeStore = defineStore(StoresEnum.BADGE, () => {
  const badges = ref<Badge[]>(buildBadgeCatalog(KNOWN_BADGE_IDS))

  const badgeById = computed(() => (id?: string) => {
    if (!id) return undefined
    return badges.value.find((badge) => badge.id === id) ?? buildBadgeCatalog([id])[0]
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
      const content = await matrixAccountService.getAccountData<{ badges?: { id: string }[] }>('m.badges')
      if (content?.badges && Array.isArray(content.badges)) {
        badges.value = buildBadgeCatalog(content.badges.map((badge) => badge.id))
      }
    } catch (error) {
      logger.error('Failed to load badges:', error)
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
