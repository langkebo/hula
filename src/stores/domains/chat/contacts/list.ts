import { computed, ref, shallowRef, triggerRef } from 'vue'
import { OnlineEnum } from '@/enums'
import {
  type Friend,
  type FriendStatus,
  matrixFriendOperations,
  matrixFriendService,
  streamFriendsPages
} from '@/services/matrix/friends/MatrixFriendService'
import { type DmRoomInfo, matrixDirectMessageService } from '@/services/matrix/room/MatrixDirectMessageService'
import { matrixPresenceService } from '@/services/matrix/user/MatrixPresenceService'
import { createLogger } from '@/utils/Logger'
import { mergeContactListPreservingPresence, mergeContactPreservingPresence } from './presenceMerge'
import type { FriendListErrorState, MatrixContact } from './types'

const logger = createLogger('ContactStore.List')

type ContactsListContext = {
  ensureFriendServicesReady: () => Promise<void>
}

/** 好友状态归一化：服务端 accepted 映射为 normal */
const normalizeFriendStatus = (status?: FriendStatus): FriendStatus | undefined => {
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
      contactsList.value[existingIndex] = mergeContactPreservingPresence(contactsList.value[existingIndex], contact)
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
      contactsList.value[index] = mergeContactPreservingPresence(contactsList.value[index], contact)
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

    // 默认设为离线，等待 Matrix presence 同步后更新真实状态。
    // 后端 API 返回的 online/presence 字段可能不准确（如用户未登录但标记为 online），
    // 避免依赖可能错误的初始状态，让 presence 同步机制来决定真实在线状态。
    const activeStatus = OnlineEnum.OFFLINE

    const lastOptTime = friend.since ?? friendRecord.last_active_ts ?? Date.now()

    return {
      userId: friend.user_id,
      displayName,
      avatarUrl: friend.avatar_url ?? null,
      account: friend.user_id.split(':')[0].replace(/^@/, ''),
      activeStatus,
      // 备注名 = 我给他起的名字（后端 display_name）；note 是独立的自由文本，不能混用
      remark: friend.display_name ?? '',
      lastOptTime,
      hideMyPosts: false,
      hideTheirPosts: false,
      friendStatus: normalizeFriendStatus(friend.status as FriendStatus | undefined),
      since: lastOptTime,
      note: friend.note,
      directRoomId: friend.dm_room_id
    }
  }

  /** 好友（一页）→ 联系人条目：补 DM 房间与特别关注（`dmRoomInfos`/`specialFriends` 逐页复用）。 */
  function friendsToContacts(friends: Friend[], dmRoomInfos: DmRoomInfo[], specialFriends: string[]): MatrixContact[] {
    return friends.map((friend: Friend) => {
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
  }

  /** DM 房间 → 联系人条目（对方不是好友，仅有会话）。 */
  function dmRoomToContact(dmRoom: DmRoomInfo, partnerId: string, specialFriends: string[]): MatrixContact {
    const isSpecial = specialFriends.includes(partnerId)
    return {
      userId: partnerId,
      displayName: dmRoom.name ?? null,
      avatarUrl: dmRoom.avatarUrl ?? null,
      account: partnerId.split(':')[0],
      activeStatus: OnlineEnum.OFFLINE,
      remark: '',
      lastOptTime: dmRoom.lastMessage?.timestamp ?? Date.now(),
      hideMyPosts: false,
      hideTheirPosts: false,
      directRoomId: dmRoom.roomId,
      friendStatus: isSpecial ? ('favorite' as FriendStatus) : undefined
    }
  }

  /** 过滤服务端已删除/停用的幽灵账号；presence 校验失败时**保留原列表**。 */
  async function filterGhostContacts(contacts: MatrixContact[]): Promise<MatrixContact[]> {
    const candidateUserIds = contacts.map((c) => c.userId).filter((id): id is string => !!id)
    if (candidateUserIds.length === 0) return contacts
    try {
      const presences = await matrixPresenceService.getBatchPresence(candidateUserIds)
      const notFoundIds = new Set(presences.filter((p) => p.notFound).map((p) => p.user_id))
      if (notFoundIds.size === 0) return contacts
      const kept = contacts.filter((c) => !notFoundIds.has(c.userId))
      logger.info(`[ContactStore] 已过滤 ${contacts.length - kept.length} 个不存在的联系人`)
      return kept
    } catch (err) {
      logger.warn(`[ContactStore] 批量校验联系人存在性失败，保留原列表: ${err}`)
      return contacts
    }
  }

  /**
   * 加载联系人（**首页 + 逐页补齐**）：首页一到就把 `isLoading` 置 false 让界面先出内容，
   * 剩余页在同一循环里增量合并。游标串行，「并行预取」不成立，能省的只有首屏等待。
   * 补齐期间列表是「部分」的（`isFriend` 可能漏判），但旧行为是整段加载期间列表**全空**，故非回归。
   */
  async function loadContacts(): Promise<void> {
    isLoading.value = true
    lastFriendError.value = null
    try {
      await ensureFriendServicesReady()
      // DM 房间与特别关注只取一次，逐页复用
      const dmRoomInfos = await matrixDirectMessageService.getDmRoomInfos(false)
      const specialFriends = await matrixFriendService.getSpecialFriends()

      let firstPage = true
      // 失败语义：真实失败由生成器**抛出**（走下方 catch）；「客户端未就绪」只返回空页
      for await (const page of streamFriendsPages()) {
        const pageContacts = await filterGhostContacts(friendsToContacts(page.friends, dmRoomInfos, specialFriends))
        // 注意 `mergeContactListPreservingPresence(prev, next)` 的语义是「用 next 重建、保留 prev 的在线态」，
        // 不是追加 —— 追加必须自己拼 union，否则后一页会把前一页顶掉。
        const known = new Set(contactsList.value.map((c) => c.userId))
        const additions = firstPage ? pageContacts : pageContacts.filter((c) => !known.has(c.userId))
        contactsList.value = mergeContactListPreservingPresence(contactsList.value, [
          ...contactsList.value,
          ...additions
        ])

        if (firstPage) {
          firstPage = false
          isLoading.value = false
          logger.info(`[ContactStore] 首页联系人已渲染: ${contactsList.value.length} 个（后续页继续补齐）`)
        }
      }

      // 只有会话、不是好友的联系人：等分页结束再补，避免把「第 2 页的好友」先建成非好友条目
      const dmOnly = dmRoomInfos
        .map((dmRoom) => ({ dmRoom, partnerId: dmRoom.invitees[0] || dmRoom.inviter || '' }))
        .filter(({ partnerId }) => partnerId && !contactsList.value.some((c) => c.userId === partnerId))
        .map(({ dmRoom, partnerId }) => dmRoomToContact(dmRoom, partnerId, specialFriends))
      if (dmOnly.length > 0) {
        const kept = await filterGhostContacts(dmOnly)
        contactsList.value = mergeContactListPreservingPresence(contactsList.value, kept)
      }

      logger.info(`[ContactStore] 加载联系人成功: ${contactsList.value.length} 个`)
    } catch (err) {
      logger.error(`[ContactStore] 加载联系人失败: ${err}`)
      // 客户端未初始化是暂时状态；已有数据时静默降级（不把已渲染的列表打成错误态）
      if (String(err).includes('客户端未初始化') || contactsList.value.length > 0) return
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
        await matrixFriendOperations.removeFriend(userId)
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
      await matrixFriendOperations.setFriendNote(userId, note)
      const contact = contactsList.value.find((c) => c.userId === userId)
      if (contact) {
        // 只写 note：remark 是备注名，改笔记不该把它覆盖掉
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
      await matrixFriendOperations.setFriendDisplayName(userId, displayName)
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
      await matrixFriendOperations.setFriendStatus(userId, status)
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
    return contactsList.value.find((c) => c.userId === userId || c.userId === userId)
  }

  function updateContactPresence(
    userId: string,
    updates: Pick<MatrixContact, 'activeStatus' | 'lastOptTime'> &
      Partial<Pick<MatrixContact, 'presence' | 'statusMessage'>>
  ): boolean {
    const index = contactsList.value.findIndex((c) => c.userId === userId)
    if (index === -1) {
      return false
    }

    const current = contactsList.value[index]
    // 重复/心跳 presence 常携带与现值相同的字段：跳过写入与失效，
    // 否则一次无效事件会让好友列表整表克隆 + 重排 + 重渲染。
    const changed = Object.entries(updates).some(([key, value]) => Reflect.get(current, key) !== value)
    if (!changed) {
      return true
    }

    contactsList.value[index] = {
      ...current,
      ...updates
    }
    triggerRef(contactsList)
    return true
  }

  function isFriend(userId: string): Promise<boolean> {
    return matrixFriendService.isFriend(userId)
  }

  /**
   * 从 FriendSyncState 中的 friends 增量更新联系人列表，
   * 避免每次 sync 事件触发全量 HTTP 请求。
   */
  function updateContactsFromFriends(friends: Friend[]): void {
    const existingMap = new Map(contactsList.value.map((c) => [c.userId, c]))
    const updated: MatrixContact[] = []
    const seenIds = new Set<string>()

    for (const friend of friends) {
      const contact = friendToContact(friend)
      const existing = existingMap.get(friend.user_id)
      updated.push(existing ? mergeContactPreservingPresence(existing, contact) : contact)
      seenIds.add(friend.user_id)
    }

    // 保留 syncState 中不存在但本地已有的联系人（如非好友的 DM 对话）
    for (const [userId, contact] of existingMap) {
      if (!seenIds.has(userId)) {
        updated.push(contact)
      }
    }

    contactsList.value = updated
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
    updateContactsFromFriends,
    updateContactPresence,
    isFriend
  }
}
