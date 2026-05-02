import { defineStore } from 'pinia'
import { StoresEnum } from '@/enums'
import { matrixClientService } from '@/services/matrix/MatrixClientService'
import { createLogger } from '@/utils/Logger'

const logger = createLogger('BadgeStore')

export interface Badge {
  id: string
  img: string
  describe: string
}

const KNOWN_BADGES: Record<string, Badge> = {
  '6': {
    id: '6',
    img: '/hula.png',
    describe: '频道徽章'
  }
}

export function buildBadgeCatalog(ids: string[]): Badge[] {
  return [...new Set(ids)]
    .filter((id): id is string => Boolean(id))
    .map((id) => {
      const knownBadge = KNOWN_BADGES[id]
      if (knownBadge) return knownBadge
      return {
        id,
        img: '/img/dispersion-bg.png',
        describe: `徽章 ${id}`
      }
    })
}

export const useBadgeStore = defineStore(StoresEnum.BADGE, () => {
  const badges = ref<Badge[]>(buildBadgeCatalog(Object.keys(KNOWN_BADGES)))

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
      const client = matrixClientService.getClient()
      if (!client) {
        logger.warn('Matrix client not initialized')
        return
      }

      // 从账户数据加载徽章
      const accountData = client.getAccountData('m.badges' as never)
      if (accountData) {
        const content = accountData.getContent()
        if (content?.badges && Array.isArray(content.badges)) {
          badges.value = buildBadgeCatalog((content.badges as Badge[]).map((badge) => badge.id))
        }
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
