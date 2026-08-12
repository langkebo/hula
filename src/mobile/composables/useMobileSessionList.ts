import { computed, reactive, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useReplaceMsg } from '@/composables/chat/useReplaceMsg'
import { MsgEnum, RoomTypeEnum } from '@/enums'
import type { SessionItem } from '@/stores/domains/chat/chat'
import { useChatStore } from '@/stores/domains/chat/chat'
import type { MatrixRoomMember } from '@/stores/domains/chat/group'
import { useGroupStore } from '@/stores/domains/chat/group'
import { useGlobalStore } from '@/stores/domains/widget/global'
import { formatChatTime } from '@/utils/ComputedTime.ts'

type SessionMsgCacheItem = { msg: string; isAtMe: boolean; time: number; senderName: string }

/**
 * 移动端会话列表数据 composable
 * 负责:会话列表的派生计算、搜索过滤、消息缓存清理
 */
export function useMobileSessionList() {
  const { t } = useI18n()
  const chatStore = useChatStore()
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
    if (!searchText.value.trim()) {
      return sessionList.value
    }
    const query = searchText.value.trim().toLowerCase()
    return sessionList.value.filter((item) => item.name?.toLowerCase().includes(query))
  })

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
    allUserMap
  }
}

/** useMobileSessionList 派生的会话列表项(在 SessionItem 基础上附加 lastMsg/lastMsgTime/isAtMe 等展示字段) */
export type MobileSessionListItem = SessionItem & {
  lastMsg: string
  lastMsgTime: string
  isAtMe: boolean
}

export type MobileSessionListReturn = ReturnType<typeof useMobileSessionList>
