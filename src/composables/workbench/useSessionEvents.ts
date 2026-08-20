import type { MaybeRefOrGetter } from 'vue'
import { onBeforeMount, onUnmounted, toValue } from 'vue'
import { useMitt } from '@/composables/common/useMitt'
import { MittEnum } from '@/enums'

interface UseSessionEventsOptions {
  currentSessionRoomId: MaybeRefOrGetter<string | null | undefined>
  invalidateSessionCache: (roomId?: string) => unknown
  handleSessionDelete: (roomId: string) => unknown
  ensureSessionVisible: (roomId: string) => unknown
  scrollToSession: (roomId: string) => unknown
  requireRoomIdForInvalidate?: boolean
}

export function useSessionEvents(options: UseSessionEventsOptions) {
  const {
    currentSessionRoomId,
    invalidateSessionCache,
    handleSessionDelete,
    ensureSessionVisible,
    scrollToSession,
    requireRoomIdForInvalidate = false
  } = options

  onBeforeMount(() => {
    const roomId = toValue(currentSessionRoomId)
    if (!roomId) return

    useMitt.emit(MittEnum.LOCATE_SESSION, { roomId })
  })

  const handleUpdateSessionLastMsg = (payload?: { roomId?: string }) => {
    const roomId = payload?.roomId
    if (requireRoomIdForInvalidate && !roomId) return

    void invalidateSessionCache()
  }

  const handleDeleteSessionEvent = (roomId: string) => {
    if (!roomId) return
    void handleSessionDelete(roomId)
    void invalidateSessionCache(roomId)
  }

  const handleLocateSessionEvent = async (event?: { roomId?: string }) => {
    const roomId = event?.roomId
    if (!roomId) return

    await Promise.resolve(ensureSessionVisible(roomId))
    await Promise.resolve(scrollToSession(roomId))
  }

  useMitt.on(MittEnum.UPDATE_SESSION_LAST_MSG, handleUpdateSessionLastMsg)
  useMitt.on(MittEnum.DELETE_SESSION, handleDeleteSessionEvent)
  useMitt.on(MittEnum.LOCATE_SESSION, handleLocateSessionEvent)

  onUnmounted(() => {
    useMitt.off(MittEnum.UPDATE_SESSION_LAST_MSG, handleUpdateSessionLastMsg)
    useMitt.off(MittEnum.DELETE_SESSION, handleDeleteSessionEvent)
    useMitt.off(MittEnum.LOCATE_SESSION, handleLocateSessionEvent)
  })

  return {
    dispose: () => {
      useMitt.off(MittEnum.UPDATE_SESSION_LAST_MSG, handleUpdateSessionLastMsg)
      useMitt.off(MittEnum.DELETE_SESSION, handleDeleteSessionEvent)
      useMitt.off(MittEnum.LOCATE_SESSION, handleLocateSessionEvent)
    }
  }
}
