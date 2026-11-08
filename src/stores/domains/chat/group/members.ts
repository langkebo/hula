import { computed, reactive, ref, shallowReactive, shallowRef, triggerRef } from 'vue'
import { OnlineEnum } from '@/enums'
import { matrixRoomQueryFacade } from '@/services/matrix/room/RoomFacade'
import type { RoomMember } from '@/services/matrix/sdk'
import { useGlobalStore } from '@/stores/domains/widget/global'
import { createLogger } from '@/utils/Logger'
import { toLocalpart } from '@/utils/userIdentity'
import type { MatrixGroupInfo, MatrixRoomMember } from './types'

const logger = createLogger('GroupStore.Members')

type GroupMembersContext = {
  /** 群信息 map（updateUserPresence 需要触碰以触发依赖方更新） */
  groupInfoMap: Record<string, MatrixGroupInfo>
}

/**
 * 群成员模块：成员列表加载/缓存/增删改、在线状态、分页选项。
 */
export function createGroupMembers(ctx: GroupMembersContext) {
  const { groupInfoMap } = ctx
  const globalStore = useGlobalStore()

  const membersMap = shallowReactive<Record<string, MatrixRoomMember[]>>({})
  const loadingRooms = shallowRef<Set<string>>(new Set())
  const userListOptions = reactive({ isLast: false, loading: false, cursor: '' })

  const currentRoomMembers = computed(() => {
    const roomId = globalStore.currentSessionRoomId
    return roomId ? membersMap[roomId] || [] : []
  })

  const userList = computed(() => currentRoomMembers.value)
  const memberList = computed(() => currentRoomMembers.value)

  const currentRoomOnlineCount = computed(
    () => currentRoomMembers.value.filter((m) => m.activeStatus === OnlineEnum.ONLINE).length
  )

  /**
   * 结构版本号：只由「成员集合 / 资料」变更推进（加载、增删、改名等）。
   * presence 更新（updateUserPresence / updateOnlineNum）刻意不推进，避免每次上下线事件
   * 都把 allUserInfo 的跨房间去重全量重算一遍（大账号下为 O(全部成员)）。
   */
  const memberStructureVersion = ref(0)
  const markStructureChanged = () => {
    memberStructureVersion.value += 1
  }

  let allUserInfoCache: MatrixRoomMember[] = []
  let allUserInfoVersion = -1

  /**
   * 跨房间成员去重快照（按 localpart 归一化）。
   * 命中缓存时不读取 membersMap，因此 presence 变化不会触发重建；
   * 需要实时在线状态请读 membersMap / currentRoomMembers。
   */
  const allUserInfo = computed(() => {
    const version = memberStructureVersion.value
    if (version === allUserInfoVersion) return allUserInfoCache

    const allUsers: MatrixRoomMember[] = []
    const seen = new Set<string>()
    Object.values(membersMap).forEach((members) => {
      members.forEach((m) => {
        const key = toLocalpart(m.userId || m.uid)
        if (key && !seen.has(key)) {
          seen.add(key)
          allUsers.push(m)
        }
      })
    })

    allUserInfoCache = allUsers
    allUserInfoVersion = version
    return allUserInfoCache
  })

  const getUserInfo = computed(() => (uid: string, roomId?: string) => {
    const targetRoomId = roomId || globalStore.currentSessionRoomId
    if (!targetRoomId) return null
    const members = membersMap[targetRoomId] || []
    return members.find((m) => m.userId === uid || m.uid === uid) || null
  })

  const getUserDisplayName = computed(() => (uid: string) => {
    const member = currentRoomMembers.value.find((m) => m.userId === uid || m.uid === uid)
    return member?.displayName || member?.name || ''
  })

  async function loadRoomMembers(roomId: string, forceRefresh = false): Promise<MatrixRoomMember[]> {
    if (!forceRefresh && membersMap[roomId]?.length) {
      return membersMap[roomId]
    }

    loadingRooms.value.add(roomId)
    triggerRef(loadingRooms)
    try {
      const members = await matrixRoomQueryFacade.getMembers(roomId)
      const matrixMembers: MatrixRoomMember[] = members.map((m: RoomMember) => ({
        userId: m.userId,
        uid: m.userId,
        displayName: m.name || toLocalpart(m.userId),
        name: m.name || toLocalpart(m.userId),
        avatarUrl: m.getMxcAvatarUrl?.() || null,
        avatar: m.getMxcAvatarUrl?.() || '',
        membership: (m.membership || 'leave') as MatrixRoomMember['membership'],
        powerLevel: m.powerLevel || 0,
        isModerator: m.powerLevel >= 50,
        isCreator: m.powerLevel >= 100,
        roleId: m.powerLevel >= 100 ? 0 : m.powerLevel >= 50 ? 1 : 2,
        // 默认 OFFLINE，让真实的 presence 同步流（applyPresenceToStores / User.presence 事件）来更新；
        // 之前硬编码 ONLINE 会让 UI 永远显示绿点，与服务端状态脱节。
        activeStatus: OnlineEnum.OFFLINE,
        lastOptTime: Date.now(),
        account: toLocalpart(m.userId)
      }))

      // 防御性去重：后端/SDK 偶发返回同一用户的重复成员记录时，
      // 在进入 membersMap 前按 localpart 归一化去重（join 状态优先保留），
      // 否则成员面板会出现同一用户的多条记录（如多个 test1）。
      const seen = new Map<string, MatrixRoomMember>()
      for (const member of matrixMembers) {
        const key = toLocalpart(member.userId || member.uid)
        if (!key) continue
        const existing = seen.get(key)
        if (!existing || (existing.membership !== 'join' && member.membership === 'join')) {
          seen.set(key, member)
        }
      }
      const dedupedMembers = Array.from(seen.values())
      if (dedupedMembers.length !== matrixMembers.length) {
        logger.warn(
          `[GroupStore] 房间成员存在重复记录，已去重: ${roomId}, ${matrixMembers.length} → ${dedupedMembers.length}`
        )
      }

      membersMap[roomId] = dedupedMembers
      markStructureChanged()
      logger.info(`[GroupStore] 加载房间成员成功: ${roomId}, ${dedupedMembers.length} 个成员`)
      return dedupedMembers
    } catch (err) {
      logger.error(`[GroupStore] 加载房间成员失败: ${err}`)
      return []
    } finally {
      loadingRooms.value.delete(roomId)
      triggerRef(loadingRooms)
    }
  }

  function getMembersByRoomId(roomId: string): MatrixRoomMember[] {
    return membersMap[roomId] || []
  }

  function getUserListByRoomId(roomId: string): MatrixRoomMember[] {
    return membersMap[roomId] || []
  }

  function getUser(roomId: string, uid: string): MatrixRoomMember | undefined {
    return membersMap[roomId]?.find((m) => m.userId === uid || m.uid === uid)
  }

  function updateUserItem(uid: string, updates: Partial<MatrixRoomMember>, roomId?: string): boolean {
    const targetRoomId = roomId || globalStore.currentSessionRoomId
    if (!targetRoomId || !membersMap[targetRoomId]) return false

    const memberIndex = membersMap[targetRoomId].findIndex((m) => m.userId === uid || m.uid === uid)
    if (memberIndex === -1) return false

    membersMap[targetRoomId] = membersMap[targetRoomId].map((m, i) => (i === memberIndex ? { ...m, ...updates } : m))
    markStructureChanged()
    return true
  }

  function updateUserPresence(uid: string, updates: Pick<MatrixRoomMember, 'activeStatus' | 'lastOptTime'>): boolean {
    let hasUpdated = false

    Object.keys(membersMap).forEach((roomId) => {
      const members = membersMap[roomId]
      if (!members?.length) {
        return
      }

      // 先定位命中下标，未命中则不复制数组。
      // 此前无条件 members.map 后回写，会让每次 presence 事件都替换所有房间的数组，
      // 连锁触发成员列表重渲染；allUserInfo 已按结构版本缓存，不再受影响。
      let nextMembers: MatrixRoomMember[] | null = null
      for (let i = 0; i < members.length; i += 1) {
        const member = members[i]
        if (member.userId !== uid && member.uid !== uid) {
          continue
        }

        nextMembers ??= members.slice()
        nextMembers[i] = {
          ...member,
          ...updates
        }
      }

      if (!nextMembers) {
        return
      }

      membersMap[roomId] = nextMembers
      hasUpdated = true
      if (groupInfoMap[roomId]) {
        groupInfoMap[roomId] = {
          ...groupInfoMap[roomId]
        }
      }
    })

    return hasUpdated
  }

  function updateMemberCache(roomId: string, members: MatrixRoomMember[]): void {
    membersMap[roomId] = members
    markStructureChanged()
  }

  function updateOnlineNum(options: { uid?: string; roomId?: string; isAdd?: boolean }): void {
    const { uid, roomId, isAdd } = options
    const targetRoomId = roomId || globalStore.currentSessionRoomId

    if (!targetRoomId || !membersMap[targetRoomId]) return

    if (uid) {
      membersMap[targetRoomId] = membersMap[targetRoomId].map((m) =>
        m.userId === uid || m.uid === uid ? { ...m, activeStatus: isAdd ? OnlineEnum.ONLINE : OnlineEnum.OFFLINE } : m
      )
    } else if (isAdd) {
      membersMap[targetRoomId] = membersMap[targetRoomId].map((m) => ({
        ...m,
        activeStatus: isAdd ? OnlineEnum.ONLINE : OnlineEnum.OFFLINE
      }))
    }
  }

  function cleanupSession(): void {
    userListOptions.cursor = ''
    userListOptions.isLast = false
    userListOptions.loading = false
  }

  async function getGroupUserList(roomId: string, forceRefresh = false): Promise<MatrixRoomMember[]> {
    return loadRoomMembers(roomId, forceRefresh)
  }

  async function loadMoreGroupMembers(): Promise<void> {
    if (userListOptions.isLast || userListOptions.loading) return
    userListOptions.loading = true
    await loadRoomMembers(globalStore.currentSessionRoomId, true)
    userListOptions.loading = false
  }

  function removeAllUsers(roomId: string): void {
    membersMap[roomId] = []
    markStructureChanged()
  }

  function removeUserItem(uid: string, roomId?: string): boolean {
    const targetRoomId = roomId || globalStore.currentSessionRoomId
    if (!targetRoomId) return false
    // 与 addUserItem 一致：按 localpart 归一化匹配，兼容 WS localpart 与 SDK 完整 MXID。
    const localpart = toLocalpart(uid)
    membersMap[targetRoomId] =
      membersMap[targetRoomId]?.filter((m) => {
        if (m.userId === uid || m.uid === uid) return false
        return localpart ? toLocalpart(m.userId || m.uid) !== localpart : true
      }) || []
    markStructureChanged()
    return true
  }

  function addUserItem(user: MatrixRoomMember, roomId?: string): boolean {
    const targetRoomId = roomId || globalStore.currentSessionRoomId
    if (!targetRoomId) return false
    if (!membersMap[targetRoomId]) {
      membersMap[targetRoomId] = []
    }

    // 去重：按 localpart 匹配（WS 推送可能是 localpart，SDK 是完整 MXID，
    // 直接比较会导致同一成员出现两条记录），已存在则合并资料。
    const localpart = toLocalpart(user.userId || user.uid)
    const existingIndex = localpart
      ? membersMap[targetRoomId].findIndex((m) => toLocalpart(m.userId || m.uid) === localpart)
      : -1
    if (existingIndex >= 0) {
      // membersMap 是 shallowReactive，原地改写数组不会触发依赖方，必须整体替换
      const nextMembers = membersMap[targetRoomId].slice()
      nextMembers[existingIndex] = {
        ...nextMembers[existingIndex],
        ...user
      }
      membersMap[targetRoomId] = nextMembers
    } else {
      // 同上：push 不触发响应式，整体替换后才能让成员面板即时出现新成员
      membersMap[targetRoomId] = [...membersMap[targetRoomId], user]
    }

    markStructureChanged()
    return true
  }

  return {
    membersMap,
    loadingRooms,
    userListOptions,
    currentRoomMembers,
    userList,
    memberList,
    currentRoomOnlineCount,
    allUserInfo,
    getUserInfo,
    getUserDisplayName,
    loadRoomMembers,
    getMembersByRoomId,
    getUserListByRoomId,
    getUser,
    updateUserItem,
    updateUserPresence,
    updateMemberCache,
    updateOnlineNum,
    cleanupSession,
    getGroupUserList,
    loadMoreGroupMembers,
    removeAllUsers,
    removeUserItem,
    addUserItem
  }
}
