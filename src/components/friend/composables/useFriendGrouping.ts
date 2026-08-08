import { type ComputedRef, computed, type MaybeRefOrGetter, ref, toValue } from 'vue'
import { useI18n } from 'vue-i18n'
import { type FriendGroup, useFriends } from '@/composables/useFriends'
import type { MatrixContact } from '@/stores/domains/chat/contacts'

/** Virtual group IDs for the favorite and ungrouped sections. */
export const FAVORITE_GROUP_ID = '__favorite__'
export const UNGROUPED_GROUP_ID = '__ungrouped__'

export interface FriendGroupSection {
  groupId: string
  groupName: string
  friends: MatrixContact[]
  isFavorite: boolean
  isUngrouped: boolean
}

interface UseFriendGroupingOptions {
  /** Reactive friend list (already filtered + searched) to split into sections. */
  friends?: MaybeRefOrGetter<MatrixContact[]>
}

/**
 * 好友分组 Composable
 *
 * 负责：
 * - 从 useFriends 获取好友分组数据及各分组成员
 * - 构建 userId → Set<groupId> 映射
 * - 将扁平好友列表按分组拆分为可折叠区段（星标组置顶 → 自定义分组 → 未分组）
 * - 管理各分组的折叠状态
 */
export function useFriendGrouping(options?: UseFriendGroupingOptions) {
  const { t } = useI18n()
  const { getFriendGroups, getFriendsInGroup } = useFriends()

  const groups = ref<FriendGroup[]>([])
  const isLoadingGroups = ref(false)
  const groupsLoaded = ref(false)
  /** userId → Set<groupId> 映射，记录每个用户所属的自定义分组 */
  const userGroupMap = ref<Map<string, Set<string>>>(new Map())
  /** 已折叠的分组 ID 集合 */
  const collapsedGroups = ref<Set<string>>(new Set())

  /**
   * 加载好友分组数据，并构建 userId → groupId 映射。
   * 失败时优雅降级到空分组列表。
   */
  async function loadGroups(): Promise<void> {
    isLoadingGroups.value = true
    try {
      const fetchedGroups = await getFriendGroups()
      groups.value = fetchedGroups ?? []

      // 并发拉取各分组成员，逐组容错
      const memberResults = await Promise.allSettled(groups.value.map((group) => getFriendsInGroup(group.group_id)))

      // 构建映射：遍历每个分组的结果，按 index 对应
      const mapping = new Map<string, Set<string>>()
      groups.value.forEach((group, index) => {
        const result = memberResults[index]
        if (result?.status !== 'fulfilled') return
        for (const friend of result.value) {
          const userId = friend.user_id ?? ''
          if (!userId) continue
          if (!mapping.has(userId)) {
            mapping.set(userId, new Set())
          }
          mapping.get(userId)!.add(group.group_id)
        }
      })

      userGroupMap.value = mapping
      groupsLoaded.value = true
    } catch {
      groups.value = []
      userGroupMap.value = new Map()
      groupsLoaded.value = true
    } finally {
      isLoadingGroups.value = false
    }
  }

  /**
   * 将扁平好友列表按分组拆分为区段。
   *
   * 排序规则：
   * 1. 星标好友组（friendStatus === 'favorite'）— 置顶
   * 2. 自定义分组（按 groups 顺序）— 非星标成员
   * 3. 未分组 — 非星标且不属于任何自定义分组
   *
   * 空区段（无好友）不会出现在结果中。
   */
  function groupFriends(friends: MatrixContact[]): FriendGroupSection[] {
    const sections: FriendGroupSection[] = []

    // 1. 星标好友组
    const favoriteFriends = friends.filter((f) => f.friendStatus === 'favorite')
    if (favoriteFriends.length > 0) {
      sections.push({
        groupId: FAVORITE_GROUP_ID,
        groupName: t('friend.group.section.favorite'),
        friends: favoriteFriends,
        isFavorite: true,
        isUngrouped: false
      })
    }

    // 2. 自定义分组（排除星标好友以避免重复）
    const nonFavoriteFriends = friends.filter((f) => f.friendStatus !== 'favorite')
    for (const group of groups.value) {
      const groupFriendsList = nonFavoriteFriends.filter((f) => {
        const groupIds = userGroupMap.value.get(f.userId)
        return groupIds?.has(group.group_id) ?? false
      })
      if (groupFriendsList.length > 0) {
        sections.push({
          groupId: group.group_id,
          groupName: group.name,
          friends: groupFriendsList,
          isFavorite: false,
          isUngrouped: false
        })
      }
    }

    // 3. 未分组（非星标且不属于任何自定义分组）
    const ungroupedFriends = nonFavoriteFriends.filter((f) => {
      const groupIds = userGroupMap.value.get(f.userId)
      return !groupIds || groupIds.size === 0
    })
    if (ungroupedFriends.length > 0) {
      sections.push({
        groupId: UNGROUPED_GROUP_ID,
        groupName: t('friend.group.section.ungrouped'),
        friends: ungroupedFriends,
        isFavorite: false,
        isUngrouped: true
      })
    }

    return sections
  }

  /** 是否应启用分组视图（分组已加载且存在自定义分组或星标好友） */
  const shouldGroup: ComputedRef<boolean> = computed(() => {
    if (!groupsLoaded.value) return false
    const friendList = options?.friends ? toValue(options.friends) : []
    const hasFavorites = friendList.some((f) => f.friendStatus === 'favorite')
    return groups.value.length > 0 || hasFavorites
  })

  /** 响应式分组区段列表 */
  const groupedSections: ComputedRef<FriendGroupSection[]> = computed(() => {
    if (!shouldGroup.value) return []
    const friendList = options?.friends ? toValue(options.friends) : []
    return groupFriends(friendList)
  })

  /** 切换指定分组的折叠状态 */
  function toggleCollapse(groupId: string): void {
    const next = new Set(collapsedGroups.value)
    if (next.has(groupId)) {
      next.delete(groupId)
    } else {
      next.add(groupId)
    }
    collapsedGroups.value = next
  }

  /** 查询指定分组是否已折叠 */
  function isCollapsed(groupId: string): boolean {
    return collapsedGroups.value.has(groupId)
  }

  return {
    groups,
    isLoadingGroups,
    groupsLoaded,
    collapsedGroups,
    groupedSections,
    shouldGroup,
    loadGroups,
    groupFriends,
    toggleCollapse,
    isCollapsed
  }
}
