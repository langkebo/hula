import type { UnlistenFn } from '@tauri-apps/api/event'
import { listen } from '@tauri-apps/api/event'
import { WebviewWindow } from '@tauri-apps/api/webviewWindow'

import { computed, watch } from 'vue'
import { useRouter } from 'vue-router'
import { CallTypeEnum, ChangeTypeEnum, MittEnum, OnlineEnum, RoomTypeEnum, WsResponseMessageType } from '@/enums'
import { useMitt } from '@/hooks/useMitt.ts'
import { useWindow } from '@/hooks/useWindow.ts'
import type { LoginSuccessResType, OnStatusChangeType, WsTokenExpire } from '@/services/legacy/wsEventTypes'
import type { PresenceInfo } from '@/services/matrix/user/MatrixPresenceService'
import type { MarkItemType, RevokedMsgType, UserItem } from '@/services/types.ts'
import { useChatStore } from '@/stores/domains/chat/chat'
import { useSessionStore } from '@/stores/domains/chat/chat/session'
import { useContactStore } from '@/stores/domains/chat/contacts'
import { useGroupStore } from '@/stores/domains/chat/group'
import type { MatrixRoomMember } from '@/stores/domains/chat/group/types.ts'
import { useSettingStore } from '@/stores/domains/settings/setting'
import { useUserStore } from '@/stores/domains/user/user'
import { useGlobalStore } from '@/stores/domains/widget/global'
import { hasTauriRuntime } from '@/utils/AppHarness'
import { createLogger } from '@/utils/Logger'
import { isMobile } from '@/utils/PlatformConstants'
import { buildPresenceStorePatch, collectTrackedPresenceUserIds } from '@/utils/presenceStatus'

const logger = createLogger('WsEventHandler')

interface ClientServiceDeps {
  getClient(): unknown
  waitForClientReady(opts?: { timeoutMs?: number; intervalMs?: number }): Promise<unknown>
}

interface PresenceServiceDeps {
  setPresence(presence: 'online' | 'offline' | 'unavailable', statusMsg?: string): Promise<void>
  onPresenceChange(handler: (info: PresenceInfo) => void): () => void
  subscribeToPresence(userIds: string[]): Promise<unknown>
  getBatchPresence(userIds: string[]): Promise<PresenceInfo[]>
}

type VideoCallRequestPayload = {
  callerUid: string
  isVideo: boolean
  [key: string]: unknown
}

