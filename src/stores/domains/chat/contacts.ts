import { defineStore } from 'pinia'
import { computed, ref, shallowRef, triggerRef } from 'vue'
import { OnlineEnum, StoresEnum } from '@/enums'
import {
  type Friend,
  type FriendRequest,
  type FriendServiceEventHandler,
  type FriendStatus,
  matrixFriendService
} from '@/services/matrix/friends/MatrixFriendService'
import { matrixClientService } from '@/services/matrix/MatrixClientService'
import { matrixRoomActionFacade } from '@/services/matrix/room/ActionFacade'
import { type DmRoomInfo, matrixDirectMessageService } from '@/services/matrix/room/MatrixDirectMessageService'
import { matrixRoomQueryFacade } from '@/services/matrix/room/QueryFacade'
import { EventType } from '@/services/matrix/sdk'
import { profileService } from '@/services/matrix/user/MatrixProfileService'
import { useGlobalStore } from '@/stores/domains/widget/global'
import { createLogger } from '@/utils/Logger'

const logger = createLogger('contacts')

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
  senderId?: string
  operateId?: string
  content?: string
  status?: number
  receiverId?: string
  eventType?: number
  isRead?: boolean
  createTime?: number
}

type FriendListErrorState = {
  message: string
  source: 'initialize' | 'contacts'
}

