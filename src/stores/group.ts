import { defineStore } from 'pinia'
import { ref, computed, reactive } from 'vue'
import { StoresEnum, OnlineEnum } from '@/enums'
import { useGlobalStore } from '@/stores/global'
import { useMatrixStore } from '@/stores/matrix'
import { matrixRoomService } from '@/services/matrix'
import { matrixClientService } from '@/services/matrix'
import { info, error } from '@tauri-apps/plugin-log'

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
  locPlace?: string
  userStateId?: string
  wearingItemId?: string
  itemIds?: string[]
  linkedGitee?: boolean
  linkedGithub?: boolean
  linkedGitcode?: boolean
  oauthProviders?: ('gitee' | 'github' | 'gitcode')[]
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
  onlineNum?: number
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
}

export const useGroupStore = defineStore(
  StoresEnum.GROUP,
  () => {
    const globalStore = useGlobalStore()
    const matrixStore = useMatrixStore()

    const membersMap = reactive<Record<string, MatrixRoomMember[]>>({})
    const groupInfoMap = reactive<Record<string, MatrixGroupInfo>>({})
    const loadingRooms = ref<Set<string>>(new Set())
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
      return currentRoomMembers.value.some(
        (m) => m.userId === myUserId && (m.isModerator || m.isCreator)
      )
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
      set(_value: string) {
        // TODO: 实现设置昵称
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
      set(_value: number) {
        // TODO: 实现设置角色
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
      const client = matrixClientService.getClient()
      if (!client) {
        error('[GroupStore] 客户端未初始化')
        return []
      }

      if (!forceRefresh && membersMap[roomId]?.length) {
        return membersMap[roomId]
      }

      loadingRooms.value.add(roomId)
      try {
        const members = await matrixRoomService.getMembers(roomId)
        const matrixMembers: MatrixRoomMember[] = members.map((m: any) => ({
          userId: m.userId,
          uid: m.userId,
          displayName: m.name || m.userId.split(':')[0],
          name: m.name || m.userId.split(':')[0],
          avatarUrl: m.getMxcAvatarUrl?.() || null,
          avatar: m.getMxcAvatarUrl?.() || '',
          membership: m.membership,
          powerLevel: m.powerLevel || 0,
          isModerator: m.powerLevel >= 50,
          isCreator: m.powerLevel >= 100,
          roleId: m.powerLevel >= 100 ? 0 : m.powerLevel >= 50 ? 1 : 2,
          activeStatus: OnlineEnum.ONLINE,
          lastOptTime: Date.now(),
          account: m.userId.split(':')[0]
        }))

        membersMap[roomId] = matrixMembers
        info(`[GroupStore] 加载房间成员成功: ${roomId}, ${matrixMembers.length} 个成员`)
        return matrixMembers
      } catch (err) {
        error(`[GroupStore] 加载房间成员失败: ${err}`)
        return []
      } finally {
        loadingRooms.value.delete(roomId)
      }
    }

    async function loadGroupInfo(roomId: string): Promise<MatrixGroupInfo | null> {
      const client = matrixClientService.getClient()
      if (!client) {
        return null
      }

      try {
        const room = client.getRoom(roomId)
        if (!room) {
          return null
        }

        const state = room.getLiveTimeline().getState('f' as any)
        const createEvent = state?.getStateEvents('m.room.create' as any, '')
        const creator = createEvent?.getSender() || null

        const groupInfo: MatrixGroupInfo = {
          roomId,
          name: room.name || roomId,
          avatarUrl: room.getMxcAvatarUrl?.() || null,
          avatar: room.getMxcAvatarUrl?.() || '',
          topic: room.currentState.getStateEvents('m.room.topic' as any, '')?.getContent()?.topic || null,
          memberCount: room.getJoinedMembers().length,
          memberNum: room.getJoinedMembers().length,
          onlineNum: room.getJoinedMembers().length,
          isEncrypted: client.isRoomEncrypted(roomId),
          isPublic: room.currentState.getStateEvents('m.room.join_rules' as any, '')?.getContent()?.join_rule === 'public',
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
        error(`[GroupStore] 加载群组信息失败: ${err}`)
        return null
      }
    }

    async function inviteUser(roomId: string, userId: string): Promise<boolean> {
      try {
        await matrixRoomService.inviteUser(roomId, userId)
        info(`[GroupStore] 邀请用户成功: ${userId} -> ${roomId}`)
        return true
      } catch (err) {
        error(`[GroupStore] 邀请用户失败: ${err}`)
        return false
      }
    }

    async function kickUser(roomId: string, userId: string, reason?: string): Promise<boolean> {
      try {
        await matrixRoomService.kickUser(roomId, userId, reason)
        membersMap[roomId] = membersMap[roomId]?.filter((m) => m.userId !== userId) || []
        info(`[GroupStore] 踢出用户成功: ${userId} <- ${roomId}`)
        return true
      } catch (err) {
        error(`[GroupStore] 踢出用户失败: ${err}`)
        return false
      }
    }

    async function banUser(roomId: string, userId: string, reason?: string): Promise<boolean> {
      const client = matrixClientService.getClient()
      if (!client) {
        return false
      }

      try {
        await client.ban(roomId, userId, reason)
        await loadRoomMembers(roomId, true)
        info(`[GroupStore] 封禁用户成功: ${userId} <- ${roomId}`)
        return true
      } catch (err) {
        error(`[GroupStore] 封禁用户失败: ${err}`)
        return false
      }
    }

    async function leaveRoom(roomId: string): Promise<boolean> {
      try {
        await matrixRoomService.leaveRoom(roomId)
        delete membersMap[roomId]
        delete groupInfoMap[roomId]
        info(`[GroupStore] 离开房间成功: ${roomId}`)
        return true
      } catch (err) {
        error(`[GroupStore] 离开房间失败: ${err}`)
        return false
      }
    }

    async function setRoomName(roomId: string, name: string): Promise<boolean> {
      try {
        await matrixRoomService.setRoomName(roomId, name)
        if (groupInfoMap[roomId]) {
          groupInfoMap[roomId].name = name
        }
        info(`[GroupStore] 设置房间名称成功: ${name}`)
        return true
      } catch (err) {
        error(`[GroupStore] 设置房间名称失败: ${err}`)
        return false
      }
    }

    async function setRoomTopic(roomId: string, topic: string): Promise<boolean> {
      const client = matrixClientService.getClient()
      if (!client) {
        return false
      }

      try {
        await client.setRoomTopic(roomId, topic)
        if (groupInfoMap[roomId]) {
          groupInfoMap[roomId].topic = topic
        }
        info(`[GroupStore] 设置房间主题成功`)
        return true
      } catch (err) {
        error(`[GroupStore] 设置房间主题失败: ${err}`)
        return false
      }
    }

    async function setPowerLevel(roomId: string, userId: string, powerLevel: number): Promise<boolean> {
      const client = matrixClientService.getClient()
      if (!client) {
        return false
      }

      try {
        const room = client.getRoom(roomId)
        if (!room) return false

        const powerLevelsEvent = room.currentState.getStateEvents('m.room.power_levels' as any, '')
        const powerLevels = powerLevelsEvent?.getContent() || {}

        powerLevels.users = powerLevels.users || {}
        powerLevels.users[userId] = powerLevel

        await client.sendStateEvent(roomId, 'm.room.power_levels' as any, powerLevels, '')
        await loadRoomMembers(roomId, true)
        info(`[GroupStore] 设置用户权限成功: ${userId} -> ${powerLevel}`)
        return true
      } catch (err) {
        error(`[GroupStore] 设置用户权限失败: ${err}`)
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

    function updateUserItem(_uid: string, _updates: Partial<MatrixRoomMember>, _roomId?: string): boolean {
      // TODO: 实现更新用户信息
      return true
    }

    function updateMemberCache(roomId: string, members: MatrixRoomMember[]): void {
      membersMap[roomId] = members
    }

    function updateGroupDetail(roomId: string, detail: Partial<MatrixGroupInfo>): void {
      if (groupInfoMap[roomId]) {
        Object.assign(groupInfoMap[roomId], detail)
      }
    }

    function updateOnlineNum(_options: { uid?: string; roomId?: string; onlineNum?: number; isAdd?: boolean }): void {
      // TODO: 实现更新在线人数
    }

    function updateGroupNumber(roomId: string, totalNum: number, onlineNum: number): void {
      if (groupInfoMap[roomId]) {
        groupInfoMap[roomId].memberNum = totalNum
        groupInfoMap[roomId].onlineNum = onlineNum
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

    async function addAdmin(_uidList: string[]): Promise<void> {
      // TODO: 实现添加管理员
    }

    async function revokeAdmin(_uidList: string[]): Promise<void> {
      // TODO: 实现撤销管理员
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
      const client = matrixClientService.getClient()
      if (!client) return

      const rooms = client.getRooms()
      for (const room of rooms) {
        if (!groupInfoMap[room.roomId]) {
          await loadGroupInfo(room.roomId)
        }
      }
    }

    function updateAdminStatus(roomId: string, uids: string[], isAdmin: boolean): void {
      const members = membersMap[roomId]
      if (!members) return
      members.forEach((m) => {
        if (uids.includes(m.userId)) {
          m.isModerator = isAdmin
          m.roleId = isAdmin ? 1 : 2
        }
      })
    }

    async function switchSession(session: { roomId: string }): Promise<{ success: boolean }> {
      if (!session?.roomId) return { success: false }
      try {
        await loadRoomMembers(session.roomId, true)
        await loadGroupInfo(session.roomId)
        return { success: true }
      } catch (error) {
        console.error('[GroupStore] switchSession error:', error)
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
  },
  {
    share: {
      enable: true,
      initialize: true
    }
  }
)
