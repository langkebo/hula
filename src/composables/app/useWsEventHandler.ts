import { WebviewWindow } from '@tauri-apps/api/webviewWindow'
import { info } from '@tauri-apps/plugin-log'
import { computed } from 'vue'
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
import { createLogger } from '@/utils/Logger'
import { isMobile } from '@/utils/PlatformConstants'
import { buildPresenceStorePatch } from '@/utils/presenceStatus'

const logger = createLogger('WsEventHandler')

interface ClientServiceDeps {
  waitForClientReady(opts?: { timeoutMs?: number; intervalMs?: number }): Promise<unknown>
}

interface PresenceServiceDeps {
  setPresence(presence: 'online' | 'offline' | 'unavailable', statusMsg?: string): Promise<void>
  onPresenceChange(handler: (info: PresenceInfo) => void): () => void
}

type VideoCallRequestPayload = {
  callerUid: string
  isVideo: boolean
  [key: string]: unknown
}

export function useWsEventHandler(deps: {
  getMatrixClientService: () => Promise<ClientServiceDeps>
  getMatrixPresenceService: () => Promise<PresenceServiceDeps>
  syncAvatarPresence: () => Promise<void>
  refreshActiveGroupMembers: () => Promise<void>
  subscribedPresenceUserIds: Set<string>
  unsubscribePresenceListener: { value: (() => void) | null }
}) {
  const userStore = useUserStore()
  const contactStore = useContactStore()
  const groupStore = useGroupStore()
  const chatStore = useChatStore()
  const sessionStore = useSessionStore()
  const globalStore = useGlobalStore()
  const settingStore = useSettingStore()
  const router = useRouter()
  const { createRtcCallWindow, sendWindowPayload } = useWindow()

  const userUid = computed(() => userStore.userInfo!.uid)

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
          isIncoming: 'true'
        }
      })
    } else {
      await createRtcCallWindow(true, targetUid, globalStore.currentSessionRoomId, callType)
    }
  }

  const isSelfUser = (uid: string): boolean => {
    return uid === userStore.userInfo!.uid
  }

  const handleSelfRemove = async (roomId: string) => {
    info('本人退出群聊，移除会话数据')
    sessionStore.removeSession(roomId)
    groupStore.removeAllUsers(roomId)
    if (globalStore.currentSessionRoomId === roomId) {
      globalStore.updateCurrentSessionRoomId(sessionStore.sessionList[0].roomId)
    }
  }

  const handleOtherMemberRemove = async (uid: string, roomId: string) => {
    info('群成员退出群聊，移除群内的成员数据')
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
      roleId: 2
    }
    groupStore.addUserItem(matrixMember, roomId)
  }

  const handleSelfAdd = async (roomId: string) => {
    info('本人加入群聊，加载该群聊的会话数据')
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
        const clientService = await deps.getMatrixClientService()
        await clientService.waitForClientReady({ timeoutMs: 5000 })
        const presenceService = await deps.getMatrixPresenceService()
        await presenceService.setPresence('online')
        logger.info('[Login] 在线状态已设置为 online')
        await deps.syncAvatarPresence()
        if (!deps.unsubscribePresenceListener.value) {
          deps.unsubscribePresenceListener.value = presenceService.onPresenceChange((presence: PresenceInfo) => {
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
      await deps.refreshActiveGroupMembers()
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
        info('监听到群成员变更消息')
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
      if (Number(userUid.value) === Number(wsTokenExpire.uid) && userStore.userInfo!.client === wsTokenExpire.client) {
        const { useLoginFlow } = await import('@/hooks/useLoginFlow')
        const { logout } = useLoginFlow()
        if (isMobile()) {
          try {
            await logout()
            settingStore.toggleLogin(false, false)
            info('账号在其他设备登录')
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
  }

  return { registerHandlers }
}
