import { defineStore } from 'pinia'
import { computed, reactive, shallowReactive, shallowRef, triggerRef } from 'vue'
import { OnlineEnum, StoresEnum } from '@/enums'
import { matrixCryptoService } from '@/services/matrix/crypto/MatrixCryptoService'
import { matrixRoomActionFacade } from '@/services/matrix/room/ActionFacade'
import { matrixRoomMemberFacade } from '@/services/matrix/room/MemberFacade'
import { matrixRoomQueryFacade } from '@/services/matrix/room/QueryFacade'
import { Direction, EventType, type RoomMember } from '@/services/matrix/sdk'
import { useMatrixStore } from '@/stores/domains/chat/matrix'
import { useGlobalStore } from '@/stores/domains/widget/global'
import { createLogger } from '@/utils/Logger'
import { toLocalpart } from '@/utils/userIdentity'

const logger = createLogger('GroupStore')

export interface MatrixRoomMember {
  userId: string
  displayName: string | null
  avatarUrl: string | null
  membership: 'join' | 'leave' | 'invite' | 'ban'
  powerLevel: number
  isModerator: boolean
  isCreator: boolean
  name: string
  uid: string
  account: string
  avatar: string
  activeStatus: OnlineEnum
  roleId: number
  lastOptTime: number
  myName?: string
  userStateId?: string
  linkedGitee?: boolean
  linkedGithub?: boolean
  oauthProviders?: ('gitee' | 'github')[]
  hideMyPosts?: boolean
  hideTheirPosts?: boolean
}

export interface MatrixGroupInfo {
  roomId: string
  name: string
  avatarUrl: string | null
  topic: string | null
  memberCount: number
  memberNum?: number
  isEncrypted: boolean
  isPublic: boolean
  creator: string | null
  remark?: string
  allowScanEnter?: boolean
  avatar: string
  groupName: string
  roleId: number
  account: string
  myName: string
  joinRule?: string
  onlineCount?: number
}

