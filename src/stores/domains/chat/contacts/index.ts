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
    list.loadContacts()
    requests.loadFriendRequests()
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
