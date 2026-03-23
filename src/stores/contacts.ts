import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { StoresEnum, OnlineEnum } from '@/enums'
import { useGlobalStore } from '@/stores/global'
import {
  matrixFriendService,
  type Friend,
  type FriendRequest,
  type FriendStatus,
  type FriendServiceEventHandler
} from '@/services/matrix/MatrixFriendService'
import { matrixDirectMessageService } from '@/services/matrix/MatrixDirectMessageService'
import { matrixClientService } from '@/services/matrix'
import { info, error } from '@tauri-apps/plugin-log'

export interface MatrixContact {
  userId: string
  displayName: string | null
  avatarUrl: string | null
  presence?: string
  statusMessage?: string
  directRoomId?: string
  uid: string
  name: string
  account: string
  avatar: string
  activeStatus: OnlineEnum
  remark: string
  lastOptTime: number
  hideMyPosts: boolean
  hideTheirPosts: boolean
  friendStatus?: FriendStatus
  since?: number
  note?: string
}

export interface ContactInvite {
  roomId: string
  fromUserId: string
  fromDisplayName: string | null
  timestamp: number
  isGroup: boolean
}

export interface FriendRequestItem {
  userId?: string
  displayName?: string
  avatarUrl?: string
  message?: string
  timestamp?: number
  direction?: 'incoming' | 'outgoing'
  type?: string | number
  roomId?: string
  applyId: string
  state?: number
  applyType?: string | 'group' | 'friend'
  markAsRead?: boolean
}

