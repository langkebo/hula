import { computed, ref, shallowRef, triggerRef } from 'vue'
import { type FriendRequest, matrixFriendService } from '@/services/matrix/friends/MatrixFriendService'
import { useGlobalStore } from '@/stores/domains/widget/global'
import { createLogger } from '@/utils/Logger'
import type { FriendRequestItem } from './types'

const logger = createLogger('ContactStore.Requests')

export type FriendRequestsContext = {
  ensureFriendServicesReady: () => Promise<void>
  loadContacts: () => Promise<void>
  startDirectRoom: (userId: string, encrypted?: boolean) => Promise<string | null>
  loadPendingInvites: () => Promise<void>
}

/**
 * 好友请求模块：收发请求、接受/拒绝/取消、未读数联动、申请分页兼容壳。
 */
export function createFriendRequests(ctx: FriendRequestsContext) {
  const { ensureFriendServicesReady, loadContacts, startDirectRoom, loadPendingInvites } = ctx
  const globalStore = useGlobalStore()

  const requestFriendsList = shallowRef<FriendRequestItem[]>([])
  const applyPageOptions = ref({ isLast: false, cursor: '', pageNo: 1 })
  /** 防止 acceptFriendRequest 被重复调用 */
  const pendingAccepts = new Set<string>()

  const incomingRequestsCount = computed(
    () => requestFriendsList.value.filter((r) => r.direction === 'incoming').length
  )

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
    // 防重入：同一用户同时只允许一个 accept 请求
    if (pendingAccepts.has(userId)) return false
    pendingAccepts.add(userId)
    try {
      await matrixFriendService.acceptFriendRequest(userId)
      requestFriendsList.value = requestFriendsList.value.filter(
        (r) => !(r.userId === userId && r.direction === 'incoming')
      )
      globalStore.decrementFriendUnreadCount()
      logger.info(`[ContactStore] 接受好友请求成功: ${userId}`)

      // 并行执行非关键操作：加载联系人 + 创建/打开 DM 房间
      void loadContacts()

      const roomId = await startDirectRoom(userId)
      if (roomId) {
        const { openMsgSessionByRoomId } = await import('@/composables/chat/openMsgSession')
        await openMsgSessionByRoomId(roomId)
      }

      return true
    } catch (err) {
      logger.error(`[ContactStore] 接受好友请求失败: ${err}`)
      return false
    } finally {
      pendingAccepts.delete(userId)
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

  /**
   * 从 FriendSyncState 的请求列表直接更新本地状态，
   * 避免每次 sync 事件触发全量 HTTP 请求。
   */
  function updateFromSyncState(incoming: FriendRequest[], outgoing: FriendRequest[]): void {
    requestFriendsList.value = [
      ...incoming.map((r) => ({
        userId: r.user_id,
        displayName: r.display_name,
        avatarUrl: r.avatar_url,
        message: r.message,
        timestamp: r.timestamp,
        direction: 'incoming' as const,
        applyId: r.user_id
      })),
      ...outgoing.map((r) => ({
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
  }

  return {
    requestFriendsList,
    applyPageOptions,
    incomingRequestsCount,
    handleRequestReceived,
    loadFriendRequests,
    sendFriendRequest,
    acceptFriendRequest,
    rejectFriendRequest,
    cancelFriendRequest,
    getApplyUnReadCount,
    getApplyPage,
    onHandleInvite,
    updateFromSyncState
  }
}
