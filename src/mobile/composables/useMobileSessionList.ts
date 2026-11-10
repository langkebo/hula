import { computed, reactive, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useReplaceMsg } from '@/composables/chat/useReplaceMsg'
import { MsgEnum, RoomTypeEnum } from '@/enums'
import {
  isPrivateRoom,
  loadPrivateRoomRegistry,
  migrateFromHiddenSessions
} from '@/services/matrix/privateChat/privateRoomRegistry'
import type { SessionItem } from '@/stores/domains/chat/chat'
import { useChatStore } from '@/stores/domains/chat/chat'
import { useSessionStore } from '@/stores/domains/chat/chat/session'
import type { MatrixRoomMember } from '@/stores/domains/chat/group'
import { useGroupStore } from '@/stores/domains/chat/group'
import { useGlobalStore } from '@/stores/domains/widget/global'
import { formatChatTime } from '@/utils/ComputedTime.ts'
import { createLogger } from '@/utils/Logger'

const logger = createLogger('MobileSessionList')

type SessionMsgCacheItem = { msg: string; isAtMe: boolean; time: number; senderName: string }

/**
 * 移动端会话列表数据 composable
 * 负责:会话列表的派生计算、搜索过滤、消息缓存清理
 */
export function useMobileSessionList() {
  const { t } = useI18n()
  const chatStore = useChatStore()
  // 失败态直接从 session store 读（不再经 chatStore 转发，见 message.ts 的快照教训）
  const sessionStore = useSessionStore()
  const groupStore = useGroupStore()
  const globalStore = useGlobalStore()
  const { checkRoomAtMe, getMessageSenderName, formatMessageContent } = useReplaceMsg()

  const searchText = ref('')
  const sessionMsgCache = reactive<Record<string, SessionMsgCacheItem>>({})

  const allUserMap = computed(() => {
    const map = new Map<string, MatrixRoomMember>()
    groupStore.allUserInfo.forEach((user) => {
      map.set(user.uid, user as MatrixRoomMember)
    })
    return map
  })

  const sessionList = computed(() => {
    return chatStore.sessionList
      .map((item): MobileSessionListItem => {
        let latestAvatar = item.avatar
        if (item.type === RoomTypeEnum.SINGLE && item.id) {
          latestAvatar = groupStore.getUserInfo(item.id)?.avatar || item.avatar
        }

        let displayName = item.name
        if (item.type === RoomTypeEnum.GROUP && item.remark) {
          displayName = item.remark
        }

        const messages = chatStore.chatMessageListByRoomId(item.roomId)

        let displayMsg = ''
        let isAtMe = false

        const lastMsg = messages[messages.length - 1]
        const cacheKey = item.roomId
        const cached = sessionMsgCache[cacheKey]
        const sendTime = lastMsg?.message?.sendTime || 0

        if (lastMsg) {
          const senderName = getMessageSenderName(lastMsg, '', item.roomId, item.type)
          const shouldRefreshCache = !cached || cached.time < sendTime || cached.senderName !== senderName

          if (shouldRefreshCache) {
            isAtMe = checkRoomAtMe(
              item.roomId,
              item.type,
              globalStore.currentSessionRoomId!,
              messages,
              item.unreadCount
            )
            displayMsg = formatMessageContent(lastMsg, item.type, senderName, item.roomId)

            if (item.type === RoomTypeEnum.GROUP && lastMsg.message?.type === MsgEnum.SYSTEM && displayMsg) {
              const separatorIndex = displayMsg.indexOf(':')
              if (separatorIndex > -1) {
                displayMsg = displayMsg.slice(separatorIndex + 1)
              }
            }

            sessionMsgCache[cacheKey] = {
              msg: displayMsg,
              isAtMe,
              time: sendTime,
              senderName
            }
          } else {
            displayMsg = cached.msg
            isAtMe = item.unreadCount > 0 ? cached.isAtMe : false
          }
        } else if (cached) {
          displayMsg = cached.msg
          isAtMe = item.unreadCount > 0 ? cached.isAtMe : false
        }

        return {
          ...item,
          avatar: latestAvatar,
          name: displayName,
          lastMsg: displayMsg || t('message.message_list.default_last_msg'),
          lastMsgTime: formatChatTime(item?.activeTime),
          isAtMe
        }
      })
      .sort((a, b) => {
        if (a.top && !b.top) return -1
        if (!a.top && b.top) return 1
        return b.activeTime - a.activeTime
      })
  })

  const filteredSessionList = computed(() => {
    // 私密房间与普通会话分离：不进入普通列表（方案 P0-0-a）
    const visible = sessionList.value.filter((item) => !isPrivateRoom(item.roomId))
    if (!searchText.value.trim()) {
      return visible
    }
    const query = searchText.value.trim().toLowerCase()
    return visible.filter((item) => item.name?.toLowerCase().includes(query))
  })

  /**
   * 私密会话数量。
   *
   * 移动端没有桌面工具栏那样的入口容器，入口按钮直接挂在本页 NavBar 上，
   * 因此把计数暴露给视图；`isPrivateRoom` 内部的 registryVersion 变化会触发重算。
   */
  const hiddenSessionCount = computed(() => sessionList.value.filter((item) => isPrivateRoom(item.roomId)).length)

  /**
   * 同步私密房登记表（一次性）。
   *
   * 冷启动时 `isPrivateRoom` 读的是 localStorage 缓存，换设备新增的私密房要等
   * account data 拉取后才知道；不拉就会先闪进普通列表（信息泄漏）。
   * 顺带把历史 `session.hide` 会话迁入登记表，保证老数据也能进入私密列表。
   */
  let privateRoomsSynced = false
  const syncPrivateRoomRegistry = async () => {
    if (privateRoomsSynced) return
    privateRoomsSynced = true
    try {
      await loadPrivateRoomRegistry()
      await migrateFromHiddenSessions(chatStore.sessionList.filter((item) => item.hide).map((item) => item.roomId))
    } catch (err) {
      // 失败允许下次会话变化时重试；此时列表按缓存判定，最坏是漏藏而非错藏
      privateRoomsSynced = false
      logger.warn('同步私密房登记表失败，暂按本地缓存判定:', err)
    }
  }

  watch(
    () => chatStore.sessionList.length,
    (length) => {
      if (length > 0) void syncPrivateRoomRegistry()
    },
    { immediate: true }
  )

  // 会话被移除时清理对应的消息缓存
  watch(
    () => chatStore.sessionList.map((item) => item.roomId),
    (roomIds) => {
      const activeRoomIds = new Set(roomIds)
      for (const roomId of Object.keys(sessionMsgCache)) {
        if (!activeRoomIds.has(roomId)) {
          Reflect.deleteProperty(sessionMsgCache, roomId)
        }
      }
    },
    { immediate: true }
  )

  return {
    searchText,
    sessionList,
    filteredSessionList,
    /** 私密会话数量；为 0 时不显示「已隐藏的会话」入口 */
    hiddenSessionCount,
    allUserMap,
    /** 最近一次拉取失败的原因；用于把「网络失败」与「真的没有会话」区分开 */
    loadError: computed(() => sessionStore.loadError),
    /** 服务端是否仍在拉取（首屏骨架/失败重试的判据） */
    isLoading: computed(() => sessionStore.sessionOptions.isLoading)
  }
}

/** 会话列表的四种可视图态 */
type SessionListState = 'loading' | 'error' | 'empty' | 'list'

/**
 * 判定会话列表该显示哪个态。
 *
 * 抽成纯函数是为了能单测：把「还没拉到」当成「没有会话」是本页最容易被误读的体验问题
 * （用户看到「暂无会话」不会想到去下拉刷新）。
 */
export function resolveSessionListState(input: {
  count: number
  isLoading: boolean
  loadError: string | null | undefined
}): SessionListState {
  if (input.count > 0) return 'list'
  if (input.loadError) return 'error'
  return input.isLoading ? 'loading' : 'empty'
}

/** useMobileSessionList 派生的会话列表项(在 SessionItem 基础上附加 lastMsg/lastMsgTime/isAtMe 等展示字段) */
export type MobileSessionListItem = SessionItem & {
  avatar?: string | undefined
  lastMsg: string
  lastMsgTime: string
  isAtMe: boolean
}