export const useGroupStore = defineStore(StoresEnum.GROUP, () => {
  const globalStore = useGlobalStore()
  const matrixStore = useMatrixStore()

  const membersMap = shallowReactive<Record<string, MatrixRoomMember[]>>({})
  const groupInfoMap = shallowReactive<Record<string, MatrixGroupInfo>>({})
  const loadingRooms = shallowRef<Set<string>>(new Set())
  const userListOptions = reactive({ isLast: false, loading: false, cursor: '' })

  const currentRoomMembers = computed(() => {
    const roomId = globalStore.currentSessionRoomId
    return roomId ? membersMap[roomId] || [] : []
  })

  const currentGroupInfo = computed(() => {
    const roomId = globalStore.currentSessionRoomId
    return roomId ? groupInfoMap[roomId] : null
  })

  const currentRoomCreator = computed(() => {
    return currentGroupInfo.value?.creator || null
  })

  const currentRoomModerators = computed(() => {
    return currentRoomMembers.value.filter((m) => m.isModerator || m.isCreator)
  })

  const isCurrentUserCreator = computed(() => {
    const creator = currentRoomCreator.value
    return creator === matrixStore.userId
  })

  const isCurrentUserModerator = computed(() => {
    const myUserId = matrixStore.userId
    if (!myUserId) return false
    return currentRoomMembers.value.some((m) => m.userId === myUserId && (m.isModerator || m.isCreator))
  })

  const userList = computed(() => currentRoomMembers.value)
  const countInfo = computed(() => currentGroupInfo.value)

  const currentLordId = computed(() => {
    const creator = currentRoomCreator.value
    return creator || null
  })

  const adminUidList = computed(() => {
    return currentRoomModerators.value.map((m) => m.userId)
  })

  const myNameInCurrentGroup = computed({
    get() {
      const myUserId = matrixStore.userId
      if (!myUserId) return ''
      const member = currentRoomMembers.value.find((m) => m.userId === myUserId)
      return member?.displayName || member?.name || ''
    },
    async set(value: string) {
      const roomId = globalStore.currentSessionRoomId
      if (!roomId) return
      try {
        await matrixRoomMemberFacade.setMemberDisplayName(roomId, value)
        logger.info(`[GroupStore] Successfully set display name to: ${value}`)
      } catch (e) {
        logger.error(`[GroupStore] Failed to set display name: ${e}`)
      }
    }
  })

  const myRoleIdInCurrentGroup = computed({
    get() {
      const myUserId = matrixStore.userId
      if (!myUserId) return 0
      const member = currentRoomMembers.value.find((m) => m.userId === myUserId)
      if (!member) return 0
      if (member.isCreator) return 0
      if (member.isModerator) return 1
      return 2
    },
    async set(value: number) {
      const myUserId = matrixStore.userId
      const roomId = globalStore.currentSessionRoomId
      if (!myUserId || !roomId) return
      try {
        // 0=创建者, 1=管理员, 2=普通成员
        // Matrix power level: 100=创建者/管理员, 0=普通成员
        const powerLevel = value <= 1 ? 100 : 0
        await matrixRoomMemberFacade.setMemberPowerLevel(roomId, myUserId, powerLevel)
        logger.info(`[GroupStore] 成功设置角色: ${value}`)
      } catch (e) {
        logger.error(`[GroupStore] 设置角色失败: ${e}`)
      }
    }
  })

  const isCurrentLord = computed(() => (uid: string) => {
    return currentLordId.value === uid
  })

  const isAdmin = computed(() => (uid: string) => {
    return adminUidList.value.includes(uid)
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

  const getGroupDetailByRoomId = computed(() => (roomId: string) => {
    return groupInfoMap[roomId] || null
  })

  const onlineCountMap = computed(() => {
    const map: Record<string, number> = {}
    Object.keys(membersMap).forEach((roomId) => {
      map[roomId] = membersMap[roomId].filter((m) => m.activeStatus === 1).length
    })
    return map
  })

  const allUserInfo = computed(() => {
    const allUsers: MatrixRoomMember[] = []
    Object.values(membersMap).forEach((members) => {
      members.forEach((m) => {
        if (!allUsers.find((u) => u.userId === m.userId)) {
          allUsers.push(m)
        }
      })
    })
    return allUsers
  })

  const memberList = computed(() => currentRoomMembers.value)

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

      membersMap[roomId] = matrixMembers
      logger.info(`[GroupStore] 加载房间成员成功: ${roomId}, ${matrixMembers.length} 个成员`)
      return matrixMembers
    } catch (err) {
      logger.error(`[GroupStore] 加载房间成员失败: ${err}`)
      return []
    } finally {
      loadingRooms.value.delete(roomId)
      triggerRef(loadingRooms)
    }
  }

  async function loadGroupInfo(roomId: string): Promise<MatrixGroupInfo | null> {
    try {
      const room = await matrixRoomQueryFacade.getRoom(roomId, false)
      if (!room) {
        return null
      }

      const state = room.getLiveTimeline().getState(Direction.Forward)
      const createEvent = state?.getStateEvents(EventType.RoomCreate, '')
      const creator = createEvent?.getSender() || null

      const groupInfo: MatrixGroupInfo = {
        roomId,
        name: room.name || roomId,
        avatarUrl: room.getMxcAvatarUrl?.() || null,
        avatar: room.getMxcAvatarUrl?.() || '',
        topic:
          ((room.currentState.getStateEvents(EventType.RoomTopic, '')?.getContent() as Record<string, unknown>)
            ?.topic as string) || null,
        memberCount: room.getJoinedMembers().length,
        memberNum: room.getJoinedMembers().length,
        // onlineNum 留空由 presence 同步流填写；不要用 memberCount 冒充
        isEncrypted: await matrixCryptoService.isRoomEncrypted(roomId),
        isPublic: room.currentState.getStateEvents(EventType.RoomJoinRules, '')?.getContent()?.join_rule === 'public',
        creator,
        groupName: room.name || roomId,
        roleId: 0,
        account: '',
        myName: '',
        allowScanEnter: false
      }

      groupInfoMap[roomId] = groupInfo
      return groupInfo
    } catch (err) {
      logger.error(`[GroupStore] 加载群组信息失败: ${err}`)
      return null
    }
  }

  async function inviteUser(roomId: string, userId: string): Promise<boolean> {
    try {
      await matrixRoomActionFacade.inviteUser(roomId, userId)
      logger.info(`[GroupStore] 邀请用户成功: ${userId} -> ${roomId}`)
      return true
    } catch (err) {
      logger.error(`[GroupStore] 邀请用户失败: ${err}`)
      return false
    }
  }

  async function kickUser(roomId: string, userId: string, reason?: string): Promise<boolean> {
    try {
      await matrixRoomActionFacade.kickUser(roomId, userId, reason)
      membersMap[roomId] = membersMap[roomId]?.filter((m) => m.userId !== userId) || []
      logger.info(`[GroupStore] 踢出用户成功: ${userId} <- ${roomId}`)
      return true
    } catch (err) {
      logger.error(`[GroupStore] 踢出用户失败: ${err}`)
      return false
    }
  }

  async function banUser(roomId: string, userId: string, reason?: string): Promise<boolean> {
    try {
      await matrixRoomActionFacade.banUser(roomId, userId, reason)
      await loadRoomMembers(roomId, true)
      logger.info(`[GroupStore] 封禁用户成功: ${userId} <- ${roomId}`)
      return true
    } catch (err) {
      logger.error(`[GroupStore] 封禁用户失败: ${err}`)
      return false
    }
  }

  async function leaveRoom(roomId: string): Promise<boolean> {
    try {
      await matrixRoomActionFacade.leaveRoom(roomId)
      delete membersMap[roomId]
      delete groupInfoMap[roomId]
      logger.info(`[GroupStore] 离开房间成功: ${roomId}`)
      return true
    } catch (err) {
      logger.error(`[GroupStore] 离开房间失败: ${err}`)
      return false
    }
  }

  async function setRoomName(roomId: string, name: string): Promise<boolean> {
    try {
      await matrixRoomActionFacade.setRoomName(roomId, name)
      if (groupInfoMap[roomId]) {
        groupInfoMap[roomId] = { ...groupInfoMap[roomId], name }
      }
      logger.info(`[GroupStore] 设置房间名称成功: ${name}`)
      return true
    } catch (err) {
      logger.error(`[GroupStore] 设置房间名称失败: ${err}`)
      return false
    }
  }

  async function setRoomTopic(roomId: string, topic: string): Promise<boolean> {
    try {
      await matrixRoomActionFacade.setRoomTopic(roomId, topic)
      if (groupInfoMap[roomId]) {
        groupInfoMap[roomId] = { ...groupInfoMap[roomId], topic }
      }
      logger.info(`[GroupStore] 设置房间主题成功`)
      return true
    } catch (err) {
      logger.error(`[GroupStore] 设置房间主题失败: ${err}`)
      return false
    }
  }

  async function setPowerLevel(roomId: string, userId: string, powerLevel: number): Promise<boolean> {
    try {
      await matrixRoomMemberFacade.setMemberPowerLevel(roomId, userId, powerLevel)
      await loadRoomMembers(roomId, true)
      logger.info(`[GroupStore] 设置用户权限成功: ${userId} -> ${powerLevel}`)
      return true
    } catch (err) {
      logger.error(`[GroupStore] 设置用户权限失败: ${err}`)
      return false
    }
  }

  function getMemberByUserId(roomId: string, userId: string): MatrixRoomMember | undefined {
    return membersMap[roomId]?.find((m) => m.userId === userId || m.uid === userId)
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
    return true
  }

  function updateUserPresence(uid: string, updates: Pick<MatrixRoomMember, 'activeStatus' | 'lastOptTime'>): boolean {
    let hasUpdated = false

    Object.keys(membersMap).forEach((roomId) => {
      const members = membersMap[roomId]
      if (!members?.length) {
        return
      }

      let roomUpdated = false
      membersMap[roomId] = members.map((member) => {
        if (member.userId !== uid && member.uid !== uid) {
          return member
        }

        roomUpdated = true
        return {
          ...member,
          ...updates
        }
      })

      if (roomUpdated) {
        hasUpdated = true
        if (groupInfoMap[roomId]) {
          groupInfoMap[roomId] = {
            ...groupInfoMap[roomId]
          }
        }
      }
    })

    return hasUpdated
  }

  function updateMemberCache(roomId: string, members: MatrixRoomMember[]): void {
    membersMap[roomId] = members
  }

  function updateGroupDetail(roomId: string, detail: Partial<MatrixGroupInfo>): void {
    if (groupInfoMap[roomId]) {
      groupInfoMap[roomId] = { ...groupInfoMap[roomId], ...detail }
    }
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

  function updateGroupNumber(roomId: string, totalNum: number): void {
    if (groupInfoMap[roomId]) {
      groupInfoMap[roomId] = { ...groupInfoMap[roomId], memberNum: totalNum }
    }
  }

  function clearRoomData(roomId: string): void {
    delete membersMap[roomId]
    delete groupInfoMap[roomId]
  }

  function clearAllData(): void {
    Object.keys(membersMap).forEach((key) => delete membersMap[key])
    Object.keys(groupInfoMap).forEach((key) => delete groupInfoMap[key])
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

  async function exitGroup(roomId: string): Promise<void> {
    await leaveRoom(roomId)
  }

  async function addAdmin(uidList: string[]): Promise<void> {
    const roomId = globalStore.currentSessionRoomId
    if (!roomId) return
    try {
      for (const uid of uidList) {
        await matrixRoomMemberFacade.setMemberPowerLevel(roomId, uid, 100)
      }
      logger.info(`[GroupStore] 成功添加 ${uidList.length} 个管理员`)
    } catch (e) {
      logger.error(`[GroupStore] 添加管理员失败: ${e}`)
      throw e
    }
  }

  async function revokeAdmin(uidList: string[]): Promise<void> {
    const roomId = globalStore.currentSessionRoomId
    if (!roomId) return
    try {
      for (const uid of uidList) {
        await matrixRoomMemberFacade.setMemberPowerLevel(roomId, uid, 0)
      }
      logger.info(`[GroupStore] 成功撤销 ${uidList.length} 个管理员`)
    } catch (e) {
      logger.error(`[GroupStore] 撤销管理员失败: ${e}`)
      throw e
    }
  }

  async function removeGroupMembers(uidList: string[], roomId?: string): Promise<void> {
    const targetRoomId = roomId || globalStore.currentSessionRoomId
    if (!targetRoomId) return
    for (const uid of uidList) {
      await kickUser(targetRoomId, uid)
    }
  }

  function isAdminOrLord(): boolean {
    return isCurrentUserCreator.value || isCurrentUserModerator.value
  }

  function getCurrentUser(): MatrixRoomMember | null {
    const myUserId = matrixStore.userId
    if (!myUserId) return null
    return currentRoomMembers.value.find((m) => m.userId === myUserId) || null
  }

  function removeAllUsers(roomId: string): void {
    membersMap[roomId] = []
  }

  function removeUserItem(uid: string, roomId?: string): boolean {
    const targetRoomId = roomId || globalStore.currentSessionRoomId
    if (!targetRoomId) return false
    membersMap[targetRoomId] = membersMap[targetRoomId]?.filter((m) => m.userId !== uid && m.uid !== uid) || []
    return true
  }

  function addUserItem(user: MatrixRoomMember, roomId?: string): boolean {
    const targetRoomId = roomId || globalStore.currentSessionRoomId
    if (!targetRoomId) return false
    if (!membersMap[targetRoomId]) {
      membersMap[targetRoomId] = []
    }
    membersMap[targetRoomId].push(user)
    return true
  }

  async function addGroupDetail(roomId: string): Promise<void> {
    await loadGroupInfo(roomId)
  }

  function removeGroupDetail(roomId: string): void {
    delete groupInfoMap[roomId]
  }

  async function setGroupDetails(): Promise<void> {
    const rooms = await matrixRoomQueryFacade.getRooms()
    for (const room of rooms) {
      if (!groupInfoMap[room.roomId]) {
        await loadGroupInfo(room.roomId)
      }
    }
  }

  function updateAdminStatus(roomId: string, uids: string[], isAdmin: boolean): void {
    const members = membersMap[roomId]
    if (!members) return
    membersMap[roomId] = members.map((m) =>
      uids.includes(m.userId) ? { ...m, isModerator: isAdmin, roleId: isAdmin ? 1 : 2 } : m
    )
  }

  async function switchSession(session: { roomId: string }): Promise<{ success: boolean }> {
    if (!session?.roomId) return { success: false }
    try {
      await loadRoomMembers(session.roomId, true)
      await loadGroupInfo(session.roomId)
      return { success: true }
    } catch (error) {
      logger.error('switchSession error:', error)
      return { success: false }
    }
  }

  const groupDetails = computed(() => Object.values(groupInfoMap))

  return {
    membersMap,
    groupInfoMap,
    loadingRooms,
    userListOptions,
    currentRoomMembers,
    currentGroupInfo,
    currentRoomCreator,
    currentRoomModerators,
    isCurrentUserCreator,
    isCurrentUserModerator,
    userList,
    countInfo,
    currentLordId,
    adminUidList,
    myNameInCurrentGroup,
    myRoleIdInCurrentGroup,
    isCurrentLord,
    isAdmin,
    getUserInfo,
    getUserDisplayName,
    getGroupDetailByRoomId,
    onlineCountMap,
    groupDetails,
    allUserInfo,
    memberList,
    loadRoomMembers,
    loadGroupInfo,
    inviteUser,
    kickUser,
    banUser,
    leaveRoom,
    setRoomName,
    setRoomTopic,
    setPowerLevel,
    getMemberByUserId,
    getMembersByRoomId,
    getUserListByRoomId,
    getUser,
    updateUserItem,
    updateUserPresence,
    updateMemberCache,
    updateGroupDetail,
    updateOnlineNum,
    updateGroupNumber,
    clearRoomData,
    clearAllData,
    cleanupSession,
    getGroupUserList,
    loadMoreGroupMembers,
    exitGroup,
    addAdmin,
    revokeAdmin,
    removeGroupMembers,
    isAdminOrLord,
    getCurrentUser,
    removeAllUsers,
    removeUserItem,
    addUserItem,
    addGroupDetail,
    removeGroupDetail,
    updateAdminStatus,
    setGroupDetails,
    switchSession
  }
})
