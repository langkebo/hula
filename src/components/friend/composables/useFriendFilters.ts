import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { OnlineEnum } from '@/enums'
import { type MatrixContact, useContactStore } from '@/stores/domains/chat/contacts'
import type { FriendStatus } from '@/types/matrix-services'

/**
 * 好友列表筛选 Composable
 *
 * 负责：
 * - 当前筛选状态（all / favorite / normal / blocked / hidden）
 * - 筛选选项与 i18n 标签
 * - 应用筛选 + 当前应用搜索关键词后的好友列表（favorite 优先、在线优先排序）
 * - 各筛选分组的数量统计
 */
export function useFriendFilters() {
  const { t } = useI18n()
  const contactStore = useContactStore()

  const currentFilter = ref<FriendStatus | 'all'>('all')

  const filterOptions = computed(() => [
    { value: 'all' as const, label: t('friend.filter.all') },
    { value: 'favorite' as FriendStatus, label: t('friend.filter.favorite') },
    { value: 'normal' as FriendStatus, label: t('friend.filter.normal') },
    { value: 'blocked' as FriendStatus, label: t('friend.filter.blocked') },
    { value: 'hidden' as FriendStatus, label: t('friend.filter.hidden') }
  ])

  const normalizeFriendStatus = (status?: FriendStatus) => {
    if (status === 'accepted') {
      return 'normal'
    }

    return status
  }

  const filteredFriends = computed<MatrixContact[]>(() => {
    const friends =
      currentFilter.value === 'all'
        ? [...contactStore.contactsList]
        : contactStore.contactsList.filter((f) => normalizeFriendStatus(f.friendStatus) === currentFilter.value)

    return friends.sort((a, b) => {
      if (a.friendStatus === 'favorite' && b.friendStatus !== 'favorite') return -1
      if (a.friendStatus !== 'favorite' && b.friendStatus === 'favorite') return 1
      if (a.activeStatus === OnlineEnum.ONLINE && b.activeStatus !== OnlineEnum.ONLINE) return -1
      if (a.activeStatus !== OnlineEnum.ONLINE && b.activeStatus === OnlineEnum.ONLINE) return 1
      return 0
    })
  })

  // 单次遍历产出各筛选项计数：模板里每个按钮会读 2 次计数，
  // 原先每次都全表 filter，5 个筛选项即 10 次全量扫描。
  const filterCounts = computed<Partial<Record<FriendStatus | 'all', number>>>(() => {
    const counts: Partial<Record<FriendStatus | 'all', number>> = {
      all: contactStore.contactsList.length,
      favorite: 0,
      normal: 0,
      blocked: 0,
      hidden: 0
    }
    for (const friend of contactStore.contactsList) {
      const status = normalizeFriendStatus(friend.friendStatus)
      if (status === 'favorite' || status === 'normal' || status === 'blocked' || status === 'hidden') {
        counts[status] = (counts[status] ?? 0) + 1
      }
    }
    return counts
  })

  const getFilterCount = (status: FriendStatus | 'all') => filterCounts.value[status] ?? 0

  const handleFilterChange = (filter: FriendStatus | 'all') => {
    currentFilter.value = filter
  }

  return {
    currentFilter,
    filterOptions,
    filteredFriends,
    normalizeFriendStatus,
    getFilterCount,
    handleFilterChange
  }
}
