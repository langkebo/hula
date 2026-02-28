import { defineStore } from 'pinia'
import { StoresEnum } from '@/enums'

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
    // TODO: 从 Matrix 账户数据加载徽章
    // 暂时返回空数组，徽章功能待实现
  }

  return {
    badges,
    badgeById,
    setBadges,
    addBadge,
    loadBadges
  }
})
