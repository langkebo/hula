<template>
  <div class="h-100vh w-100vw">
    <NaiveProvider :message-max="3" :notific-max="3" class="h-full">
      <ConnectionStatusBanner
        :state="connectionState"
        :retry-count="connectionRetryCount"
        @retry="handleConnectionRetry" />
      <SplashScreen
        v-if="showSplash"
        :visible="showSplash"
        :percentage="bootstrapProgress"
        :loading-text="bootstrapMessage"
        :show-error="!!bootstrapError"
        :error-message="bootstrapError || undefined"
        :retryable="true"
        @retry="handleBootstrapRetry" />
      <div v-else-if="!isLock" class="h-full">
        <router-view />
      </div>
      <LockScreen v-else />
    </NaiveProvider>
    <MemoryMonitor v-if="isDev && showMemoryMonitor && isHomeDesktopWindow" />
  </div>
  <component :is="mobileRtcCallFloatCell" v-if="mobileRtcCallFloatCell" />
</template>
<script setup lang="ts">
import { WebviewWindow } from '@tauri-apps/api/webviewWindow'
import { info } from '@tauri-apps/plugin-log'
import { exit } from '@tauri-apps/plugin-process'
import ConnectionStatusBanner from '@/components/common/ConnectionStatusBanner.vue'
import { useConnectionStatus } from '@/composables/useConnectionStatus'
import { CallTypeEnum, ChangeTypeEnum, EventEnum, MittEnum, OnlineEnum, RoomTypeEnum, ThemeEnum } from '@/enums'
import { useGlobalShortcut } from '@/hooks/useGlobalShortcut.ts'
import { useMitt } from '@/hooks/useMitt.ts'
import { useNetworkStatus } from '@/hooks/useNetworkStatus'
import { useWindow } from '@/hooks/useWindow.ts'
import { loadLanguage } from '@/services/i18n'
import { matrixClientService } from '@/services/matrix/MatrixClientService'
import type { SendMessagePayload } from '@/services/matrix/messaging/MatrixMessageService'
import { matrixMessageService } from '@/services/matrix/messaging/MatrixMessageService'
import { matrixReactionService } from '@/services/matrix/messaging/MatrixReactionService'
import { matrixReceiptService } from '@/services/matrix/messaging/MatrixReceiptService'
import { matrixRoomCreationService } from '@/services/matrix/room/CreationService'
import { matrixRoomDirectMessageService } from '@/services/matrix/room/DirectMessageService'
import { matrixRoomService } from '@/services/matrix/room/MatrixRoomService'
import { matrixRoomPinsService } from '@/services/matrix/room/PinsService'
import { matrixRoomStateService } from '@/services/matrix/room/StateService'
import { matrixRoomTagsService } from '@/services/matrix/room/TagsService'
import { matrixPresenceService } from '@/services/matrix/user/MatrixPresenceService'
import { offlineQueueService } from '@/services/offline/OfflineQueueService'
import { useSettingStore } from '@/stores/domains/settings/setting'
import { useGlobalStore } from '@/stores/domains/widget/global'
import { hasTauriRuntime } from '@/utils/AppHarness'
import { isDesktop, isIOS, isMobile, isWindows10 } from '@/utils/PlatformConstants'
import { buildPresenceStorePatch, collectTrackedPresenceUserIds } from '@/utils/presenceStatus'

const LockScreen = defineAsyncComponent(() => import('@/views/LockScreen.vue'))
const MemoryMonitor = defineAsyncComponent(() => import('@/components/common/MemoryMonitor.vue'))

