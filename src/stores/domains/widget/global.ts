import { WebviewWindow } from '@tauri-apps/api/webviewWindow'
import { info } from '@tauri-apps/plugin-log'
import { defineStore } from 'pinia'
import { MittEnum, StoresEnum } from '@/enums'
import { useChatStore, type SessionItem } from '@/stores/domains/chat/chat'
import { useMitt } from '@/hooks/useMitt.ts'
import { unreadCountManager } from '@/utils/UnreadCountManager'
import { createLogger } from '@/utils/Logger'

const logger = createLogger('GlobalStore')

export interface FriendItem {
  uid: string
  name?: string
  avatar?: string
  remark?: string
}

export interface RequestFriendItem {
  uid: string
  name?: string
  avatar?: string
  message?: string
  timestamp: number
  direction: 'incoming' | 'outgoing'
  type?: string
  roomId?: string
  applyId?: string
}

type UnreadMarkState = {
  newFriendUnreadCount: number
  newMsgUnreadCount: number
  newGroupUnreadCount: number
}

type AddFriendModalState = {
  show: boolean
  uid?: string
}

type AddGroupModalState = {
  show: boolean
  name?: string
  avatar?: string
  account?: string
}

const normalizeUnreadCount = (count: number): number => {
  if (!Number.isFinite(count)) {
    return 0
  }
  return Math.max(0, count)
}