type WebsocketConnectionStatePayload = {
  type?: string
  state?: string
  isReconnection?: boolean
  is_reconnection?: boolean
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

  let clientServiceCache: ClientServiceDeps | undefined
  const getMatrixClientService = async (): Promise<ClientServiceDeps> => {
    if (!clientServiceCache) {
      const { matrixClientService } = await import('@/services/matrix/MatrixClientService')
      clientServiceCache = matrixClientService as ClientServiceDeps
    }
    return clientServiceCache
  }

  let presenceServiceCache: PresenceServiceDeps | undefined
  const getMatrixPresenceService = async (): Promise<PresenceServiceDeps> => {
    if (!presenceServiceCache) {
      const { matrixPresenceService } = await import('@/services/matrix/user/MatrixPresenceService')
      presenceServiceCache = matrixPresenceService as PresenceServiceDeps
    }
    return presenceServiceCache
  }

  const subscribedPresenceUserIds = new Set<string>()
  let isPresenceSyncInFlight = false
  let hasPendingPresenceSync = false
  let unsubscribePresenceListener: (() => void) | null = null

  let lastWsConnectionState: string | null = null
  let isReconnectInFlight = false
  let wsEventUnlisten: UnlistenFn | null = null

  const applyPresenceToStores = async () => {
    const trackedUserIds = collectTrackedPresenceUserIds({
      currentUserId: userStore.userInfo?.uid,
      contacts: contactStore.contactsList,
      members: groupStore.allUserInfo
    })

    if (!trackedUserIds.length) {
      return
    }

    const clientService = await getMatrixClientService()
    if (!clientService.getClient()) {
      return
    }

    const presenceService = await getMatrixPresenceService()
    const nextSubscribedUserIds = trackedUserIds.filter((userId) => !subscribedPresenceUserIds.has(userId))
    if (nextSubscribedUserIds.length) {
      await presenceService.subscribeToPresence(nextSubscribedUserIds)
      nextSubscribedUserIds.forEach((userId) => subscribedPresenceUserIds.add(userId))
    }

    const presences = await presenceService.getBatchPresence(trackedUserIds)
    const now = Date.now()

    presences.forEach((presence) => {
      const patch = buildPresenceStorePatch(presence, now)
      contactStore.updateContactPresence(presence.user_id, patch)
      groupStore.updateUserPresence(presence.user_id, {
        activeStatus: patch.activeStatus,
        lastOptTime: patch.lastOptTime
      })
      if (userStore.userInfo && presence.user_id === userStore.userInfo.uid) {
        userStore.userInfo.activeStatus = patch.activeStatus
        userStore.userInfo.lastOptTime = patch.lastOptTime
      }
    })
  }

  const syncAvatarPresence = async () => {
    if (isPresenceSyncInFlight) {
      hasPendingPresenceSync = true
      return
    }

    isPresenceSyncInFlight = true
    try {
      await applyPresenceToStores()
    } catch (error) {
      logger.error('同步头像在线状态失败:', error)
    } finally {
      isPresenceSyncInFlight = false
      if (hasPendingPresenceSync) {
        hasPendingPresenceSync = false
        await syncAvatarPresence()
      }
    }
  }

  const refreshActiveGroupMembers = async () => {
    const tasks: Promise<unknown>[] = []
    try {
      const isCurrentGroup = globalStore.currentSession?.type === RoomTypeEnum.GROUP
      const activeRoomId =
        (isCurrentGroup && globalStore.currentSessionRoomId) ||
        chatStore.sessionList.find((item) => item.type === RoomTypeEnum.GROUP)?.roomId

      if (activeRoomId) {
        tasks.push(groupStore.getGroupUserList(activeRoomId, true))
      }
      await Promise.allSettled(tasks)
      await syncAvatarPresence()
    } catch (error) {
      logger.error('刷新群成员失败:', error)
    }
  }

  const handleWebsocketEvent = async (event: { payload: WebsocketConnectionStatePayload | null | undefined }) => {
    const payload = event.payload
    if (!payload || payload.type !== 'connectionStateChanged') return

    const previousState = (lastWsConnectionState || '').toUpperCase() || null
    const nextStateRaw = payload.state
    const nextState = typeof nextStateRaw === 'string' ? nextStateRaw.toUpperCase() : ''
    const isReconnectionFlag = payload.isReconnection ?? payload.is_reconnection
    const shouldHandleReconnect = nextState === 'CONNECTED' && isReconnectionFlag

    lastWsConnectionState = nextState || previousState

    if (!shouldHandleReconnect) return
    if (isReconnectInFlight || chatStore.syncLoading) return
    isReconnectInFlight = true

    chatStore.syncLoading = true
    try {
      await chatStore.getSessionList(true)
      await refreshActiveGroupMembers()
      if (globalStore.currentSessionRoomId) {
        const currentRoomId = globalStore.currentSessionRoomId
        const currentSession = chatStore.getSession(currentRoomId)
        await chatStore.fetchCurrentRoomRemoteOnce(20)
        if (currentSession?.unreadCount) {
          chatStore.markSessionRead(currentRoomId)
        }
      }
      globalStore.refreshUnreadBadge()
    } finally {
      chatStore.syncLoading = false
      isReconnectInFlight = false
    }
  }

  const handleVideoCall = async (remotedUid: string, callType: CallTypeEnum) => {
    logger.info(`监听到视频通话调用，remotedUid: ${remotedUid}, callType: ${callType}`)
    const currentSession = globalStore.currentSession
    const targetUid = remotedUid || currentSession?.detailId
    if (!targetUid) {
      logger.warn('当前会话尚未就绪或无法解析对端用户，忽略通话事件')
      return
    }
    if (isMobile()) {
      router.push({
        path: '/mobile/rtcCall',
        query: {
          remoteUserId: targetUid,
          roomId: globalStore.currentSessionRoomId,
          callType: callType,
          isIncoming: 'true'
        }
      })
    } else {
      await createRtcCallWindow(true, targetUid, globalStore.currentSessionRoomId, callType)
    }
  }

  const isSelfUser = (uid: string): boolean => {
    return uid === (userStore.userInfo?.uid ?? '')
  }

  const handleSelfRemove = async (roomId: string) => {
    logger.info('本人退出群聊，移除会话数据')
    sessionStore.removeSession(roomId)
    groupStore.removeAllUsers(roomId)
    if (globalStore.currentSessionRoomId === roomId) {
      globalStore.updateCurrentSessionRoomId(sessionStore.sessionList[0].roomId)
    }
  }

  const handleOtherMemberRemove = async (uid: string, roomId: string) => {
    logger.info('群成员退出群聊，移除群内的成员数据')
    groupStore.removeUserItem(uid, roomId)
  }

  const handleMemberRemove = async (userList: UserItem[], roomId: string) => {
    for (const user of userList) {
      if (isSelfUser(user.uid)) {
        await handleSelfRemove(roomId)
      } else {
        await handleOtherMemberRemove(user.uid, roomId)
      }
    }
  }

  const handleOtherMemberAdd = async (user: UserItem, roomId: string) => {
    logger.info('群成员加入群聊，添加群成员数据')
    const matrixMember: MatrixRoomMember = {
      ...user,
      userId: user.uid,
      displayName: user.name,
      avatarUrl: user.avatar,
      membership: 'join',
      powerLevel: 0,
      isModerator: false,
      isCreator: false,
      roleId: 2
    }
    groupStore.addUserItem(matrixMember, roomId)
  }

  const handleSelfAdd = async (roomId: string) => {
    logger.info('本人加入群聊，加载该群聊的会话数据')
    await sessionStore.addSession({
      roomId,
      name: roomId,
      type: RoomTypeEnum.SINGLE,
      unreadCount: 0,
      activeTime: Date.now()
    })
    try {
      await groupStore.getGroupUserList(roomId, true)
    } catch (error) {
      logger.error('初始化群成员失败:', error)
    }
  }

  const handleMemberAdd = async (userList: UserItem[], roomId: string) => {
    for (const user of userList) {
      if (isSelfUser(user.uid)) {
        await handleSelfAdd(roomId)
      } else {
        await handleOtherMemberAdd(user, roomId)
      }
    }
  }

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
      handleVideoCall(remoteUid, callType)
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
      try {
        const clientService = await getMatrixClientService()
        await clientService.waitForClientReady({ timeoutMs: 5000 })
        const presenceService = await getMatrixPresenceService()
        await presenceService.setPresence('online')
        logger.info('[Login] 在线状态已设置为 online')
        await syncAvatarPresence()
        if (!unsubscribePresenceListener) {
          unsubscribePresenceListener = presenceService.onPresenceChange((presence: PresenceInfo) => {
            const patch = buildPresenceStorePatch(presence)
            contactStore.updateContactPresence(presence.user_id, patch)
            groupStore.updateUserPresence(presence.user_id, {
              activeStatus: patch.activeStatus,
              lastOptTime: patch.lastOptTime
            })
            if (userStore.userInfo && presence.user_id === userStore.userInfo.uid) {
              userStore.userInfo.activeStatus = patch.activeStatus
              userStore.userInfo.lastOptTime = patch.lastOptTime
            }
          })
        }
      } catch (error) {
        logger.error('[Login] 设置在线状态失败:', error)
      }
      await refreshActiveGroupMembers()
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
          await handleMemberRemove(param.userList, param.roomId)
        } else {
          await handleMemberAdd(param.userList, param.roomId)
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
        const { useLoginFlow } = await import('@/hooks/useLoginFlow')
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

    if (hasTauriRuntime()) {
      listen('websocket-event', handleWebsocketEvent).then((unlisten) => {
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
        void syncAvatarPresence()
      },
      {
        immediate: true
      }
    )
  }

  const cleanup = () => {
    subscribedPresenceUserIds.clear()
    if (unsubscribePresenceListener) {
      unsubscribePresenceListener()
      unsubscribePresenceListener = null
    }
    if (wsEventUnlisten) {
      wsEventUnlisten()
      wsEventUnlisten = null
    }
  }

  return { registerHandlers, cleanup }
}
