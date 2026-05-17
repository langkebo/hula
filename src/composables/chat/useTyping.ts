import { onUnmounted, type Ref, reactive, ref, watch } from 'vue'
import { MittEnum } from '@/enums'
import { useMitt } from '@/hooks/useMitt'
import {
  type BatchTypingResult,
  matrixTypingService,
  type TypingUser
} from '@/services/matrix/messaging/MatrixTypingService'

export type { BatchTypingResult, TypingUser }

const typingVersions = reactive<Record<string, number>>({})

let globalListenerAttached = false

function ensureGlobalListener(): void {
  if (globalListenerAttached) return
  globalListenerAttached = true

  useMitt.on<{ roomId: string }>(MittEnum.ROOM_TYPING_CHANGED, (data) => {
    if (data?.roomId) {
      typingVersions[data.roomId] = (typingVersions[data.roomId] ?? 0) + 1
    }
  })
}

export function useTyping() {
  ensureGlobalListener()

  const startTyping = (roomId: string, timeout?: number) => {
    matrixTypingService.startTyping(roomId, timeout)
  }

  const stopTyping = (roomId: string) => {
    matrixTypingService.stopTyping(roomId)
  }

  const getTypingUsers = (roomId: string): TypingUser[] => {
    void typingVersions[roomId]
    return matrixTypingService.getTypingUsers(roomId)
  }

  const getBatchTyping = (roomIds: string[]): BatchTypingResult => {
    for (const id of roomIds) {
      void typingVersions[id]
    }
    return matrixTypingService.getBatchTyping(roomIds)
  }

  const getTypingUsersText = (roomId: string, maxDisplay?: number): string => {
    void typingVersions[roomId]
    return matrixTypingService.getTypingUsersText(roomId, maxDisplay)
  }

  const isUserTyping = (roomId: string, userId: string): boolean => {
    void typingVersions[roomId]
    return matrixTypingService.isUserTyping(roomId, userId)
  }

  const isRoomTyping = (roomId: string): boolean => {
    void typingVersions[roomId]
    return matrixTypingService.isRoomTyping(roomId)
  }

  const cleanup = () => {
    matrixTypingService.cleanup()
  }

  return {
    startTyping,
    stopTyping,
    getTypingUsers,
    getBatchTyping,
    getTypingUsersText,
    isUserTyping,
    isRoomTyping,
    cleanup
  }
}

export function useTypingReactive(roomId: Ref<string | undefined>) {
  ensureGlobalListener()

  const typingUsers = ref<TypingUser[]>([])
  const typingText = ref('')
  const isTyping = ref(false)

  let stopWatch: (() => void) | null = null

  const refresh = () => {
    const id = roomId.value
    if (!id) {
      typingUsers.value = []
      typingText.value = ''
      isTyping.value = false
      return
    }
    typingUsers.value = matrixTypingService.getTypingUsers(id)
    typingText.value = matrixTypingService.getTypingUsersText(id, 2)
    isTyping.value = typingUsers.value.length > 0
  }

  const onTypingChanged = (data: unknown) => {
    const d = data as { roomId: string } | undefined
    if (d?.roomId && d.roomId === roomId.value) {
      refresh()
    }
  }

  const start = () => {
    refresh()
    useMitt.on(MittEnum.ROOM_TYPING_CHANGED, onTypingChanged)

    stopWatch = watch(roomId, () => {
      refresh()
    })
  }

  const stop = () => {
    useMitt.off(MittEnum.ROOM_TYPING_CHANGED, onTypingChanged)
    stopWatch?.()
    stopWatch = null
  }

  start()
  onUnmounted(stop)

  return {
    typingUsers,
    typingText,
    isTyping,
    refresh
  }
}
