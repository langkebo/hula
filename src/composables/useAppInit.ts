/**
 * 应用初始化 Composable
 * 封装应用启动时的各种初始化逻辑
 */
import { onMounted, onUnmounted, watch, nextTick, watchEffect } from 'vue'
import { useI18n } from 'vue-i18n'
import { WebviewWindow } from '@tauri-apps/api/webviewWindow'
import { info } from '@tauri-apps/plugin-log'
import { exit } from '@tauri-apps/plugin-process'
import { listen } from '@tauri-apps/api/event'
import { loadLanguage } from '@/services/i18n'
import type { LoginSuccessResType, OnStatusChangeType } from '@/services/wsType'
import type { RevokedMsgType, UserItem } from '@/services/types'
import { useGlobalStore } from '@/stores/global'
import { useSettingStore } from '@/stores/setting'
import { useContactStore } from '@/stores/contacts'
import { useGroupStore } from '@/stores/group'
import { useUserStore } from '@/stores/user'
import { useChatStore } from '@/stores/chat'
import { useAnnouncementStore } from '@/stores/announcement'
import type { MatrixRoomMember } from '@/stores/group'
import { useMitt } from '@/hooks/useMitt'
import { MittEnum } from '@/enums'
import { useWindow } from '@/hooks/useWindow'
import { useGlobalShortcut } from '@/hooks/useGlobalShortcut'
import { useNetworkStatus } from '@/hooks/useNetworkStatus'
import { useTauriListener } from '@/hooks/useTauriListener'
import { updateSettings } from '@/services/tauriCommand'
import { isDesktop, isIOS, isMobile, isWindows10 } from '@/utils/PlatformConstants'
import { unreadCountManager } from '@/utils/UnreadCountManager'
import {
  CallTypeEnum,
  EventEnum,
  ThemeEnum,
  ChangeTypeEnum,
  RoomTypeEnum,
  OnlineEnum,
  WsResponseMessageType
} from '@/enums'

import { createLogger } from '@/utils/Logger'
const logger = createLogger('AppInit')

