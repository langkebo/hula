import { defineStore } from 'pinia'
import { ref } from 'vue'
import { StoresEnum } from '@/enums'
import { type FriendServiceEventHandler, matrixFriendService } from '@/services/matrix/friends/MatrixFriendService'
import { matrixDirectMessageService } from '@/services/matrix/room/MatrixDirectMessageService'
import { createLogger } from '@/utils/Logger'
import { createContactDm } from './dm'
import { createContactInvites } from './invites'
import { createContactsList } from './list'
import { createFriendRequests } from './requests'

// 类型唯一真源在 ./types，此处 re-export 保持既有消费方兼容
export type { ContactInvite, FriendRequestItem, MatrixContact } from './types'

const logger = createLogger('contacts')

/**
 * 联系人域 Store（装配层）
 *
 * 模块拆分（原 contacts.ts 700+ 行）：
 * - list.ts     好友列表加载/缓存/事件处理、备注/状态变更、presence 更新
 * - requests.ts 好友请求收发与接受/拒绝/取消、未读数联动
 * - dm.ts       私聊房间创建/复用、用户资料
 * - invites.ts  群邀请扫描与群未读数
 * - types.ts    MatrixContact / ContactInvite / FriendRequestItem 类型唯一真源
 *
 * 本层负责：好友服务生命周期（ensureFriendServicesReady/initialize/cleanup）、
 * 事件注册，以及各模块的统一出口（对外签名与拆分前完全一致）。
 */
export const useContactStore = defineStore(StoresEnum.CONTACTS, () => {
  const isServicesReady = ref(false)

  // 前向声明：模块在下方创建，事件注册在运行时才读取，闭包无 TDZ 问题
  async function ensureFriendServicesReady(): Promise<void> {
    if (isServicesReady.value) {
      return
    }

    await matrixFriendService.initialize()
    await matrixDirectMessageService.initialize()

    matrixFriendService.on('sync', handleFriendSync as FriendServiceEventHandler)
    matrixFriendService.on('friendAdded', list.handleFriendAdded as FriendServiceEventHandler)
    matrixFriendService.on('friendRemoved', list.handleFriendRemoved as FriendServiceEventHandler)
    matrixFriendService.on('friendUpdated', list.handleFriendUpdated as FriendServiceEventHandler)
    matrixFriendService.on('requestReceived', requests.handleRequestReceived as FriendServiceEventHandler)

    isServicesReady.value = true
  }

  function handleFriendSync(): void {
    // 从缓存的 syncState 直接更新 store，避免额外 HTTP 请求。
    // updateSyncState() 已在 MatrixFriendSync 的事件回调中执行，
    // 此处只需读取最新状态并反映到本地数据。
    const syncState = matrixFriendService.getSyncStateValue()
    list.updateContactsFromFriends(syncState.friends)
    requests.updateFromSyncState(syncState.incomingRequests, syncState.outgoingRequests)
  }

  const list = createContactsList({ ensureFriendServicesReady })
  const dm = createContactDm({ contactsList: list.contactsList })
  const invites = createContactInvites()
  const requests = createFriendRequests({
    ensureFriendServicesReady,
    loadContacts: list.loadContacts,
    startDirectRoom: dm.startDirectRoom,
    loadPendingInvites: invites.loadPendingInvites
  })

  async function initialize(): Promise<void> {
    try {
      await ensureFriendServicesReady()
      await list.loadContacts()
      await requests.loadFriendRequests()
      // 异步清理无效联系人，不阻塞初始化
      cleanupInvalidContacts().catch((err) => {
        logger.warn(`[ContactStore] 清理无效联系人失败: ${err}`)
      })
      logger.info('[ContactStore] 初始化完成')
    } catch (err) {
      logger.error(`[ContactStore] 初始化失败: ${err}`)
      list.setFriendListError('initialize', err, '好友列表初始化失败')
    }
  }

  function clearContacts(): void {
    list.contactsList.value = []
    invites.pendingInvites.value = []
    requests.requestFriendsList.value = []
    list.lastFriendError.value = null
  }

  function cleanup(): void {
    matrixFriendService.stop()
    matrixDirectMessageService.stop()
    isServicesReady.value = false
    clearContacts()
  }

  /**
   * 清理无效联系人（不存在的用户）
   * 在后台异步执行，不阻塞主流程
   */
  async function cleanupInvalidContacts(): Promise<void> {
    const contacts = list.contactsList.value
    if (contacts.length === 0) return

    const invalidIds: string[] = []

    // 批量验证用户是否存在（限制并发数避免过多请求）
    const batchSize = 5
    for (let i = 0; i < contacts.length; i += batchSize) {
      const batch = contacts.slice(i, i + batchSize)
      const results = await Promise.allSettled(
        batch.map(async (contact) => {
          try {
            // 使用 presence 服务验证用户是否存在
            const presence = await import('@/services/matrix/user/MatrixPresenceService').then((m) =>
              m.matrixPresenceService.getPresence(contact.userId)
            )
            // 用户不存在（M_NOT_FOUND）时返回其 userId 以清理
            if (presence.notFound) {
              return contact.userId
            }
          } catch {
            // 获取 presence 失败时，保守认为用户存在
          }
          return null
        })
      )

      results.forEach((result) => {
        if (result.status === 'fulfilled' && result.value) {
          invalidIds.push(result.value)
        }
      })
    }

    if (invalidIds.length > 0) {
      logger.info(`[ContactStore] 清理 ${invalidIds.length} 个无效联系人`)
      list.contactsList.value = contacts.filter((c) => !invalidIds.includes(c.userId))
    }
  }

  return {
    // state
    contactsList: list.contactsList,
    pendingInvites: invites.pendingInvites,
    isLoading: list.isLoading,
    lastFriendError: list.lastFriendError,
    contactsOptions: list.contactsOptions,
    requestFriendsList: requests.requestFriendsList,
    applyPageOptions: requests.applyPageOptions,
    friendFilter: list.friendFilter,
    // getters
    filteredContacts: list.filteredContacts,
    favoriteContacts: list.favoriteContacts,
    blockedContacts: list.blockedContacts,
    incomingRequestsCount: requests.incomingRequestsCount,
    // 生命周期
    initialize,
    cleanup,
    clearContacts,
    // list 模块
    loadContacts: list.loadContacts,
    getContactList: list.getContactList,
    removeFromContacts: list.removeFromContacts,
    onDeleteFriend: list.onDeleteFriend,
    setFriendNote: list.setFriendNote,
    setFriendDisplayName: list.setFriendDisplayName,
    setFriendStatus: list.setFriendStatus,
    getContactByUserId: list.getContactByUserId,
    updateContactPresence: list.updateContactPresence,
    isFriend: list.isFriend,
    // requests 模块
    loadFriendRequests: requests.loadFriendRequests,
    sendFriendRequest: requests.sendFriendRequest,
    acceptFriendRequest: requests.acceptFriendRequest,
    rejectFriendRequest: requests.rejectFriendRequest,
    cancelFriendRequest: requests.cancelFriendRequest,
    getApplyUnReadCount: requests.getApplyUnReadCount,
    getApplyPage: requests.getApplyPage,
    onHandleInvite: requests.onHandleInvite,
    // dm 模块
    getUserProfile: dm.getUserProfile,
    startDirectRoom: dm.startDirectRoom,
    // invites 模块
    loadPendingInvites: invites.loadPendingInvites
  }
})
