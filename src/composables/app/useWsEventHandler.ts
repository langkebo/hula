import type { UnlistenFn } from '@tauri-apps/api/event'
import { listen } from '@tauri-apps/api/event'
import { WebviewWindow } from '@tauri-apps/api/webviewWindow'

import { computed, watch } from 'vue'
import { useRouter } from 'vue-router'
import { useExtensionEventBridge } from '@/composables/app/useExtensionEventBridge'
import { createCallHandler } from '@/composables/app/wsCallHandler'
import { createMemberHandler } from '@/composables/app/wsMemberHandler'
import { createPresenceHandler } from '@/composables/app/wsPresenceHandler'
import { useMitt } from '@/composables/common/useMitt'
import { useWindow } from '@/composables/common/useWindow'
import { CallTypeEnum, ChangeTypeEnum, MittEnum, OnlineEnum, WsResponseMessageType } from '@/enums'
import type { LoginSuccessResType, OnStatusChangeType, WsTokenExpire } from '@/services/legacy/wsEventTypes'
import type { MarkItemType, RevokedMsgType, UserItem } from '@/services/types.ts'
import { useChatStore } from '@/stores/domains/chat/chat'
import { useSessionStore } from '@/stores/domains/chat/chat/session'
import { useContactStore } from '@/stores/domains/chat/contacts'
import { useGroupStore } from '@/stores/domains/chat/group'
import { useSettingStore } from '@/stores/domains/settings/setting'
import { useUserStore } from '@/stores/domains/user/user'
import { useGlobalStore } from '@/stores/domains/widget/global'
import { hasTauriRuntime } from '@/utils/AppHarness'
import { createLogger } from '@/utils/Logger'
import { isMobile } from '@/utils/PlatformConstants'
import { collectTrackedPresenceUserIds } from '@/utils/presenceStatus'

const logger = createLogger('WsEventHandler')

type VideoCallRequestPayload = {
  callerUid: string
  isVideo: boolean
  [key: string]: unknown
}

