import { RoomTypeEnum } from '@/enums'
import type { SessionItem } from '@/stores/domains/chat/chat'
import { useChatStore } from '@/stores/domains/chat/chat'
import { useGroupStore } from '@/stores/domains/chat/group'
import { useGlobalStore } from '@/stores/domains/widget/global'
import { useTimerManager } from '@/utils/TimerManager'

type SessionChangeHook = (roomId: string) => void

interface UseSessionPageSyncOptions {
  activePath: string
  handleMsgClick: (item: SessionItem) => Promise<unknown> | unknown
  beforeHandleSession?: SessionChangeHook
}

export const useSessionPageSync = ({ activePath, handleMsgClick, beforeHandleSession }: UseSessionPageSyncOptions) => {
  const route = useRoute()
  const timerManager = useTimerManager()
  const chatStore = useChatStore()
  const globalStore = useGlobalStore()
  const groupStore = useGroupStore()

  let clearUnreadTimer: number | null = null

  watch(
    () => chatStore.currentSessionInfo,
    async (newVal) => {
      if (!newVal) return

      beforeHandleSession?.(newVal.roomId)

      if (newVal.roomId === globalStore.currentSessionRoomId) {
        return
      }

      if (newVal.type === RoomTypeEnum.GROUP) {
        await handleMsgClick({
          ...newVal,
          memberNum: groupStore.countInfo?.memberNum,
          remark: groupStore.countInfo?.remark,
          myName: groupStore.countInfo?.myName
        } as SessionItem)
        return
      }

      await handleMsgClick(newVal as SessionItem)
    },
    { immediate: true }
  )

  watch(
    () => route.path,
    async (newPath) => {
      if (clearUnreadTimer) {
        clearTimeout(clearUnreadTimer)
        clearUnreadTimer = null
      }

      if (newPath !== activePath) return

      const currentRoomId = globalStore.currentSessionRoomId
      if (!currentRoomId) return

      const session = chatStore.getSession(currentRoomId)
      if (session?.unreadCount && session.unreadCount > 0) {
        clearUnreadTimer = timerManager.setTimeout(() => {
          chatStore.markSessionRead(currentRoomId)
          clearUnreadTimer = null
        }, 2000)
      }
    },
    { immediate: true }
  )

  onUnmounted(() => {
    if (clearUnreadTimer) {
      clearTimeout(clearUnreadTimer)
      clearUnreadTimer = null
    }
  })
}