import { listen } from '@tauri-apps/api/event'
import { useI18n } from 'vue-i18n'
import SplashScreen from '@/components/common/SplashScreen.vue'
import { useBootstrap } from '@/composables/useBootstrap'
import { useTauriListener } from '@/hooks/useTauriListener'
import { updateSettings } from '@/services/tauriCommand.ts'
import type { MarkItemType, RevokedMsgType, UserItem } from '@/services/types.ts'
import {
  type LoginSuccessResType,
  type OnStatusChangeType,
  WsResponseMessageType,
  type WsTokenExpire
} from '@/services/wsType.ts'
import { useAnnouncementStore } from '@/stores/domains/chat/announcement'
import { useChatStore } from '@/stores/domains/chat/chat'
import { useContactStore } from '@/stores/domains/chat/contacts'
import { useGroupStore } from '@/stores/domains/chat/group'
import type { MatrixRoomMember } from '@/stores/domains/chat/group/types.ts'
import { useUserStore } from '@/stores/domains/user/user'
import { createLogger } from '@/utils/Logger'
import { unreadCountManager } from '@/utils/UnreadCountManager'

const logger = createLogger('App')
const mobileRtcCallFloatCell = isMobile()
  ? defineAsyncComponent(() => import('@/mobile/components/RtcCallFloatCell.vue'))
  : null

const isDev = import.meta.env.DEV
const tauriRuntimeAvailable = hasTauriRuntime()
const showMemoryMonitor = ref(true)
const isHomeDesktopWindow = computed(() => isDesktop() && appWindow?.label === 'home')

const {
  state: bootstrapState,
  loadingMessage: bootstrapMessage,
  loadingProgress: bootstrapProgress,
  error: bootstrapError,
  bootstrap
} = useBootstrap()

const { state: connectionState, retryCount: connectionRetryCount, retry: handleConnectionRetry } = useConnectionStatus()

const showSplash = computed(() => bootstrapState.value === 'initializing' || bootstrapState.value === 'idle')

const handleBootstrapRetry = async () => {
  await bootstrap()
}

const userStore = useUserStore()
const contactStore = useContactStore()
const announcementStore = useAnnouncementStore()
const userUid = computed(() => userStore.userInfo!.uid)
const groupStore = useGroupStore()
const chatStore = useChatStore()
const appWindow = tauriRuntimeAvailable ? WebviewWindow.getCurrent() : null
const { createRtcCallWindow, sendWindowPayload, ensureCheckUpdateWindow } = useWindow()
const globalStore = useGlobalStore()
const router = useRouter()
const { addListener } = useTauriListener()
const subscribedPresenceUserIds = new Set<string>()
let isPresenceSyncInFlight = false
let hasPendingPresenceSync = false
let unsubscribePresenceListener: (() => void) | null = null
// 只在桌面端初始化窗口管理功能
const { createWebviewWindow } = isDesktop() ? useWindow() : { createWebviewWindow: () => {} }
const settingStore = useSettingStore()
const { lockScreen } = storeToRefs(settingStore)
// 全局快捷键管理
const { initializeGlobalShortcut, cleanupGlobalShortcut } = useGlobalShortcut()
// 提前初始化网络状态监听，确保不错过 WebSocket 状态变化事件
if (isDesktop()) {
  useNetworkStatus()
}

/** 不需要锁屏的页面 */
const LockExclusion = new Set(['/login', '/tray', '/qrCode', '/about', '/onlineStatus', '/capture'])
const isLock = computed(() => {
  return !LockExclusion.has(router.currentRoute.value.path) && lockScreen.value.enable
})