export const useGlobalStore = defineStore(
  StoresEnum.GLOBAL,
  () => {
    const chatStore = useChatStore()

    const unReadMark = reactive<UnreadMarkState>({
      newFriendUnreadCount: 0,
      newGroupUnreadCount: 0,
      newMsgUnreadCount: 0
    })
    const unreadReady = ref<boolean>(true)

    const currentReadUnreadList = reactive<{ show: boolean; msgId: number | null }>({
      show: false,
      msgId: null
    })

    const currentSessionRoomId = ref('')
    const lastKnownSession = ref<SessionItem | null>(null)
    type CurrentSessionView = Omit<SessionItem, 'roomId'>
    const stripRoomId = (session?: SessionItem | null): CurrentSessionView | null => {
      if (!session) return null
      const { roomId: _omit, ...rest } = session
      return rest
    }
    const currentSession = computed((): CurrentSessionView | null => {
      const cachedRoomId = currentSessionRoomId.value
      if (!cachedRoomId) {
        lastKnownSession.value = null
        return null
      }

      let session: SessionItem | undefined = chatStore.getSession(cachedRoomId)
      if (!session) {
        session = chatStore.sessionList.find((item) => item.roomId === cachedRoomId)
      }
      if (session) {
        lastKnownSession.value = session
        return stripRoomId(session)
      }

      return lastKnownSession.value && lastKnownSession.value.roomId === cachedRoomId
        ? stripRoomId(lastKnownSession.value)
        : null
    })

    const currentSelectedContact = ref<FriendItem | RequestFriendItem>()

    const addFriendModalInfo = ref<AddFriendModalState>({
      show: false,
      uid: void 0
    })

    const addGroupModalInfo = ref<AddGroupModalState>({
      show: false,
      name: '',
      avatar: '',
      account: ''
    })

    const tipVisible = ref<boolean>(false)
    const isTrayMenuShow = ref<boolean>(false)

    // 草稿消息存储：按 roomId 缓存输入框内容
    const draftMessageMap = new Map<string, string>()
    const DRAFT_MAX_AGE = 7 * 24 * 60 * 60 * 1000 // 草稿保留7天

    const setDraftMessage = (roomId: string, content: string) => {
      if (content.trim()) {
        draftMessageMap.set(roomId, content)
        try {
          localStorage.setItem(
            `draft_${roomId}`,
            JSON.stringify({
              content,
              timestamp: Date.now()
            })
          )
        } catch (e) {
          logger.warn('保存草稿失败:', e)
        }
      } else {
        clearDraftMessage(roomId)
      }
    }

    const getDraftMessage = (roomId: string): string => {
      // 优先从内存获取
      if (draftMessageMap.has(roomId)) {
        return draftMessageMap.get(roomId) || ''
      }
      // 从 localStorage 恢复
      try {
        const stored = localStorage.getItem(`draft_${roomId}`)
        if (stored) {
          const { content, timestamp } = JSON.parse(stored)
          if (Date.now() - timestamp < DRAFT_MAX_AGE) {
            draftMessageMap.set(roomId, content)
            return content
          } else {
            clearDraftMessage(roomId)
          }
        }
      } catch (e) {
        logger.warn('读取草稿失败:', e)
      }
      return ''
    }

    const clearDraftMessage = (roomId: string) => {
      draftMessageMap.delete(roomId)
      try {
        localStorage.removeItem(`draft_${roomId}`)
      } catch (e) {
        logger.warn('删除草稿失败:', e)
      }
    }

    const setTipVisible = (visible: boolean) => {
      tipVisible.value = visible
    }

    const messageUnreadCount = computed(() => unReadMark.newMsgUnreadCount)
    const friendUnreadCount = computed(() => unReadMark.newFriendUnreadCount)
    const groupUnreadCount = computed(() => unReadMark.newGroupUnreadCount)
    const contactUnreadCount = computed(() => friendUnreadCount.value + groupUnreadCount.value)
    const addFriendTargetUid = computed(() => addFriendModalInfo.value.uid ?? '')
    const addFriendModalVisible = computed(() => addFriendModalInfo.value.show)
    const addGroupTargetAccount = computed(() => addGroupModalInfo.value.account ?? '')
    const addGroupTargetName = computed(() => addGroupModalInfo.value.name ?? '')
    const addGroupTargetAvatar = computed(() => addGroupModalInfo.value.avatar ?? '')
    const addGroupModalVisible = computed(() => addGroupModalInfo.value.show)

    const setFriendUnreadCount = (count: number) => {
      unReadMark.newFriendUnreadCount = normalizeUnreadCount(count)
    }

    const incrementFriendUnreadCount = (step = 1) => {
      unReadMark.newFriendUnreadCount = normalizeUnreadCount(unReadMark.newFriendUnreadCount + step)
    }

    const decrementFriendUnreadCount = (step = 1) => {
      unReadMark.newFriendUnreadCount = normalizeUnreadCount(unReadMark.newFriendUnreadCount - step)
    }

    const clearFriendUnreadCount = () => {
      unReadMark.newFriendUnreadCount = 0
    }

    const setGroupUnreadCount = (count: number) => {
      unReadMark.newGroupUnreadCount = normalizeUnreadCount(count)
    }

    const setMessageUnreadCount = (count: number) => {
      unReadMark.newMsgUnreadCount = normalizeUnreadCount(count)
    }

    const setUnreadCounts = (payload: { friend?: number; group?: number; message?: number }) => {
      if (payload.friend !== undefined) {
        setFriendUnreadCount(payload.friend)
      }
      if (payload.group !== undefined) {
        setGroupUnreadCount(payload.group)
      }
      if (payload.message !== undefined) {
        setMessageUnreadCount(payload.message)
      }
    }

    const refreshUnreadBadge = (feedUnreadCount?: number) => {
      unreadCountManager.refreshBadge(unReadMark, feedUnreadCount)
    }

    const setAddFriendTarget = (uid?: string) => {
      addFriendModalInfo.value.uid = uid ? String(uid) : ''
    }

    const openAddFriendModal = (uid?: string) => {
      setAddFriendTarget(uid)
      addFriendModalInfo.value.show = true
    }

    const closeAddFriendModal = () => {
      addFriendModalInfo.value.show = false
    }

    const setAddGroupTarget = (payload: { account?: string; name?: string; avatar?: string }) => {
      addGroupModalInfo.value.account = payload.account ?? ''
      addGroupModalInfo.value.name = payload.name ?? ''
      addGroupModalInfo.value.avatar = payload.avatar ?? ''
    }

    const openAddGroupModal = (payload: { account?: string; name?: string; avatar?: string }) => {
      setAddGroupTarget(payload)
      addGroupModalInfo.value.show = true
    }

    const closeAddGroupModal = () => {
      addGroupModalInfo.value.show = false
    }

    const updateGlobalUnreadCount = () => {
      info('[global]更新全局未读消息计数')
      unreadCountManager.calculateTotal(chatStore.sessionList, unReadMark)
    }

    watch(
      () => ({
        msg: unReadMark.newMsgUnreadCount,
        friend: unReadMark.newFriendUnreadCount,
        group: unReadMark.newGroupUnreadCount
      }),
      () => {
        if (!unreadReady.value) return
        unreadCountManager.refreshBadge(unReadMark)
      }
    )

    watch(currentSessionRoomId, async (val, oldVal) => {
      if (!val || val === oldVal) {
        return
      }

      try {
        await chatStore.changeRoom()
      } catch (error) {
        logger.error('切换会话时加载消息失败:', error)
        return
      }

      const webviewWindowLabel = WebviewWindow.getCurrent()
      if (webviewWindowLabel.label !== 'home' && webviewWindowLabel.label !== '/mobile/message') {
        useMitt.emit(MittEnum.SESSION_CHANGED, {
          roomId: val,
          oldRoomId: oldVal ?? null
        })
        return
      }

      const session = chatStore.getSession(val)
      if (session?.unreadCount) {
        info(`[global]当前会话发生实际变化: ${oldVal} -> ${val}`)
        chatStore.markSessionRead(val)
      }

      useMitt.emit(MittEnum.SESSION_CHANGED, {
        roomId: val,
        oldRoomId: oldVal ?? null
      })
    })

    const updateCurrentSessionRoomId = (id: string) => {
      currentSessionRoomId.value = id
    }

    return {
      unReadMark,
      currentSession,
      addFriendModalInfo,
      addGroupModalInfo,
      currentSelectedContact,
      currentReadUnreadList,
      tipVisible,
      isTrayMenuShow,
      unreadReady,
      messageUnreadCount,
      friendUnreadCount,
      groupUnreadCount,
      contactUnreadCount,
      addFriendTargetUid,
      addFriendModalVisible,
      addGroupTargetAccount,
      addGroupTargetName,
      addGroupTargetAvatar,
      addGroupModalVisible,
      setTipVisible,
      setFriendUnreadCount,
      incrementFriendUnreadCount,
      decrementFriendUnreadCount,
      clearFriendUnreadCount,
      setGroupUnreadCount,
      setMessageUnreadCount,
      setUnreadCounts,
      refreshUnreadBadge,
      setAddFriendTarget,
      openAddFriendModal,
      closeAddFriendModal,
      setAddGroupTarget,
      openAddGroupModal,
      closeAddGroupModal,
      updateGlobalUnreadCount,
      updateCurrentSessionRoomId,
      currentSessionRoomId,
      setDraftMessage,
      getDraftMessage,
      clearDraftMessage
    }
  },
  {
    share: {
      enable: true,
      initialize: true
    }
  }
)