export function useAppInit() {
  const userStore = useUserStore()
  const contactStore = useContactStore()
  const announcementStore = useAnnouncementStore()
  const groupStore = useGroupStore()
  const chatStore = useChatStore()
  const globalStore = useGlobalStore()
  const settingStore = useSettingStore()
  const { t } = useI18n()

  const appWindow = WebviewWindow.getCurrent()
  const { createRtcCallWindow, createWebviewWindow } = isDesktop() ? useWindow() : { createWebviewWindow: () => {} }
  const { addListener } = useTauriListener()
  const { initializeGlobalShortcut, cleanupGlobalShortcut } = useGlobalShortcut()

  const { themes, page } = storeToRefs(settingStore)

  // 检查是否为当前用户
  const isSelfUser = (uid: string): boolean => {
    return uid === userStore.userInfo!.uid
  }

  // 登录成功处理
  const handleLoginSuccess = async (data: LoginSuccessResType) => {
    const { ...rest } = data
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
    await refreshActiveGroupMembers()
  }

  // 刷新当前群聊成员
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
    } catch (error) {
      logger.error('刷新群成员失败:', error)
    }
  }

  // 处理自己被移除
  const handleSelfRemove = async (roomId: string) => {
    info('本人退出群聊，移除会话数据')
    chatStore.removeSession(roomId)
    groupStore.removeAllUsers(roomId)
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
      userId: user.uid,
      displayName: user.name,
      avatarUrl: user.avatar,
      membership: 'join',
      powerLevel: 0,
      isModerator: false,
      isCreator: false,
      name: user.name,
      uid: user.uid,
      account: user.uid,
      avatar: user.avatar,
      activeStatus: OnlineEnum.ONLINE,
      roleId: 0,
      lastOptTime: Date.now()
    }
    groupStore.addUserItem(matrixMember, roomId)
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

  // 处理视频通话
  const handleVideoCall = async (remoteUid: string, callType: CallTypeEnum) => {
    info(`监听到视频通话调用，remotedUid: ${remoteUid}, callType: ${callType}`)
    const currentSession = globalStore.currentSession
    const targetUid = remoteUid || currentSession?.detailId
    if (!targetUid) {
      logger.warn('当前会话尚未就绪或无法解析对端用户，忽略通话事件')
      return
    }
    if (isMobile()) {
      const router = useRouter()
      router.push({
        path: '/mobile/rtcCall',
        query: {
          remoteUserId: targetUid,
          roomId: globalStore.currentSessionRoomId,
          callType: callType.toString(),
          isIncoming: 'true'
        }
      })
    } else {
      await createRtcCallWindow?.(true, targetUid, globalStore.currentSessionRoomId, callType)
    }
  }

  // 处理消息撤回
  const handleMsgRecall = (data: RevokedMsgType) => {
    chatStore.updateRecallMsg(data)
  }

  // 处理房间信息变化
  const handleRoomInfoChange = (data: { myName: string; roomId: string; uid: string }) => {
    groupStore.updateUserItem(data.uid, { myName: data.myName }, data.roomId)
  }

  // 处理新好友申请
  const handleNewFriend = async (data: { uid: number; unReadCount4Friend: number; unReadCount4Group: number }) => {
    logger.debug('收到好友申请')
    globalStore.unReadMark.newFriendUnreadCount = data.unReadCount4Friend || 0
    globalStore.unReadMark.newGroupUnreadCount = data.unReadCount4Group || 0
    unreadCountManager.refreshBadge(globalStore.unReadMark)
    await contactStore.getApplyPage('friend', true)
  }

  // 处理通知事件
  const handleNotifyEvent = async () => {
    await contactStore.getApplyUnReadCount()
    await Promise.all([contactStore.getApplyPage('friend', true), contactStore.getApplyPage('group', true)])
  }

  // 处理成员变更
  const handleMemberChange = async (param: {
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
    } else if (param.changeType === ChangeTypeEnum.JOIN) {
      await handleMemberAdd(param.userList, param.roomId)
    }
    groupStore.updateOnlineNum({
      roomId: param.roomId,
      onlineNum: param.onlineNum,
      isAdd: false
    })
  }

  // 处理在线状态变化
  const handleStatusChange = (onStatusChangeType: OnStatusChangeType) => {
    groupStore.updateOnlineNum({
      roomId: onStatusChangeType.roomId,
      onlineNum: onStatusChangeType.onlineNum,
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

  // iOS网络权限预请求
  const requestNetworkPermissionForIOS = async () => {
    await fetch('https://www.apple.com/favicon.ico', {
      method: 'HEAD',
      cache: 'no-cache'
    })
  }

  // 设置代理
  const setConfigProxy = async () => {
    const proxySettingsStr = localStorage.getItem('proxySettings')
    if (!proxySettingsStr) {
      return
    }
    const proxySettings = JSON.parse(proxySettingsStr as string)
    const baseUrl =
      proxySettings.apiType + '://' + proxySettings.apiIp + ':' + proxySettings.apiPort + proxySettings.apiSuffix
    const wsUrl =
      proxySettings.wsType + '://' + proxySettings.wsIp + ':' + proxySettings.wsPort + proxySettings.wsSuffix

    await updateSettings({ baseUrl, wsUrl }).catch((err) => {
      window.$message.error(t('login.network.messages.save_failed', { error: err }))
    })
  }

  // 初始化事件监听
  const initializeEventListeners = () => {
    useMitt.on(WsResponseMessageType.VideoCallRequest, (event: any) => {
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

    useMitt.on(WsResponseMessageType.LOGIN_SUCCESS, handleLoginSuccess)
    useMitt.on(WsResponseMessageType.MSG_RECALL, handleMsgRecall)
    useMitt.on(WsResponseMessageType.MY_ROOM_INFO_CHANGE, handleRoomInfoChange)
    useMitt.on(WsResponseMessageType.REQUEST_NEW_FRIEND, handleNewFriend)
    useMitt.on(WsResponseMessageType.NOTIFY_EVENT, handleNotifyEvent)
    useMitt.on(WsResponseMessageType.WS_MEMBER_CHANGE, handleMemberChange)
    useMitt.on(WsResponseMessageType.ONLINE, handleStatusChange)
  }

  // 初始化窗口事件
  const initializeWindowEvents = async () => {
    if (!isDesktop()) return

    useMitt.on(MittEnum.CHECK_UPDATE, async () => {
      const checkUpdateWindow = await WebviewWindow.getByLabel('checkupdate')
      await checkUpdateWindow?.show()
    })

    useMitt.on(MittEnum.DO_UPDATE, async (event: { close: string }) => {
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

  // 初始化应用
  const initApp = async () => {
    if (isDesktop()) {
      useNetworkStatus()
    }
    initializeEventListeners()
    await initializeWindowEvents()
  }

  // 挂载时执行
  const onAppMounted = () => {
    onMounted(async () => {
      if (isIOS()) {
        await requestNetworkPermissionForIOS()
      }

      if (isWindows10()) {
        void appWindow.setShadow(false).catch((error) => {
          logger.warn('禁用窗口阴影失败:', error)
        })
      }

      isDesktop() && import('@/styles/scss/global/desktop.scss')
      isMobile() && import('@/styles/scss/global/mobile.scss')

      import(`@/styles/scss/theme/${themes.value.versatile}.scss`)

      if (!settingStore.themes.content) {
        settingStore.initTheme(ThemeEnum.OS)
      } else {
        settingStore.normalizeThemeState()
      }
      document.documentElement.dataset.theme = settingStore.themes.content

      const preventDrag = (e: MouseEvent) => {
        const event = e.target as HTMLElement
        if (event.nodeName.toLowerCase() === 'img' || event.nodeName.toLowerCase() === 'input') {
          e.preventDefault()
        }
      }
      window.addEventListener('dragstart', preventDrag)

      addListener(listen('websocket-event', handleWebsocketEvent), 'websocket-event')

      if (isDesktop() && appWindow.label === 'home') {
        initializeGlobalShortcut()
      }

      if (import.meta.env.PROD) {
        window.addEventListener('keydown', (e) => {
          if (e.ctrlKey && (e.key === 'f' || e.key === 'r' || e.key === 'g' || e.key === 'j')) {
            e.preventDefault()
          }
        })
        window.addEventListener('contextmenu', (event) => event.preventDefault(), false)
      }

      await listenMobileReLogin()

      await setConfigProxy()
    })
  }

  // 卸载时执行
  const onAppUnmounted = () => {
    onUnmounted(async () => {
      window.removeEventListener('contextmenu', (event) => event.preventDefault(), false)
      window.removeEventListener('dragstart', (e: any) => {
        const event = e.target as HTMLElement
        if (event.nodeName.toLowerCase() === 'img' || event.nodeName.toLowerCase() === 'input') {
          e.preventDefault()
        }
      })

      if (isDesktop() && appWindow.label === 'home') {
        await cleanupGlobalShortcut()
      }
    })
  }

  // WebSocket 事件处理
  let lastWsConnectionState: string | null = null
  let isReconnectInFlight = false

  const handleWebsocketEvent = async (event: any) => {
    const payload: any = event.payload
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
      unreadCountManager.refreshBadge(globalStore.unReadMark)
    } finally {
      chatStore.syncLoading = false
      isReconnectInFlight = false
    }
  }

  // 移动端重新登录
  const listenMobileReLogin = async () => {
    if (isMobile()) {
      const { useLogin } = await import('@/hooks/useLogin')
      const { resetLoginState, logout } = useLogin()
      addListener(
        listen('relogin', async () => {
          info('收到重新登录事件')
          await resetLoginState()
          await logout()
        }),
        'mobile-relogin'
      )
    }
  }

  // 监听会话切换
  const watchSessionChange = () => {
    useMitt.on(MittEnum.MSG_INIT, async () => {
      watchEffect(async () => {
        const sessionRoomId = globalStore.currentSessionRoomId
        const sessionType = globalStore.currentSession?.type

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
      })
    })
  }

  // 主题和页面配置监听
  const watchThemeAndPage = () => {
    watch(
      () => page.value.shadow,
      (val) => {
        if (isMobile()) {
          document.documentElement.style.setProperty('--shadow-enabled', '1')
        } else {
          document.documentElement.style.setProperty('--shadow-enabled', val ? '0' : '1')
        }
      },
      { immediate: true }
    )

    watch(
      () => page.value.blur,
      (val) => {
        document.documentElement.setAttribute('data-blur', val ? '1' : '0')
      },
      { immediate: true }
    )

    watch(
      () => page.value.fonts,
      (val) => {
        document.documentElement.style.setProperty('--font-family', val)
      },
      { immediate: true }
    )

    watch(
      () => page.value.lang,
      (lang) => {
        lang = lang === 'AUTO' ? navigator.language : lang
        loadLanguage(lang)
      }
    )

    watch(
      () => themes.value.versatile,
      async (val, oldVal) => {
        logger.debug('主题切换:', val)
        await import(`@/styles/scss/theme/${val}.scss`)
        const app = document.querySelector('#app')?.classList as DOMTokenList
        app.remove(oldVal as string)
        await nextTick(() => {
          app.add(val)
        })
      },
      { immediate: true }
    )
  }

  return {
    initApp,
    onAppMounted,
    onAppUnmounted,
    watchSessionChange,
    watchThemeAndPage,
    refreshActiveGroupMembers
  }
}