export const useContactStore = defineStore(StoresEnum.CONTACTS, () => {
  const globalStore = useGlobalStore()

  const contactsList = shallowRef<MatrixContact[]>([])
  const pendingInvites = shallowRef<ContactInvite[]>([])
  const isLoading = ref(false)
  const isServicesReady = ref(false)
  const contactsOptions = ref({ isLast: false, isLoading: false, cursor: '' })
  const requestFriendsList = shallowRef<FriendRequestItem[]>([])
  const applyPageOptions = ref({ isLast: false, cursor: '', pageNo: 1 })
  const friendFilter = ref<FriendStatus | 'all'>('all')
  const lastFriendError = ref<FriendListErrorState | null>(null)

  const directContacts = computed(() => contactsList.value.filter((c) => c.directRoomId))

  const filteredContacts = computed(() => {
    if (friendFilter.value === 'all') {
      return contactsList.value
    }
    return contactsList.value.filter((c) => c.friendStatus === friendFilter.value)
  })

  const favoriteContacts = computed(() => contactsList.value.filter((c) => c.friendStatus === 'favorite'))
  const blockedContacts = computed(() => contactsList.value.filter((c) => c.friendStatus === 'blocked'))
  const hiddenContacts = computed(() => contactsList.value.filter((c) => c.friendStatus === 'hidden'))

  const incomingRequestsCount = computed(
    () => requestFriendsList.value.filter((r) => r.direction === 'incoming').length
  )

  const normalizeFriendStatus = (status?: FriendStatus): FriendStatus | undefined => {
    if (status === 'accepted') {
      return 'normal'
    }
    return status
  }

  const resolveFriendErrorMessage = (err: unknown, fallback: string) => {
    if (err instanceof Error && err.message.trim()) {
      return err.message
    }

    if (typeof err === 'string' && err.trim()) {
      return err
    }

    return fallback
  }

  const setFriendListError = (source: FriendListErrorState['source'], err: unknown, fallback: string) => {
    lastFriendError.value = {
      source,
      message: resolveFriendErrorMessage(err, fallback)
    }
  }

  async function ensureFriendServicesReady(): Promise<void> {
    if (isServicesReady.value) {
      return
    }

    await matrixFriendService.initialize()
    await matrixDirectMessageService.initialize()

    matrixFriendService.on('sync', handleFriendSync as FriendServiceEventHandler)
    matrixFriendService.on('friendAdded', handleFriendAdded as FriendServiceEventHandler)
    matrixFriendService.on('friendRemoved', handleFriendRemoved as FriendServiceEventHandler)
    matrixFriendService.on('friendUpdated', handleFriendUpdated as FriendServiceEventHandler)
    matrixFriendService.on('requestReceived', handleRequestReceived as FriendServiceEventHandler)

    isServicesReady.value = true
  }

  async function initialize(): Promise<void> {
    try {
      await ensureFriendServicesReady()
      await loadContacts()
      await loadFriendRequests()
      logger.info('[ContactStore] 初始化完成')
    } catch (err) {
      logger.error(`[ContactStore] 初始化失败: ${err}`)
      setFriendListError('initialize', err, '好友列表初始化失败')
    }
  }

  function handleFriendSync(): void {
    loadContacts()
    loadFriendRequests()
  }

  function handleFriendAdded(friend: Friend): void {
    const existingIndex = contactsList.value.findIndex((c) => c.userId === friend.user_id)
    const contact = friendToContact(friend)

    if (existingIndex >= 0) {
      contactsList.value[existingIndex] = { ...contactsList.value[existingIndex], ...contact }
      triggerRef(contactsList)
    } else {
      contactsList.value.push(contact)
      triggerRef(contactsList)
    }
  }

  function handleFriendRemoved(userId: string): void {
    contactsList.value = contactsList.value.filter((c) => c.userId !== userId)
  }

  function handleFriendUpdated(friend: Friend): void {
    const index = contactsList.value.findIndex((c) => c.userId === friend.user_id)
    if (index >= 0) {
      const contact = friendToContact(friend)
      contactsList.value[index] = { ...contactsList.value[index], ...contact }
      triggerRef(contactsList)
    }
  }

  function handleRequestReceived(request: FriendRequest): void {
    const existing = requestFriendsList.value.find((r) => r.userId === request.user_id)
    if (!existing) {
      requestFriendsList.value.push({
        userId: request.user_id,
        displayName: request.display_name,
        avatarUrl: request.avatar_url,
        message: request.message,
        timestamp: request.timestamp,
        direction: request.direction,
        applyId: request.user_id
      })
      triggerRef(requestFriendsList)
      globalStore.incrementFriendUnreadCount()
    }
  }

  function friendToContact(friend: Friend): MatrixContact {
    const friendRecord = friend as Friend & {
      displayname?: string
      username?: string
      online?: boolean
      presence?: string
      last_active_ts?: number
    }
    const displayName = friend.display_name ?? friendRecord.displayname ?? friendRecord.username ?? null
    const activeStatus =
      friendRecord.online === true || friendRecord.presence === 'online' ? OnlineEnum.ONLINE : OnlineEnum.OFFLINE
    const lastOptTime = friend.since ?? friendRecord.last_active_ts ?? Date.now()

    return {
      userId: friend.user_id,
      uid: friend.user_id,
      displayName,
      name: displayName ?? friend.user_id.split(':')[0].replace(/^@/, ''),
      avatarUrl: friend.avatar_url ?? null,
      avatar: friend.avatar_url ?? '',
      account: friend.user_id.split(':')[0].replace(/^@/, ''),
      activeStatus,
      remark: friend.note ?? '',
      lastOptTime,
      hideMyPosts: false,
      hideTheirPosts: false,
      friendStatus: normalizeFriendStatus(friend.status as FriendStatus | undefined),
      since: lastOptTime,
      note: friend.note,
      directRoomId: friend.dm_room_id
    }
  }

  async function loadContacts(): Promise<void> {
    isLoading.value = true
    lastFriendError.value = null
    try {
      await ensureFriendServicesReady()
      const friends = await matrixFriendService.getFriends()
      const dmRoomInfos = await matrixDirectMessageService.getDmRoomInfos(false)

      const specialFriends = await matrixFriendService.getSpecialFriends()

      const contacts: MatrixContact[] = friends.map((friend: Friend) => {
        const dmRoom = dmRoomInfos.find(
          (r: DmRoomInfo) => r.invitees.includes(friend.user_id) || r.inviter === friend.user_id
        )
        const isSpecial = specialFriends.includes(friend.user_id)
        return {
          ...friendToContact(friend),
          directRoomId: dmRoom?.roomId ?? friend.dm_room_id,
          friendStatus: isSpecial ? 'favorite' : normalizeFriendStatus(friend.status as FriendStatus | undefined)
        }
      })

      for (const dmRoom of dmRoomInfos) {
        const partnerId = dmRoom.invitees[0] || dmRoom.inviter || ''
        if (!partnerId) continue

        if (!contacts.find((c) => c.userId === partnerId)) {
          const isSpecial = specialFriends.includes(partnerId)
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
            directRoomId: dmRoom.roomId,
            friendStatus: isSpecial ? ('favorite' as FriendStatus) : undefined
          })
        }
      }

      contactsList.value = contacts
      logger.info(`[ContactStore] 加载联系人成功: ${contacts.length} 个`)
    } catch (err) {
      logger.error(`[ContactStore] 加载联系人失败: ${err}`)
      // 客户端未初始化是暂时状态，不设置错误状态避免干扰 UI
      if (String(err).includes('客户端未初始化')) return
      setFriendListError('contacts', err, '加载好友列表失败')
    } finally {
      isLoading.value = false
    }
  }

  async function loadFriendRequests(): Promise<void> {
    try {
      await ensureFriendServicesReady()
      const incoming = await matrixFriendService.getIncomingRequests()
      const outgoing = await matrixFriendService.getOutgoingRequests()

      requestFriendsList.value = [
        ...incoming.map((r: FriendRequest) => ({
          userId: r.user_id,
          displayName: r.display_name,
          avatarUrl: r.avatar_url,
          message: r.message,
          timestamp: r.timestamp,
          direction: 'incoming' as const,
          applyId: r.user_id
        })),
        ...outgoing.map((r: FriendRequest) => ({
          userId: r.user_id,
          displayName: r.display_name,
          avatarUrl: r.avatar_url,
          message: r.message,
          timestamp: r.timestamp,
          direction: 'outgoing' as const,
          applyId: r.user_id
        }))
      ]

      globalStore.setFriendUnreadCount(incoming.length)
      logger.info(`[ContactStore] 加载好友请求成功: ${requestFriendsList.value.length} 个`)
    } catch (err) {
      logger.error(`[ContactStore] 加载好友请求失败: ${err}`)
      // 客户端未初始化是暂时状态，不需要额外处理
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
    try {
      const profile = await profileService.getProfile(userId)
      return {
        userId,
        uid: userId,
        displayName: profile.displayname || null,
        name: profile.displayname || userId.split(':')[0],
        avatarUrl: profile.avatarUrl || null,
        avatar: profile.avatarUrl || '',
        account: userId.split(':')[0],
        activeStatus: OnlineEnum.ONLINE,
        remark: '',
        lastOptTime: Date.now(),
        hideMyPosts: false,
        hideTheirPosts: false
      }
    } catch {
      logger.error(`[ContactStore] 获取用户资料失败: ${userId}`)
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
        triggerRef(contactsList)
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
        triggerRef(contactsList)
      }

      logger.info(`[ContactStore] 创建私聊房间成功: ${roomId}`)
      return roomId
    } catch (err) {
      logger.error(`[ContactStore] 创建私聊房间失败: ${err}`)
      return null
    }
  }

  async function sendFriendRequest(userId: string, message?: string): Promise<boolean> {
    try {
      await matrixFriendService.sendFriendRequest(userId, message)
      logger.info(`[ContactStore] 发送好友请求成功: ${userId}`)
      return true
    } catch (err) {
      logger.error(`[ContactStore] 发送好友请求失败: ${err}`)
      return false
    }
  }

  async function acceptFriendRequest(userId: string): Promise<boolean> {
    try {
      await matrixFriendService.acceptFriendRequest(userId)
      requestFriendsList.value = requestFriendsList.value.filter(
        (r) => !(r.userId === userId && r.direction === 'incoming')
      )
      globalStore.decrementFriendUnreadCount()
      logger.info(`[ContactStore] 接受好友请求成功: ${userId}`)

      loadContacts()
      const roomId = await startDirectRoom(userId)
      if (roomId) {
        const { openMsgSessionByRoomId } = await import('@/hooks/session/openMsgSession')
        await openMsgSessionByRoomId(roomId)
      }

      return true
    } catch (err) {
      logger.error(`[ContactStore] 接受好友请求失败: ${err}`)
      return false
    }
  }

  async function rejectFriendRequest(userId: string): Promise<boolean> {
    try {
      await matrixFriendService.rejectFriendRequest(userId)
      requestFriendsList.value = requestFriendsList.value.filter(
        (r) => !(r.userId === userId && r.direction === 'incoming')
      )
      globalStore.decrementFriendUnreadCount()
      logger.info(`[ContactStore] 拒绝好友请求成功: ${userId}`)
      return true
    } catch (err) {
      logger.error(`[ContactStore] 拒绝好友请求失败: ${err}`)
      return false
    }
  }

  async function cancelFriendRequest(userId: string): Promise<boolean> {
    try {
      await matrixFriendService.cancelFriendRequest(userId)
      requestFriendsList.value = requestFriendsList.value.filter(
        (r) => !(r.userId === userId && r.direction === 'outgoing')
      )
      logger.info(`[ContactStore] 取消好友请求成功: ${userId}`)
      return true
    } catch (err) {
      logger.error(`[ContactStore] 取消好友请求失败: ${err}`)
      return false
    }
  }

  async function removeFromContacts(userId: string): Promise<boolean> {
    try {
      if (await matrixFriendService.isFriend(userId)) {
        await matrixFriendService.removeFriend(userId)
      }
      contactsList.value = contactsList.value.filter((c) => c.userId !== userId)
      logger.info(`[ContactStore] 移除联系人成功: ${userId}`)
      return true
    } catch (err) {
      logger.error(`[ContactStore] 移除联系人失败: ${err}`)
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
        triggerRef(contactsList)
      }
      logger.info(`[ContactStore] 设置好友备注成功: ${userId}`)
      return true
    } catch (err) {
      logger.error(`[ContactStore] 设置好友备注失败: ${err}`)
      return false
    }
  }

  async function setFriendDisplayName(userId: string, displayName: string): Promise<boolean> {
    try {
      await matrixFriendService.setFriendDisplayName(userId, displayName)
      const contact = contactsList.value.find((c) => c.userId === userId)
      if (contact) {
        contact.remark = displayName
        triggerRef(contactsList)
      }
      logger.info(`[ContactStore] 设置好友显示名成功: ${userId}`)
      return true
    } catch (err) {
      logger.error(`[ContactStore] 设置好友显示名失败: ${err}`)
      return false
    }
  }

  async function loadFriendSuggestions(): Promise<
    Array<{ user_id: string; display_name?: string; avatar_url?: string; reason?: string }>
  > {
    try {
      return await matrixFriendService.getFriendSuggestions()
    } catch (err) {
      logger.error(`[ContactStore] 获取好友建议失败: ${err}`)
      return []
    }
  }

  async function setFriendStatus(userId: string, status: FriendStatus): Promise<boolean> {
    try {
      await matrixFriendService.setFriendStatus(userId, status)
      const contact = contactsList.value.find((c) => c.userId === userId)
      if (contact) {
        contact.friendStatus = normalizeFriendStatus(status)
        triggerRef(contactsList)
      }
      logger.info(`[ContactStore] 设置好友状态成功: ${userId} -> ${status}`)
      return true
    } catch (err) {
      logger.error(`[ContactStore] 设置好友状态失败: ${err}`)
      return false
    }
  }

  async function loadPendingInvites(): Promise<void> {
    const currentUserId = matrixClientService.getUserId()
    if (!currentUserId) {
      return
    }

    try {
      const rooms = await matrixRoomQueryFacade.getRooms()
      const invites: ContactInvite[] = []

      for (const room of rooms) {
        const membership = (room as { getMyMembership?: () => string | undefined }).getMyMembership?.()
        if (membership === 'invite') {
          const inviteState = room.getLiveTimeline()?.getState('f')
          const inviteFrom = inviteState?.getStateEvents(EventType.RoomMember, currentUserId)?.getSender()

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
      globalStore.setGroupUnreadCount(invites.filter((i) => i.isGroup).length)
    } catch (err) {
      logger.error(`[ContactStore] 加载邀请列表失败: ${err}`)
    }
  }

  async function acceptInvite(roomId: string): Promise<boolean> {
    try {
      await matrixRoomActionFacade.joinRoom(roomId)
      pendingInvites.value = pendingInvites.value.filter((i) => i.roomId !== roomId)
      logger.info(`[ContactStore] 接受邀请成功: ${roomId}`)
      return true
    } catch (err) {
      logger.error(`[ContactStore] 接受邀请失败: ${err}`)
      return false
    }
  }

  async function rejectInvite(roomId: string): Promise<boolean> {
    try {
      await matrixRoomActionFacade.leaveRoom(roomId)
      pendingInvites.value = pendingInvites.value.filter((i) => i.roomId !== roomId)
      logger.info(`[ContactStore] 拒绝邀请成功: ${roomId}`)
      return true
    } catch (err) {
      logger.error(`[ContactStore] 拒绝邀请失败: ${err}`)
      return false
    }
  }

  function getContactByUserId(userId: string): MatrixContact | undefined {
    return contactsList.value.find((c) => c.userId === userId || c.uid === userId)
  }

  function updateContactPresence(
    userId: string,
    updates: Pick<MatrixContact, 'activeStatus' | 'lastOptTime'> &
      Partial<Pick<MatrixContact, 'presence' | 'statusMessage'>>
  ): boolean {
    const index = contactsList.value.findIndex((c) => c.userId === userId || c.uid === userId)
    if (index === -1) {
      return false
    }

    contactsList.value[index] = {
      ...contactsList.value[index],
      ...updates
    }
    triggerRef(contactsList)
    return true
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
    lastFriendError.value = null
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
    isServicesReady.value = false
    clearContacts()
  }

  return {
    contactsList,
    pendingInvites,
    isLoading,
    lastFriendError,
    contactsOptions,
    requestFriendsList,
    applyPageOptions,
    directContacts,
    filteredContacts,
    favoriteContacts,
    blockedContacts,
    hiddenContacts,
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
    setFriendDisplayName,
    loadFriendSuggestions,
    setFriendStatus,
    loadPendingInvites,
    acceptInvite,
    rejectInvite,
    getContactByUserId,
    updateContactPresence,
    isFriend,
    setFriendFilter,
    clearContacts,
    getApplyUnReadCount,
    getApplyPage,
    onHandleInvite,
    cleanup
  }
})
