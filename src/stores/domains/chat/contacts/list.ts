import { computed, ref, shallowRef, triggerRef } from 'vue'
import { OnlineEnum } from '@/enums'
import { type Friend, type FriendStatus, matrixFriendService } from '@/services/matrix/friends/MatrixFriendService'
import { type DmRoomInfo, matrixDirectMessageService } from '@/services/matrix/room/MatrixDirectMessageService'
import { createLogger } from '@/utils/Logger'
import type { FriendListErrorState, MatrixContact } from './types'

const logger = createLogger('ContactStore.List')

export type ContactsListContext = {
  ensureFriendServicesReady: () => Promise<void>
}

/** 好友状态归一化：服务端 accepted 映射为 normal */
export const normalizeFriendStatus = (status?: FriendStatus): FriendStatus | undefined => {
  if (status === 'accepted') {
    return 'normal'
  }
  return status
}

/**
 * 好友列表模块：联系人加载/缓存、好友事件处理、备注/显示名/状态变更、
 * presence 更新、筛选与分类 getter、好友列表错误状态。
 */
export function createContactsList(ctx: ContactsListContext) {
  const { ensureFriendServicesReady } = ctx

  const contactsList = shallowRef<MatrixContact[]>([])
  const isLoading = ref(false)
  const contactsOptions = ref({ isLast: false, isLoading: false, cursor: '' })
  const friendFilter = ref<FriendStatus | 'all'>('all')
  const lastFriendError = ref<FriendListErrorState | null>(null)

  const filteredContacts = computed(() => {
    if (friendFilter.value === 'all') {
      return contactsList.value
    }
    return contactsList.value.filter((c) => c.friendStatus === friendFilter.value)
  })

  const favoriteContacts = computed(() => contactsList.value.filter((c) => c.friendStatus === 'favorite'))
  const blockedContacts = computed(() => contactsList.value.filter((c) => c.friendStatus === 'blocked'))

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

  async function getContactList(isFresh = false): Promise<void> {
    if (isFresh) {
      contactsOptions.value.cursor = ''
      contactsOptions.value.isLast = false
    }
    await loadContacts()
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

  return {
    contactsList,
    isLoading,
    contactsOptions,
    friendFilter,
    lastFriendError,
    filteredContacts,
    favoriteContacts,
    blockedContacts,
    setFriendListError,
    handleFriendAdded,
    handleFriendRemoved,
    handleFriendUpdated,
    loadContacts,
    getContactList,
    removeFromContacts,
    onDeleteFriend,
    setFriendNote,
    setFriendDisplayName,
    setFriendStatus,
    getContactByUserId,
    updateContactPresence,
    isFriend
  }
}
