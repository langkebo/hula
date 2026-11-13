import { computed, ref, type ShallowRef, shallowRef, triggerRef } from 'vue'
import { getFriendReadError } from '@/services/matrix/friends/friendEvents'
import {
  type FriendRequest,
  matrixFriendOperations,
  matrixFriendService
} from '@/services/matrix/friends/MatrixFriendService'
import { matrixClientService } from '@/services/matrix/MatrixClientService'
import { matrixRoomActionFacade } from '@/services/matrix/room/RoomFacade'
import { NoticeType, RequestNoticeAgreeStatus } from '@/services/types'
import { useGlobalStore } from '@/stores/domains/widget/global'
import { createLogger } from '@/utils/Logger'
import type { ContactInvite, FriendRequestItem } from './types'

const logger = createLogger('ContactStore.Requests')

/** 通知模型里的 `type`：1=群聊，2=加好友（`MobileApplyList`/`ApplyList` 按它分 Tab） */
const FRIEND_APPLY_TYPE = 2
const GROUP_APPLY_TYPE = 1

type FriendRequestsContext = {
  ensureFriendServicesReady: () => Promise<void>
  loadContacts: () => Promise<void>
  startDirectRoom: (userId: string, encrypted?: boolean) => Promise<string | null>
  loadPendingInvites: () => Promise<void>
  pendingInvites: ShallowRef<ContactInvite[]>
}

/**
 * 好友请求模块：收发请求、接受/拒绝/取消、未读数联动、申请分页兼容壳。
 */