export const useContactStore = defineStore(StoresEnum.CONTACTS, () => {
  const globalStore = useGlobalStore()

  const contactsList = ref<MatrixContact[]>([])
  const pendingInvites = ref<ContactInvite[]>([])
  const isLoading = ref(false)
  const contactsOptions = ref({ isLast: false, isLoading: false, cursor: '' })
  const requestFriendsList = ref<FriendRequestItem[]>([])
  const applyPageOptions = ref({ isLast: false, cursor: '', pageNo: 1 })
  const friendFilter = ref<FriendStatus | 'all'>('all')

  const directContacts = computed(() => contactsList.value.filter((c) => c.directRoomId))

  const filteredContacts = computed(() => {
    if (friendFilter.value === 'all') {
      return contactsList.value
    }
    return contactsList.value.filter((c) => c.friendStatus === friendFilter.value)
  })

  const favoriteContacts = computed(() => contactsList.value.filter((c) => c.friendStatus === 'favorite'))

  const blockedContacts = computed(() => contactsList.value.filter((c) => c.friendStatus === 'blocked'))

  const incomingRequestsCount = computed(
    () => requestFriendsList.value.filter((r) => r.direction === 'incoming').length
  )

  async function initialize(): Promise<void> {
    try {
      await matrixFriendService.initialize()
      await matrixDirectMessageService.initialize()

      matrixFriendService.on('sync', handleFriendSync as FriendServiceEventHandler)
      matrixFriendService.on('friendAdded', handleFriendAdded as FriendServiceEventHandler)
      matrixFriendService.on('friendRemoved', handleFriendRemoved as FriendServiceEventHandler)
      matrixFriendService.on('friendUpdated', handleFriendUpdated as FriendServiceEventHandler)
      matrixFriendService.on('requestReceived', handleRequestReceived as FriendServiceEventHandler)

      await loadContacts()
      await loadFriendRequests()
      info('[ContactStore] 初始化完成')
    } catch (err) {
      error(`[ContactStore] 初始化失败: ${err}`)
    }
  }

  function handleFriendSync(): void {
    loadContacts()
    loadFriendRequests()
  }

  function handleFriendAdded(friend: Friend): void {
    const existingIndex = contactsList.value.findIndex((c) => c.userId === friend.userId)
    const contact = friendToContact(friend)

    if (existingIndex >= 0) {
      contactsList.value[existingIndex] = { ...contactsList.value[existingIndex], ...contact }
    } else {
      contactsList.value.push(contact)
    }
  }

  function handleFriendRemoved(userId: string): void {
    contactsList.value = contactsList.value.filter((c) => c.userId !== userId)
  }

  function handleFriendUpdated(friend: Friend): void {
    const index = contactsList.value.findIndex((c) => c.userId === friend.userId)
    if (index >= 0) {
      const contact = friendToContact(friend)
      contactsList.value[index] = { ...contactsList.value[index], ...contact }
    }
  }

  function handleRequestReceived(request: FriendRequest): void {
    const existing = requestFriendsList.value.find((r) => r.userId === request.userId)
    if (!existing) {
      requestFriendsList.value.push({
        userId: request.userId,
        displayName: request.displayName,
        avatarUrl: request.avatarUrl,
        message: request.message,
        timestamp: request.timestamp,
        direction: request.direction,
        applyId: request.userId
      })
      globalStore.unReadMark.newFriendUnreadCount++
    }
  }

  function friendToContact(friend: Friend): MatrixContact {
    return {
      userId: friend.userId,
      uid: friend.userId,
      displayName: friend.displayName ?? null,
      name: friend.displayName ?? friend.userId.split(':')[0],
      avatarUrl: friend.avatarUrl ?? null,
      avatar: friend.avatarUrl ?? '',
      account: friend.userId.split(':')[0],
      activeStatus: OnlineEnum.ONLINE,
      remark: friend.note ?? '',
      lastOptTime: friend.since ?? Date.now(),
      hideMyPosts: false,
      hideTheirPosts: false,
      friendStatus: friend.status as FriendStatus | undefined,
      since: friend.since,
      note: friend.note,
      directRoomId: friend.dmRoomId
    }
  }

  async function loadContacts(): Promise<void> {
    isLoading.value = true
    try {
      const friends = await matrixFriendService.getFriends()
      const dmRoomInfos = await matrixDirectMessageService.getDmRoomInfos()

      const contacts: MatrixContact[] = friends.map((friend) => {
        const dmRoom = dmRoomInfos.find((r) => r.invitees.includes(friend.userId) || r.inviter === friend.userId)
        return {
          ...friendToContact(friend),
          directRoomId: dmRoom?.roomId ?? friend.dmRoomId
        }
      })

      for (const dmRoom of dmRoomInfos) {
        // 简单提取第一个非自己的参与者作为 partner
        const partnerId = dmRoom.invitees[0] || dmRoom.inviter || ''
        if (!partnerId) continue
        
        if (!contacts.find((c) => c.userId === partnerId)) {
          contacts.push({
            userId: partnerId,
            uid: partnerId,
            displayName: dmRoom.name ?? null,
            name: dmRoom.name ?? partnerId.split(':')[0],
            avatarUrl: dmRoom.avatarUrl ?? null,
            avatar: dmRoom.avatarUrl ?? '',
            account: partnerId.split(':')[0],
            activeStatus: OnlineEnum.ONLINE,
            remark: '',
            lastOptTime: dmRoom.lastMessage?.timestamp ?? Date.now(),
            hideMyPosts: false,
            hideTheirPosts: false,
            directRoomId: dmRoom.roomId
          })
        }
      }

      contactsList.value = contacts
      info(`[ContactStore] 加载联系人成功: ${contacts.length} 个`)
    } catch (err) {
      error(`[ContactStore] 加载联系人失败: ${err}`)
    } finally {
      isLoading.value = false
    }
  }

  async function loadFriendRequests(): Promise<void> {
    try {
      const incoming = await matrixFriendService.getIncomingRequests()
      const outgoing = await matrixFriendService.getOutgoingRequests()

      requestFriendsList.value = [
        ...incoming.map((r) => ({
          userId: r.userId,
          displayName: r.displayName,
          avatarUrl: r.avatarUrl,
          message: r.message,
          timestamp: r.timestamp,
          direction: 'incoming' as const,
          applyId: r.userId
        })),
        ...outgoing.map((r) => ({
          userId: r.userId,
          displayName: r.displayName,
          avatarUrl: r.avatarUrl,
          message: r.message,
          timestamp: r.timestamp,
          direction: 'outgoing' as const,
          applyId: r.userId
        }))
      ]

      globalStore.unReadMark.newFriendUnreadCount = incoming.length
      info(`[ContactStore] 加载好友请求成功: ${requestFriendsList.value.length} 个`)
    } catch (err) {
      error(`[ContactStore] 加载好友请求失败: ${err}`)
    }
  }

  async function getContactList(isFresh = false): Promise<void> {
    if (isFresh) {
      contactsOptions.value.cursor = ''
      contactsOptions.value.isLast = false
    }
    await loadContacts()
  }

  async function getUserProfile(userId: string): Promise<MatrixContact | null> {
    const client = matrixClientService.getClient()
    if (!client) {
      return null
    }

    try {
      const profile = await client.getProfileInfo(userId)
      return {
        userId,
        uid: userId,
        displayName: profile.displayname || null,
        name: profile.displayname || userId.split(':')[0],
        avatarUrl: profile.avatar_url || null,
        avatar: profile.avatar_url || '',
        account: userId.split(':')[0],
        activeStatus: OnlineEnum.ONLINE,
        remark: '',
        lastOptTime: Date.now(),
        hideMyPosts: false,
        hideTheirPosts: false
      }
    } catch (_err) {
      error(`[ContactStore] 获取用户资料失败: ${userId}`)
      return null
    }
  }

  async function startDirectRoom(userId: string, encrypted = false): Promise<string | null> {
    try {
      const existingContact = contactsList.value.find((c) => c.userId === userId)
      if (existingContact?.directRoomId) {
        return existingContact.directRoomId
      }

      const roomId = await matrixDirectMessageService.createDm(userId, { userIds: [userId], isEncrypted: encrypted })

      const contactIndex = contactsList.value.findIndex((c) => c.userId === userId)
      if (contactIndex >= 0) {
        contactsList.value[contactIndex].directRoomId = roomId
      } else {
        contactsList.value.push({
          userId,
          uid: userId,
          displayName: null,
          name: userId.split(':')[0],
          avatarUrl: null,
          avatar: '',
          directRoomId: roomId,
          account: userId.split(':')[0],
          activeStatus: OnlineEnum.ONLINE,
          remark: '',
          lastOptTime: Date.now(),
          hideMyPosts: false,
          hideTheirPosts: false
        })
      }

      info(`[ContactStore] 创建私聊房间成功: ${roomId}`)
      return roomId
    } catch (err) {
      error(`[ContactStore] 创建私聊房间失败: ${err}`)
      return null
    }
  }

  async function sendFriendRequest(userId: string, message?: string): Promise<boolean> {
    try {
      await matrixFriendService.sendFriendRequest(userId, message)
      info(`[ContactStore] 发送好友请求成功: ${userId}`)
      return true
    } catch (err) {
      error(`[ContactStore] 发送好友请求失败: ${err}`)
      return false
    }
  }

  async function acceptFriendRequest(userId: string): Promise<boolean> {
    try {
      await matrixFriendService.acceptFriendRequest(userId)
      requestFriendsList.value = requestFriendsList.value.filter(
        (r) => !(r.userId === userId && r.direction === 'incoming')
      )
      globalStore.unReadMark.newFriendUnreadCount = Math.max(0, globalStore.unReadMark.newFriendUnreadCount - 1)
      info(`[ContactStore] 接受好友请求成功: ${userId}`)
      return true
    } catch (err) {
      error(`[ContactStore] 接受好友请求失败: ${err}`)
      return false
    }
  }

  async function rejectFriendRequest(userId: string): Promise<boolean> {
    try {
      await matrixFriendService.rejectFriendRequest(userId)
      requestFriendsList.value = requestFriendsList.value.filter(
        (r) => !(r.userId === userId && r.direction === 'incoming')
      )
      globalStore.unReadMark.newFriendUnreadCount = Math.max(0, globalStore.unReadMark.newFriendUnreadCount - 1)
      info(`[ContactStore] 拒绝好友请求成功: ${userId}`)
      return true
    } catch (err) {
      error(`[ContactStore] 拒绝好友请求失败: ${err}`)
      return false
    }
  }

  async function cancelFriendRequest(userId: string): Promise<boolean> {
    try {
      await matrixFriendService.cancelFriendRequest(userId)
      requestFriendsList.value = requestFriendsList.value.filter(
        (r) => !(r.userId === userId && r.direction === 'outgoing')
      )
      info(`[ContactStore] 取消好友请求成功: ${userId}`)
      return true
    } catch (err) {
      error(`[ContactStore] 取消好友请求失败: ${err}`)
      return false
    }
  }

  async function removeFromContacts(userId: string): Promise<boolean> {
    try {
      if (await matrixFriendService.isFriend(userId)) {
        await matrixFriendService.removeFriend(userId)
      }
      contactsList.value = contactsList.value.filter((c) => c.userId !== userId)
      info(`[ContactStore] 移除联系人成功: ${userId}`)
      return true
    } catch (err) {
      error(`[ContactStore] 移除联系人失败: ${err}`)
      return false
    }
  }

  async function onDeleteFriend(uid: string): Promise<void> {
    await removeFromContacts(uid)
  }

  function deleteContact(uid: string): void {
    contactsList.value = contactsList.value.filter((c) => c.userId !== uid && c.uid !== uid)
  }

  async function setFriendNote(userId: string, note: string): Promise<boolean> {
    try {
      await matrixFriendService.setFriendNote(userId, note)
      const contact = contactsList.value.find((c) => c.userId === userId)
      if (contact) {
        contact.remark = note
        contact.note = note
      }
      info(`[ContactStore] 设置好友备注成功: ${userId}`)
      return true
    } catch (err) {
      error(`[ContactStore] 设置好友备注失败: ${err}`)
      return false
    }
  }

  async function setFriendStatus(userId: string, status: FriendStatus): Promise<boolean> {
    try {
      await matrixFriendService.setFriendStatus(userId, status)
      const contact = contactsList.value.find((c) => c.userId === userId)
      if (contact) {
        contact.friendStatus = status
      }
      info(`[ContactStore] 设置好友状态成功: ${userId} -> ${status}`)
      return true
    } catch (err) {
      error(`[ContactStore] 设置好友状态失败: ${err}`)
      return false
    }
  }

  async function loadPendingInvites(): Promise<void> {
    const client = matrixClientService.getClient()
    if (!client) {
      return
    }

    try {
      const rooms = client.getRooms()
      const invites: ContactInvite[] = []

      for (const room of rooms) {
        const membership = (room as any).getMyMembership?.()
        if (membership === 'invite') {
          const inviteState = room.getLiveTimeline()?.getState('f' as any)
          const inviteFrom = inviteState?.getStateEvents('m.room.member' as any, client.getUserId() ?? '')?.getSender()

          invites.push({
            roomId: room.roomId,
            fromUserId: inviteFrom || 'unknown',
            fromDisplayName: room.name || inviteFrom?.split(':')[0] || 'Unknown',
            timestamp: Date.now(),
            isGroup: !room.isSpaceRoom() && room.getJoinedMembers().length > 2
          })
        }
      }

      pendingInvites.value = invites
      globalStore.unReadMark.newGroupUnreadCount = invites.filter((i) => i.isGroup).length
    } catch (err) {
      error(`[ContactStore] 加载邀请列表失败: ${err}`)
    }
  }

  async function acceptInvite(roomId: string): Promise<boolean> {
    try {
      const client = matrixClientService.getClient()
      if (!client) {
        throw new Error('客户端未初始化')
      }
      await client.joinRoom(roomId)
      pendingInvites.value = pendingInvites.value.filter((i) => i.roomId !== roomId)
      info(`[ContactStore] 接受邀请成功: ${roomId}`)
      return true
    } catch (err) {
      error(`[ContactStore] 接受邀请失败: ${err}`)
      return false
    }
  }

  async function rejectInvite(roomId: string): Promise<boolean> {
    try {
      const client = matrixClientService.getClient()
      if (!client) {
        throw new Error('客户端未初始化')
      }
      await client.leave(roomId)
      pendingInvites.value = pendingInvites.value.filter((i) => i.roomId !== roomId)
      info(`[ContactStore] 拒绝邀请成功: ${roomId}`)
      return true
    } catch (err) {
      error(`[ContactStore] 拒绝邀请失败: ${err}`)
      return false
    }
  }

  function getContactByUserId(userId: string): MatrixContact | undefined {
    return contactsList.value.find((c) => c.userId === userId || c.uid === userId)
  }

  function isFriend(userId: string): Promise<boolean> {
    return matrixFriendService.isFriend(userId)
  }

  function setFriendFilter(filter: FriendStatus | 'all'): void {
    friendFilter.value = filter
  }

  function clearContacts(): void {
    contactsList.value = []
    pendingInvites.value = []
    requestFriendsList.value = []
  }

  async function getApplyUnReadCount(): Promise<void> {
    await loadFriendRequests()
    await loadPendingInvites()
  }

  async function getApplyPage(_applyType: string, _isFresh = false, _click = false): Promise<void> {
    await loadFriendRequests()
  }

  async function onHandleInvite(apply: FriendRequestItem): Promise<void> {
    if (apply.direction === 'incoming' && apply.userId) {
      await acceptFriendRequest(apply.userId)
    }
  }

  function cleanup(): void {
    matrixFriendService.stop()
    matrixDirectMessageService.stop()
    clearContacts()
  }

  return {
    contactsList,
    pendingInvites,
    isLoading,
    contactsOptions,
    requestFriendsList,
    applyPageOptions,
    directContacts,
    filteredContacts,
    favoriteContacts,
    blockedContacts,
    incomingRequestsCount,
    friendFilter,
    initialize,
    loadContacts,
    loadFriendRequests,
    getContactList,
    getUserProfile,
    startDirectRoom,
    sendFriendRequest,
    acceptFriendRequest,
    rejectFriendRequest,
    cancelFriendRequest,
    removeFromContacts,
    onDeleteFriend,
    deleteContact,
    setFriendNote,
    setFriendStatus,
    loadPendingInvites,
    acceptInvite,
    rejectInvite,
    getContactByUserId,
    isFriend,
    setFriendFilter,
    clearContacts,
    getApplyUnReadCount,
    getApplyPage,
    onHandleInvite,
    cleanup
  }
})