export function useWsEventHandler() {
  const userStore = useUserStore()
  const contactStore = useContactStore()
  const groupStore = useGroupStore()
  const chatStore = useChatStore()
  const sessionStore = useSessionStore()
  const globalStore = useGlobalStore()
  const settingStore = useSettingStore()
  const router = useRouter()
  const { createRtcCallWindow, sendWindowPayload } = useWindow()

  const userUid = computed(() => userStore.userInfo?.uid ?? '')

  let wsEventUnlisten: UnlistenFn | null = null

  const presenceHandler = createPresenceHandler({ userStore, contactStore, groupStore, chatStore, globalStore })
  const memberHandler = createMemberHandler({ userStore, sessionStore, groupStore, globalStore })
  const callHandler = createCallHandler({
    globalStore,
    chatStore,
    router,
    createRtcCallWindow,
    refreshActiveGroupMembers: presenceHandler.refreshActiveGroupMembers
  })

  const registerHandlers = () => {
    useMitt.on<VideoCallRequestPayload>(WsResponseMessageType.VideoCallRequest, (event) => {
      logger.info(`收到通话请求：${JSON.stringify(event)}`)
      const remoteUid = event.callerUid
      const callType = event.isVideo ? CallTypeEnum.VIDEO : CallTypeEnum.AUDIO
      if (isMobile()) {
        useMitt.emit(MittEnum.MOBILE_RTC_CALL_REQUEST, {
          ...event,
          callerUid: remoteUid
        })
        return
      }
      callHandler.handleVideoCall(remoteUid, callType)
    })

    useMitt.on(WsResponseMessageType.LOGIN_SUCCESS, async (data: LoginSuccessResType) => {
      const { ...rest } = data
      groupStore.updateOnlineNum({ uid: rest.uid, isAdd: true })
      groupStore.updateUserItem(rest.uid, {
        activeStatus: OnlineEnum.ONLINE,
        avatar: rest.avatar,
        account: rest.account,
        lastOptTime: Date.now(),
        name: rest.name,
        uid: rest.uid
      })
      if (userStore.userInfo) {
        userStore.userInfo.activeStatus = OnlineEnum.ONLINE
        userStore.userInfo.lastOptTime = Date.now()
      }
      await presenceHandler.handleLoginPresence()
      await presenceHandler.refreshActiveGroupMembers()
    })

    useMitt.on(WsResponseMessageType.MSG_RECALL, (data: RevokedMsgType) => {
      chatStore.updateRecallMsg(data)
    })

    useMitt.on(WsResponseMessageType.MY_ROOM_INFO_CHANGE, (data: { myName: string; roomId: string; uid: string }) => {
      groupStore.updateUserItem(data.uid, { myName: data.myName }, data.roomId)
    })

    useMitt.on(
      WsResponseMessageType.REQUEST_NEW_FRIEND,
      async (data: { uid: number; unReadCount4Friend: number; unReadCount4Group: number }) => {
        logger.debug('收到好友申请')
        globalStore.setUnreadCounts({ friend: data.unReadCount4Friend || 0, group: data.unReadCount4Group || 0 })
        globalStore.refreshUnreadBadge()
        await contactStore.getApplyPage('friend', true)
      }
    )

    useMitt.on(WsResponseMessageType.NOTIFY_EVENT, async () => {
      await contactStore.getApplyUnReadCount()
      await Promise.allSettled([contactStore.getApplyPage('friend', true), contactStore.getApplyPage('group', true)])
    })

    useMitt.on(
      WsResponseMessageType.WS_MEMBER_CHANGE,
      async (param: {
        roomId: string
        changeType: ChangeTypeEnum
        userList: UserItem[]
        totalNum: number
        onlineNum: number
      }) => {
        logger.info('监听到群成员变更消息')
        const isRemoveAction =
          param.changeType === ChangeTypeEnum.REMOVE || param.changeType === ChangeTypeEnum.EXIT_GROUP
        if (isRemoveAction) {
          await memberHandler.handleMemberRemove(param.userList, param.roomId)
        } else {
          await memberHandler.handleMemberAdd(param.userList, param.roomId)
        }
        groupStore.addGroupDetail(param.roomId)
        groupStore.updateGroupNumber(param.roomId, param.totalNum)
      }
    )

    useMitt.on(WsResponseMessageType.MSG_MARK_ITEM, async (data: { markList: MarkItemType[] }) => {
      logger.debug('收到消息标记更新:', data)
      if (data?.markList && Array.isArray(data.markList)) {
        await chatStore.updateMarkCount(data.markList)
      } else if (data && !Array.isArray(data)) {
        await chatStore.updateMarkCount([data as unknown as MarkItemType])
      }
    })

    useMitt.on(WsResponseMessageType.REQUEST_APPROVAL_FRIEND, async () => {
      await contactStore.getContactList(true)
      await contactStore.getApplyUnReadCount()
      globalStore.refreshUnreadBadge()
    })

    useMitt.on(
      WsResponseMessageType.ROOM_INFO_CHANGE,
      async (data: { roomId: string; name: string; avatar: string }) => {
        const { roomId, name, avatar } = data
        sessionStore.updateSession(roomId, { name, avatar })
      }
    )

    useMitt.on(WsResponseMessageType.TOKEN_EXPIRED, async (wsTokenExpire: WsTokenExpire) => {
      if (
        Number(userUid.value) === Number(wsTokenExpire.uid) &&
        (userStore.userInfo?.client ?? '') === wsTokenExpire.client
      ) {
        const { useLoginFlow } = await import('@/shared/composables/useLoginFlow')
        const { logout } = useLoginFlow()
        if (isMobile()) {
          try {
            await logout()
            settingStore.toggleLogin(false, false)
            logger.info('账号在其他设备登录')
            const router = await import('@/router')
            await router.default.replace('/mobile/login')
            const { showDialog } = await import('vant')
            await import('vant/es/dialog/style')
            showDialog({
              title: '登录失效',
              message: '您的账号已在其他设备登录，请重新登录',
              confirmButtonText: '我知道了',
              showCancelButton: false,
              closeOnClickOverlay: false,
              closeOnPopstate: false,
              allowHtml: false
            })
          } catch (error) {
            logger.error('处理token过期失败：', error)
          }
        } else {
          const home = await WebviewWindow.getByLabel('home')
          await home?.setFocus()
          const remoteIp = wsTokenExpire.ip || '未知IP'
          await sendWindowPayload('login', { remoteLogin: { ip: remoteIp, timestamp: Date.now() } })
          await logout()
        }
      }
    })

    useMitt.on(WsResponseMessageType.INVALID_USER, (param: { uid: string }) => {
      logger.debug('无效用户')
      groupStore.removeUserItem(param.uid)
    })

    useMitt.on(WsResponseMessageType.ONLINE, async (onStatusChangeType: OnStatusChangeType) => {
      logger.debug('收到用户上线通知')
      if (onStatusChangeType.type === 1) {
        groupStore.updateOnlineNum({ roomId: onStatusChangeType.roomId, isAdd: true })
        groupStore.updateUserItem(
          onStatusChangeType.uid,
          { activeStatus: OnlineEnum.ONLINE, lastOptTime: onStatusChangeType.lastOptTime },
          onStatusChangeType.roomId
        )
      }
    })

    useMitt.on(WsResponseMessageType.ROOM_DISSOLUTION, async (roomId: string) => {
      logger.debug('收到群解散通知', roomId)
      sessionStore.removeSession(roomId)
      groupStore.removeGroupDetail(roomId)
      if (globalStore.currentSessionRoomId === roomId) {
        globalStore.updateCurrentSessionRoomId(sessionStore.sessionList[0].roomId)
      }
    })

    useMitt.on(WsResponseMessageType.USER_STATE_CHANGE, async (data: { uid: string; userStateId: string }) => {
      logger.debug('收到用户状态改变', data)
      groupStore.updateUserItem(data.uid, { userStateId: data.userStateId })
    })

    useMitt.on<{ roomId: string; uids: string[]; status: number | boolean }>(
      WsResponseMessageType.GROUP_SET_ADMIN_SUCCESS,
      (event) => {
        logger.debug('设置群管理员---> ', event)
        groupStore.updateAdminStatus(event.roomId, event.uids, Boolean(event.status))
      }
    )

    useMitt.on(WsResponseMessageType.OFFLINE, async (onStatusChangeType: OnStatusChangeType) => {
      logger.debug('收到用户下线通知', onStatusChangeType)
      if (onStatusChangeType.type === 1) {
        groupStore.updateOnlineNum({ roomId: onStatusChangeType.roomId, isAdd: false })
        groupStore.updateUserItem(
          onStatusChangeType.uid,
          { activeStatus: OnlineEnum.OFFLINE, lastOptTime: onStatusChangeType.lastOptTime },
          onStatusChangeType.roomId
        )
      }
    })

    // ===== Manager 事件 → store 联动 =====
    // 注意：好友相关事件已由 MatrixFriendSync 通过 MatrixFriendService 事件通道
    // 直接更新 contact store，此处仅补充 badge 刷新，避免重复全量重载导致请求风暴。
    useMitt.on(MittEnum.FRIEND_REQUEST_RECEIVED, async () => {
      logger.debug('[ManagerEvent] 收到好友请求')
      globalStore.refreshUnreadBadge()
    })

    useMitt.on(MittEnum.FRIEND_REQUEST_ACCEPTED, async () => {
      logger.debug('[ManagerEvent] 好友请求被接受')
      globalStore.refreshUnreadBadge()
    })

    useMitt.on(MittEnum.FRIEND_REMOVED, async () => {
      logger.debug('[ManagerEvent] 好友被移除')
      await contactStore.getContactList(true)
    })

    useMitt.on<{ eventId: string; burnedAt: number }>(MittEnum.BURN_MESSAGE_BURNED, (payload) => {
      logger.debug('[ManagerEvent] 阅后即焚消息已焚毁', payload)
      if (payload?.eventId) {
        chatStore.deleteMsg(payload.eventId)
      }
    })

    // T6: 接收方阅读 burn 消息后，后端发射 MessageRead 事件给所有房间成员。
    // 发送方收到此事件后启动倒计时（发送方自身不调 markBurnRead）。
    useMitt.on<{ eventId: string; readAt: number }>(MittEnum.BURN_MESSAGE_READ, (payload) => {
      logger.debug('[ManagerEvent] 阅后即焚消息已被对方阅读', payload)
      if (payload?.eventId) {
        chatStore.updateMsg({ msgId: payload.eventId, isBurning: true })
      }
    })

    useMitt.on(MittEnum.WIDGET_CREATED, (widget: unknown) => {
      logger.info('[ManagerEvent] Widget 已创建', widget)
    })
    useMitt.on(MittEnum.WIDGET_UPDATED, (widget: unknown) => {
      logger.info('[ManagerEvent] Widget 已更新', widget)
    })
    useMitt.on(MittEnum.WIDGET_DELETED, (widgetId: unknown) => {
      logger.info('[ManagerEvent] Widget 已删除', widgetId)
    })

    if (hasTauriRuntime()) {
      listen('websocket-event', callHandler.handleWebsocketEvent).then((unlisten) => {
        wsEventUnlisten = unlisten
      })
    }

    watch(
      () =>
        collectTrackedPresenceUserIds({
          currentUserId: userStore.userInfo?.uid,
          contacts: contactStore.contactsList,
          members: groupStore.allUserInfo
        }).join('|'),
      () => {
        void presenceHandler.syncAvatarPresence()
      },
      {
        immediate: true
      }
    )
  }

  const cleanup = () => {
    presenceHandler.cleanup()
    if (wsEventUnlisten) {
      wsEventUnlisten()
      wsEventUnlisten = null
    }
  }

  return { registerHandlers, cleanup }
}

/**
 * 订阅 Matrix SDK Manager 事件（Friend / BurnAfterRead / Widget）并桥接到 mitt。
 *
 * 通过 `useExtensionEventBridge` 将三个 Manager 的 SDK 事件转发为 mitt 事件，
 * 供 `registerHandlers` 中的 store 联动监听器消费。
 *
 * @returns 取消订阅函数，调用后清理所有 Manager 事件订阅
 */
export async function subscribeManagerEvents(): Promise<() => void> {
  const { matrixClientService } = await import('@/services/matrix/MatrixClientService')
  await matrixClientService.waitForClientReady({ timeoutMs: 5000 })
  const client = matrixClientService.getClient()
  if (!client) {
    logger.warn('[subscribeManagerEvents] Matrix 客户端未就绪，跳过 Manager 事件订阅')
    return () => {}
  }

  const { cleanup } = useExtensionEventBridge(client as Parameters<typeof useExtensionEventBridge>[0])
  logger.info('[subscribeManagerEvents] Manager 事件订阅已注册（Friend / BurnAfterRead / Widget）')
  return cleanup
}