export function createFriendRequests(ctx: FriendRequestsContext) {
  const { ensureFriendServicesReady, loadContacts, startDirectRoom, loadPendingInvites, pendingInvites } = ctx
  const globalStore = useGlobalStore()

  const requestFriendsList = shallowRef<FriendRequestItem[]>([])
  const applyPageOptions = ref({ isLast: false, cursor: '', pageNo: 1 })
  /** 最近一次加载好友申请的失败原因；`null` 表示成功（供 UI 区分「没有申请」与「加载失败」） */
  const requestLoadError = ref<unknown>(null)
  /** 防止 acceptFriendRequest 被重复调用 */
  const pendingAccepts = new Set<string>()

  const incomingRequestsCount = computed(
    () => requestFriendsList.value.filter((r) => r.direction === 'incoming' && r.type !== GROUP_APPLY_TYPE).length
  )

  /**
   * 好友请求 → 申请列表条目。
   *
   * 列表消费方（`MobileApplyList` / `ApplyList`）依赖 `type` 分 Tab、依赖
   * `eventType`/`senderId`/`operateId` 取资料与判断“是否本人”，缺任一项都会
   * 渲染成空列表或空资料。
   */
  function mapFriendRequest(
    request: FriendRequest,
    direction: 'incoming' | 'outgoing',
    currentUserId: string
  ): FriendRequestItem {
    return {
      userId: request.user_id,
      displayName: request.display_name,
      avatarUrl: request.avatar_url,
      message: request.message,
      timestamp: request.timestamp,
      direction,
      applyId: request.user_id,
      type: FRIEND_APPLY_TYPE,
      status: RequestNoticeAgreeStatus.UNTREATED,
      content: request.message ?? '',
      // incoming=别人加我（ADD_ME，sender 为申请人）；outgoing=我加别人（FRIEND_APPLY，
      // sender 必须是本人，否则 UI 会把自己发出的申请误判成待处理并渲染同意/拒绝按钮）
      eventType: direction === 'incoming' ? NoticeType.ADD_ME : NoticeType.FRIEND_APPLY,
      senderId: direction === 'incoming' ? request.user_id : currentUserId,
      operateId: request.user_id
    }
  }

  /** 群邀请（SDK invite 状态房间）→ 申请列表条目 */
  function mapGroupInvite(invite: ContactInvite): FriendRequestItem {
    return {
      userId: invite.fromUserId,
      displayName: invite.fromDisplayName ?? undefined,
      message: '',
      timestamp: invite.timestamp,
      direction: 'incoming',
      applyId: invite.roomId,
      roomId: invite.roomId,
      type: GROUP_APPLY_TYPE,
      status: RequestNoticeAgreeStatus.UNTREATED,
      content: '',
      eventType: NoticeType.GROUP_INVITE_ME,
      senderId: invite.fromUserId,
      operateId: invite.fromUserId
    }
  }

  function handleRequestReceived(request: FriendRequest): void {
    const existing = requestFriendsList.value.find((r) => r.userId === request.user_id)
    if (existing) return
    requestFriendsList.value.push(
      mapFriendRequest(request, request.direction ?? 'incoming', matrixClientService.getUserId() ?? '')
    )
    triggerRef(requestFriendsList)
    globalStore.incrementFriendUnreadCount()
  }

  async function loadFriendRequests(): Promise<void> {
    try {
      await ensureFriendServicesReady()
      const incoming = await matrixFriendService.getIncomingRequests()
      const outgoing = await matrixFriendService.getOutgoingRequests()
      const currentUserId = matrixClientService.getUserId() ?? ''

      requestFriendsList.value = [
        ...incoming.map((r: FriendRequest) => mapFriendRequest(r, 'incoming', currentUserId)),
        ...outgoing.map((r: FriendRequest) => mapFriendRequest(r, 'outgoing', currentUserId)),
        // 群邀请没有独立通知接口，直接复用 SDK 的 invite 房间列表
        ...pendingInvites.value.map(mapGroupInvite)
      ]

      requestLoadError.value = null
      globalStore.setFriendUnreadCount(incoming.length)
      logger.info(`[ContactStore] 加载好友请求成功: ${requestFriendsList.value.length} 个`)
    } catch (err) {
      // 失败时**不动现有列表、不清零红点**：保持上次成功的结果，由 UI 显示错误态 + 重试。
      // 服务层已把原因记进 'requests' 通道；此处回落到原始异常以便直接展示。
      requestLoadError.value = getFriendReadError('requests') ?? err
      logger.error(`[ContactStore] 加载好友请求失败: ${err}`)
    }
  }

  async function sendFriendRequest(userId: string, message?: string): Promise<boolean> {
    try {
      await matrixFriendOperations.sendFriendRequest(userId, message)
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
      await matrixFriendOperations.acceptFriendRequest(userId)
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
      await matrixFriendOperations.rejectFriendRequest(userId)
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
      await matrixFriendOperations.cancelFriendRequest(userId)
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

  async function getApplyPage(applyType: string, _isFresh = false, _click = false): Promise<void> {
    // 群 Tab 的数据来自 SDK invite 房间，先刷新邀请再重建列表
    if (applyType === 'group') {
      await loadPendingInvites()
    }
    await loadFriendRequests()
  }

  /** 就地更新条目状态（无服务端接口的「忽略」与群邀请处理后的 UI 反馈） */
  function markRequestStatus(applyId: string, status: RequestNoticeAgreeStatus): void {
    const target = requestFriendsList.value.find((r) => r.applyId === applyId)
    if (!target) return
    target.status = status
    triggerRef(requestFriendsList)
  }

  function removeRequest(applyId: string): void {
    requestFriendsList.value = requestFriendsList.value.filter((r) => r.applyId !== applyId)
  }

  async function handleGroupInvite(apply: FriendRequestItem): Promise<void> {
    const roomId = apply.roomId ?? apply.applyId
    if (!roomId) return

    if (apply.state === RequestNoticeAgreeStatus.REJECTED) {
      const ok = await matrixRoomActionFacade
        .leaveRoom(roomId)
        .then(() => true)
        .catch((err) => {
          logger.error(`[ContactStore] 拒绝群邀请失败: ${roomId} ${err}`)
          return false
        })
      if (ok) {
        removeRequest(apply.applyId)
        void loadPendingInvites()
      }
      return
    }

    if (apply.state === RequestNoticeAgreeStatus.IGNORE) {
      // 忽略仅是本地标记，不改变服务端邀请状态
      markRequestStatus(apply.applyId, RequestNoticeAgreeStatus.IGNORE)
      return
    }

    try {
      await matrixRoomActionFacade.joinRoom(roomId)
      removeRequest(apply.applyId)
      void loadPendingInvites()
      const { openMsgSessionByRoomId } = await import('@/composables/chat/openMsgSession')
      await openMsgSessionByRoomId(roomId)
    } catch (err) {
      logger.error(`[ContactStore] 接受群邀请失败: ${roomId} ${err}`)
    }
  }

  async function onHandleInvite(apply: FriendRequestItem): Promise<void> {
    if (apply.applyType === 'group' || apply.type === GROUP_APPLY_TYPE) {
      await handleGroupInvite(apply)
      return
    }

    if (apply.direction !== 'incoming' || !apply.userId) return

    // 按调用方传入的处理动作分流：拒绝/忽略绝不能落到同意分支
    if (apply.state === RequestNoticeAgreeStatus.REJECTED) {
      await rejectFriendRequest(apply.userId)
      return
    }
    if (apply.state === RequestNoticeAgreeStatus.IGNORE) {
      markRequestStatus(apply.applyId, RequestNoticeAgreeStatus.IGNORE)
      return
    }
    await acceptFriendRequest(apply.userId)
  }

  /**
   * 从 FriendSyncState 的请求列表直接更新本地状态，
   * 避免每次 sync 事件触发全量 HTTP 请求。
   */
  function updateFromSyncState(incoming: FriendRequest[], outgoing: FriendRequest[]): void {
    const currentUserId = matrixClientService.getUserId() ?? ''
    requestFriendsList.value = [
      ...incoming.map((r) => mapFriendRequest(r, 'incoming', currentUserId)),
      ...outgoing.map((r) => mapFriendRequest(r, 'outgoing', currentUserId)),
      ...pendingInvites.value.map(mapGroupInvite)
    ]
    globalStore.setFriendUnreadCount(incoming.length)
  }

  return {
    requestFriendsList,
    requestLoadError,
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