/** 禁止图片以及输入框的拖拽 */
const preventDrag = (e: MouseEvent) => {
  const event = e.target as HTMLElement
  // 检查目标元素是否是<img>元素
  if (event.nodeName.toLowerCase() === 'img' || event.nodeName.toLowerCase() === 'input') {
    e.preventDefault()
  }
}
const preventGlobalContextMenu = (event: MouseEvent) => event.preventDefault()
const handleGlobalKeydown = (e: KeyboardEvent) => {
  if (e.ctrlKey && (e.key === 'f' || e.key === 'r' || e.key === 'g' || e.key === 'j')) {
    e.preventDefault()
  }
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

useMitt.on<VideoCallRequestPayload>(WsResponseMessageType.VideoCallRequest, (event) => {
  info(`收到通话请求：${JSON.stringify(event)}`)
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
  // 自己更新自己上线
  groupStore.updateOnlineNum({
    uid: rest.uid,
    isAdd: true
  })
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

  // 设置在线状态到服务器
  try {
    await matrixClientService.waitForClientReady({
      timeoutMs: 5000
    })
    await matrixPresenceService.setPresence('online')
    logger.info('[Login] 在线状态已设置为 online')

    // 立即同步在线状态，确保显示更新
    await syncAvatarPresence()

    // 注册实时 presence 事件监听，替代轮询
    if (!unsubscribePresenceListener) {
      unsubscribePresenceListener = matrixPresenceService.onPresenceChange((presence) => {
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

  // 刚登录成功时同步当前/首个群聊的成员信息，避免消息显示”未知用户”
  await refreshActiveGroupMembers()
})

useMitt.on(WsResponseMessageType.MSG_RECALL, (data: RevokedMsgType) => {
  chatStore.updateRecallMsg(data)
})

useMitt.on(WsResponseMessageType.MY_ROOM_INFO_CHANGE, (data: { myName: string; roomId: string; uid: string }) => {
  // 更新用户在群聊中的昵称
  groupStore.updateUserItem(data.uid, { myName: data.myName }, data.roomId)
})

useMitt.on(
  WsResponseMessageType.REQUEST_NEW_FRIEND,
  async (data: { uid: number; unReadCount4Friend: number; unReadCount4Group: number }) => {
    logger.debug('收到好友申请')
    // 更新未读数
    globalStore.setUnreadCounts({
      friend: data.unReadCount4Friend || 0,
      group: data.unReadCount4Group || 0
    })
    globalStore.refreshUnreadBadge()

    // 刷新好友申请列表
    await contactStore.getApplyPage('friend', true)
  }
)

useMitt.on(WsResponseMessageType.NOTIFY_EVENT, async () => {
  await contactStore.getApplyUnReadCount()
  await Promise.allSettled([contactStore.getApplyPage('friend', true), contactStore.getApplyPage('group', true)])
})

// 处理自己被移除
const handleSelfRemove = async (roomId: string) => {
  info('本人退出群聊，移除会话数据')

  // 移除会话和群成员数据
  chatStore.removeSession(roomId)
  groupStore.removeAllUsers(roomId)

  // 如果当前会话就是被移除的群聊，切换到其他会话
  if (globalStore.currentSessionRoomId === roomId) {
    globalStore.updateCurrentSessionRoomId(chatStore.sessionList[0].roomId)
  }
}

// 处理其他成员被移除
const handleOtherMemberRemove = async (uid: string, roomId: string) => {
  info('群成员退出群聊，移除群内的成员数据')
  groupStore.removeUserItem(uid, roomId)
}

// 处理群成员移除
const handleMemberRemove = async (userList: UserItem[], roomId: string) => {
  for (const user of userList) {
    if (isSelfUser(user.uid)) {
      await handleSelfRemove(roomId)
    } else {
      await handleOtherMemberRemove(user.uid, roomId)
    }
  }
}

// 处理其他成员加入群聊
const handleOtherMemberAdd = async (user: UserItem, roomId: string) => {
  info('群成员加入群聊，添加群成员数据')
  const matrixMember: MatrixRoomMember = {
    ...user,
    userId: user.uid,
    displayName: user.name,
    avatarUrl: user.avatar,
    membership: 'join',
    powerLevel: 0,
    isModerator: false,
    isCreator: false,
    roleId: 2 // 普通成员
  }
  groupStore.addUserItem(matrixMember, roomId)
}

// 检查是否为当前用户
const isSelfUser = (uid: string): boolean => {
  return uid === userStore.userInfo!.uid
}

// 处理自己加入群聊
const handleSelfAdd = async (roomId: string) => {
  info('本人加入群聊，加载该群聊的会话数据')
  await chatStore.addSession({
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

// 处理群成员添加
const handleMemberAdd = async (userList: UserItem[], roomId: string) => {
  for (const user of userList) {
    if (isSelfUser(user.uid)) {
      await handleSelfAdd(roomId)
    } else {
      await handleOtherMemberAdd(user, roomId)
    }
  }
}

useMitt.on(
  WsResponseMessageType.WS_MEMBER_CHANGE,
  async (param: {
    roomId: string
    changeType: ChangeTypeEnum
    userList: UserItem[]
    totalNum: number
    onlineNum: number
  }) => {
    info('监听到群成员变更消息')
    const isRemoveAction = param.changeType === ChangeTypeEnum.REMOVE || param.changeType === ChangeTypeEnum.EXIT_GROUP
    if (isRemoveAction) {
      await handleMemberRemove(param.userList, param.roomId)
    } else {
      await handleMemberAdd(param.userList, param.roomId)
    }

    groupStore.addGroupDetail(param.roomId)
    // 更新群内的总人数
    groupStore.updateGroupNumber(param.roomId, param.totalNum)
  }
)

useMitt.on(WsResponseMessageType.MSG_MARK_ITEM, async (data: { markList: MarkItemType[] }) => {
  logger.debug('收到消息标记更新:', data)

  // 确保data.markList是一个数组再传递给updateMarkCount
  if (data?.markList && Array.isArray(data.markList)) {
    await chatStore.updateMarkCount(data.markList)
  } else if (data && !Array.isArray(data)) {
    // 兼容处理：如果直接收到了单个MarkItemType对象
    await chatStore.updateMarkCount([data as unknown as MarkItemType])
  }
})

useMitt.on(WsResponseMessageType.REQUEST_APPROVAL_FRIEND, async () => {
  // 刷新好友列表以获取最新状态
  await contactStore.getContactList(true)
  await contactStore.getApplyUnReadCount()
  globalStore.refreshUnreadBadge()
})

useMitt.on(WsResponseMessageType.ROOM_INFO_CHANGE, async (data: { roomId: string; name: string; avatar: string }) => {
  // 根据roomId修改对应房间中的群名称和群头像
  const { roomId, name, avatar } = data

  // 更新chatStore中的会话信息
  chatStore.updateSession(roomId, {
    name,
    avatar
  })
})

useMitt.on(WsResponseMessageType.TOKEN_EXPIRED, async (wsTokenExpire: WsTokenExpire) => {
  if (Number(userUid.value) === Number(wsTokenExpire.uid) && userStore.userInfo!.client === wsTokenExpire.client) {
    const { useLoginFlow } = await import('@/hooks/useLoginFlow')
    const { logout } = useLoginFlow()
    if (isMobile()) {
      try {
        await logout()

        settingStore.toggleLogin(false, false)
        info('账号在其他设备登录')

        // 立即跳转到登录页，使用 replace 替换当前路由
        const router = await import('@/router')
        await router.default.replace('/mobile/login')

        // 跳转后再显示弹窗提示
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
      // 桌面端处理：聚焦主窗口并显示远程登录弹窗
      const home = await WebviewWindow.getByLabel('home')
      await home?.setFocus()
      const remoteIp = wsTokenExpire.ip || '未知IP'
      await sendWindowPayload('login', {
        remoteLogin: {
          ip: remoteIp,
          timestamp: Date.now()
        }
      })
      await logout()
    }
  }
})

useMitt.on(WsResponseMessageType.INVALID_USER, (param: { uid: string }) => {
  logger.debug('无效用户')
  const data = param
  // 消息列表删掉拉黑的发言
  // chatStore.filterUser(data.uid)
  // 群成员列表删掉拉黑的用户
  groupStore.removeUserItem(data.uid)
})

useMitt.on(WsResponseMessageType.ONLINE, async (onStatusChangeType: OnStatusChangeType) => {
  logger.debug('收到用户上线通知')
  // 群聊
  if (onStatusChangeType.type === 1) {
    groupStore.updateOnlineNum({
      roomId: onStatusChangeType.roomId,
      isAdd: true
    })
    groupStore.updateUserItem(
      onStatusChangeType.uid,
      {
        activeStatus: OnlineEnum.ONLINE,
        lastOptTime: onStatusChangeType.lastOptTime
      },
      onStatusChangeType.roomId
    )
  }
})

useMitt.on(WsResponseMessageType.ROOM_DISSOLUTION, async (roomId: string) => {
  logger.debug('收到群解散通知', roomId)
  // 移除群聊的会话
  chatStore.removeSession(roomId)
  // 移除群聊的详情
  groupStore.removeGroupDetail(roomId)
  // 如果当前会话为解散的群聊，切换到第一个会话
  if (globalStore.currentSessionRoomId === roomId) {
    globalStore.currentSessionRoomId = chatStore.sessionList[0].roomId
  }
})

useMitt.on(WsResponseMessageType.USER_STATE_CHANGE, async (data: { uid: string; userStateId: string }) => {
  logger.debug('收到用户状态改变', data)
  groupStore.updateUserItem(data.uid, {
    userStateId: data.userStateId
  })
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
  // 群聊
  if (onStatusChangeType.type === 1) {
    groupStore.updateOnlineNum({
      roomId: onStatusChangeType.roomId,
      isAdd: false
    })
    groupStore.updateUserItem(
      onStatusChangeType.uid,
      {
        activeStatus: OnlineEnum.OFFLINE,
        lastOptTime: onStatusChangeType.lastOptTime
      },
      onStatusChangeType.roomId
    )
  }
})

const handleVideoCall = async (remotedUid: string, callType: CallTypeEnum) => {
  info(`监听到视频通话调用，remotedUid: ${remotedUid}, callType: ${callType}`)
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
        // 接受方
        isIncoming: 'true'
      }
    })
  } else {
    await createRtcCallWindow(true, targetUid, globalStore.currentSessionRoomId, callType)
  }
}

const listenMobileReLogin = async () => {
  if (isMobile()) {
    const { useLoginFlow } = await import('@/hooks/useLoginFlow')

    const { logout } = useLoginFlow()
    addListener(
      listen('relogin', async () => {
        info('收到重新登录事件')
        await logout()
      }),
      'mobile-relogin'
    )
  }
}

// 登录/重连后兜底刷新：仅刷新当前（或首个）群聊成员，避免消息渲染成“未知用户”
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

const applyPresenceToStores = async () => {
  const trackedUserIds = collectTrackedPresenceUserIds({
    currentUserId: userStore.userInfo?.uid,
    contacts: contactStore.contactsList,
    members: groupStore.allUserInfo
  })

  if (!trackedUserIds.length || !matrixClientService.getClient()) {
    return
  }

  const nextSubscribedUserIds = trackedUserIds.filter((userId) => !subscribedPresenceUserIds.has(userId))
  if (nextSubscribedUserIds.length) {
    await matrixPresenceService.subscribeToPresence(nextSubscribedUserIds)
    nextSubscribedUserIds.forEach((userId) => subscribedPresenceUserIds.add(userId))
  }

  const presences = await matrixPresenceService.getBatchPresence(trackedUserIds)
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

let lastWsConnectionState: string | null = null
let isReconnectInFlight = false

const handleWebsocketEvent = async (event: { payload: WebsocketConnectionStatePayload | null | undefined }) => {
  const payload = event.payload
  if (!payload || payload.type !== 'connectionStateChanged') return

  const previousState = (lastWsConnectionState || '').toUpperCase() || null
  const nextStateRaw = payload.state
  const nextState = typeof nextStateRaw === 'string' ? nextStateRaw.toUpperCase() : ''
  const isReconnectionFlag = payload.isReconnection ?? payload.is_reconnection
  // 只有明确标记为重连的情况才触发同步，避免首次连接时触发不必要的全量同步
  const shouldHandleReconnect = nextState === 'CONNECTED' && isReconnectionFlag

  lastWsConnectionState = nextState || previousState

  if (!shouldHandleReconnect) return
  // 防止并行重连/同步导致 syncLoading 卡死
  if (isReconnectInFlight || chatStore.syncLoading) return
  isReconnectInFlight = true

  // 开始同步，显示加载状态
  chatStore.syncLoading = true
  try {
    // 消息同步已由前端 MatrixSyncService 通过 SDK 处理
    await chatStore.getSessionList(true)

    // 重连后同步当前/首个群聊成员信息，避免展示断网前的旧数据
    await refreshActiveGroupMembers()

    if (globalStore.currentSessionRoomId) {
      const currentRoomId = globalStore.currentSessionRoomId
      const currentSession = chatStore.getSession(currentRoomId)

      // 增量拉取当前会话的新消息，而不是清空重建
      await chatStore.fetchCurrentRoomRemoteOnce(20)

      // 重连后如果当前会话仍有未读，补一次已读上报和本地清零，避免气泡卡住
      if (currentSession?.unreadCount) {
        chatStore.markSessionRead(currentRoomId)
      }
    }
    globalStore.refreshUnreadBadge()
  } finally {
    // 同步完成，隐藏加载状态
    chatStore.syncLoading = false
    isReconnectInFlight = false
  }
}

/**
 * iOS网络权限预请求
 * 在应用启动时发起一个轻量级网络请求，触发iOS的网络权限弹窗
 */
const requestNetworkPermissionForIOS = async () => {
  await fetch('https://www.apple.com/favicon.ico', {
    method: 'HEAD',
    cache: 'no-cache'
  })
}

onMounted(async () => {
  await bootstrap()

  offlineQueueService.setReplayFn(async (op) => {
    switch (op.type) {
      case 'message': {
        const payload = op.payload as Record<string, unknown>
        const localEventId = `local-${op.id}`
        if (payload.eventType && payload.content) {
          const { roomId, eventType, content } = payload as {
            roomId: string
            eventType: string
            content: Record<string, unknown>
          }
          const client = matrixClientService.getClient()
          if (client) {
            const sendResult = await client.sendEvent(roomId, eventType, content)
            matrixMessageService.registerSentMessage(localEventId, sendResult.event_id)
          }
        } else {
          const structuredPayload = (payload.payload || payload) as SendMessagePayload
          const result = await matrixMessageService.sendStructuredMessage(structuredPayload)
          if (result?.event_id) {
            matrixMessageService.registerSentMessage(localEventId, result.event_id)
          }
        }
        break
      }
      case 'receipt': {
        const { roomId, eventId } = op.payload as { roomId: string; eventId: string }
        await matrixReceiptService.sendReadReceiptByEventId(roomId, eventId)
        break
      }
      case 'reaction': {
        const { roomId, eventId, emoji } = op.payload as { roomId: string; eventId: string; emoji: string }
        await matrixReactionService.addReaction(roomId, eventId, emoji)
        break
      }
      case 'state': {
        const { roomId, type, content } = op.payload as {
          roomId: string
          type: 'name' | 'topic' | 'avatar'
          content: string
        }
        if (type === 'name') {
          await matrixRoomStateService.setRoomName(roomId, content)
        } else if (type === 'topic') {
          await matrixRoomStateService.setRoomTopic(roomId, content)
        } else if (type === 'avatar') {
          await matrixRoomStateService.setRoomAvatar(roomId, content)
        }
        break
      }
      case 'redact': {
        const { roomId, eventId, reason } = op.payload as {
          roomId: string
          eventId: string
          reason?: string
        }
        await matrixClientService.getClient()?.redactEvent(roomId, eventId, undefined, { reason })
        break
      }
      case 'push_rule': {
        const { roomId, enabled } = op.payload as { roomId: string; enabled: boolean }
        await matrixRoomStateService.setPushRule(roomId, enabled)
        break
      }
      case 'membership': {
        const payload = op.payload as {
          roomId: string
          type: 'join' | 'leave' | 'invite' | 'kick' | 'ban' | 'unban'
          userId?: string
          reason?: string
        }
        if (payload.type === 'join') {
          await matrixRoomService.joinRoom(payload.roomId)
        } else if (payload.type === 'leave') {
          await matrixRoomService.leaveRoom(payload.roomId)
        } else if (payload.type === 'invite' && payload.userId) {
          await matrixRoomService.inviteUser(payload.roomId, payload.userId)
        } else if (payload.type === 'kick' && payload.userId) {
          await matrixRoomService.kickUser(payload.roomId, payload.userId, payload.reason)
        } else if (payload.type === 'ban' && payload.userId) {
          await matrixRoomService.banUser(payload.roomId, payload.userId, payload.reason)
        } else if (payload.type === 'unban' && payload.userId) {
          await matrixRoomService.unbanUser(payload.roomId, payload.userId)
        }
        break
      }
      case 'creation': {
        const { options } = op.payload as { options: Record<string, unknown> }
        await matrixRoomCreationService.createRoom(options)
        break
      }
      case 'dm_creation': {
        const { userId } = op.payload as { userId: string }
        await matrixRoomDirectMessageService.createDirectRoom(userId)
        break
      }
      case 'tag': {
        const { roomId, tag, order, action } = op.payload as {
          roomId: string
          tag: string
          order?: number
          action: 'set' | 'remove'
        }
        if (action === 'set') {
          await matrixRoomTagsService.setTag(roomId, tag, order)
        } else {
          await matrixRoomTagsService.removeTag(roomId, tag)
        }
        break
      }
      case 'pin': {
        const payload = op.payload as {
          roomId: string
          type: 'pinned' | 'sticky'
          eventIds?: string[]
          events?: Record<string, unknown>
        }
        if (payload.type === 'pinned' && payload.eventIds) {
          await matrixRoomPinsService.setPinnedEvents(payload.roomId, payload.eventIds)
        } else if (payload.type === 'sticky' && payload.events) {
          await matrixRoomPinsService.setStickyEvents(payload.roomId, payload.events)
        }
        break
      }
    }
  })
  offlineQueueService.startNetworkListener()

  if (isIOS()) {
    requestNetworkPermissionForIOS()
  }

  if (isWindows10() && appWindow) {
    void appWindow.setShadow(false).catch((error) => {
      logger.warn('禁用窗口阴影失败:', error)
    })
  }
  // 判断是否是桌面端，桌面端需要调整样式
  isDesktop() && import('@/styles/scss/global/desktop.scss').catch((e) => logger.warn('加载桌面端样式失败:', e))
  isMobile() && import('@/styles/scss/global/mobile.scss').catch((e) => logger.warn('加载移动端样式失败:', e))

  if (isDesktop()) {
    await import('@/styles/scss/theme/simple.scss')
    document.querySelector('#app')?.classList.add('simple')
  }
  // 首次运行使用跟随系统；已恢复状态时只做合法化修正
  settingStore.ensureThemeReady(ThemeEnum.OS)
  window.addEventListener('dragstart', preventDrag)

  if (tauriRuntimeAvailable) {
    addListener(listen('websocket-event', handleWebsocketEvent), 'websocket-event')
  }

  // 只在桌面端的主窗口中初始化全局快捷键
  if (isDesktop() && appWindow?.label === 'home') {
    initializeGlobalShortcut()
  }
  /** 开发环境不禁止 */
  if (process.env.NODE_ENV !== 'development') {
    /** 禁用浏览器默认的快捷键 */
    window.addEventListener('keydown', handleGlobalKeydown)
    /** 禁止右键菜单 */
    window.addEventListener('contextmenu', preventGlobalContextMenu, false)
  }
  // 只在桌面端处理窗口相关事件
  if (isDesktop() && tauriRuntimeAvailable && appWindow) {
    useMitt.on(MittEnum.CHECK_UPDATE, async () => {
      const checkUpdateWindow = await ensureCheckUpdateWindow()
      await checkUpdateWindow?.show()
    })
    useMitt.on<{ close: string }>(MittEnum.DO_UPDATE, async (event) => {
      await createWebviewWindow('更新', 'update', 490, 335, '', false, 490, 335, false, true)
      const closeWindow = await WebviewWindow.getByLabel(event.close)
      closeWindow?.close()
    })
    addListener(
      appWindow.listen(EventEnum.EXIT, async () => {
        await exit(0)
      }),
      'app-exit'
    )
  }
  listenMobileReLogin()
})

onUnmounted(async () => {
  subscribedPresenceUserIds.clear()
  if (unsubscribePresenceListener) {
    unsubscribePresenceListener()
    unsubscribePresenceListener = null
  }
  window.removeEventListener('contextmenu', preventGlobalContextMenu, false)
  window.removeEventListener('dragstart', preventDrag)
  if (process.env.NODE_ENV !== 'development') {
    window.removeEventListener('keydown', handleGlobalKeydown)
  }

  // 只在桌面端的主窗口中清理全局快捷键
  if (isDesktop() && appWindow?.label === 'home') {
    await cleanupGlobalShortcut()
  }
})

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

/** 控制阴影 */
watch(
  () => settingStore.pageShadowEnabled,
  (val) => {
    // 移动端始终禁用阴影
    if (isMobile()) {
      document.documentElement.style.setProperty('--shadow-enabled', '1')
    } else {
      document.documentElement.style.setProperty('--shadow-enabled', val ? '0' : '1')
    }
  },
  { immediate: true }
)

/** 控制高斯模糊 */
watch(
  () => settingStore.pageBlurEnabled,
  (val) => {
    document.documentElement.setAttribute('data-blur', val ? '1' : '0')
  },
  { immediate: true }
)

/** 控制字体样式 */
watch(
  () => settingStore.pageFontFamily,
  (val) => {
    document.documentElement.style.setProperty('--font-family', val)
  },
  { immediate: true }
)

/**
 * 语言发生变化
 */
watch(
  () => settingStore.languagePreference,
  (lang) => {
    void loadLanguage(lang)
  }
)

/** 监听会话变化 */
useMitt.on(MittEnum.MSG_INIT, async () => {
  watch(
    () => [globalStore.currentSessionRoomId, globalStore.currentSession?.type] as const,
    async ([sessionRoomId, sessionType]) => {
      if (!sessionRoomId || sessionType !== RoomTypeEnum.GROUP) {
        return
      }

      try {
        const result = await groupStore.switchSession({ roomId: sessionRoomId })
        if (result?.success) {
          await announcementStore.loadGroupAnnouncements()
        }
      } catch (error) {
        logger.error('会话切换处理失败:', error)
      }
    },
    { immediate: true }
  )
})

// 初始化的时候需要加载一次用户在localStorage中保存的代理设置
const { t } = useI18n()
const setConfigProxy = async () => {
  const proxySettingsStr = localStorage.getItem('proxySettings')
  // 如果用户没有设置代理，则不需要设置
  if (!proxySettingsStr) {
    return
  }
  const proxySettings = JSON.parse(proxySettingsStr as string)
  const baseUrl =
    proxySettings.apiType + '://' + proxySettings.apiIp + ':' + proxySettings.apiPort + proxySettings.apiSuffix
  const wsUrl = proxySettings.wsType + '://' + proxySettings.wsIp + ':' + proxySettings.wsPort + proxySettings.wsSuffix

  await updateSettings({ baseUrl, wsUrl }).catch((err) => {
    window.$message.error(t('login.network.messages.save_failed', { error: err }))
  })
}
// 在整个应用挂载前，运行一次这段代码
// setConfigProxy 已在 bootstrap() 中执行
onBeforeMount(() => {})
</script>
<style lang="scss">
/* 修改naive-ui select 组件的样式 */
.n-base-selection,
.n-base-select-menu,
.n-base-select-menu .n-base-select-option .n-base-select-option__content,
.n-base-select-menu .n-base-select-option::before {
  border-radius: 8px;
  font-size: 12px;
}

img {
  user-select: none;
  -webkit-user-select: none;
}

input,
button,
a {
  user-select: auto;
  cursor: auto;
}
</style>
