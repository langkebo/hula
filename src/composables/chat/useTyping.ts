import { reactive } from 'vue'
import { useMitt } from '@/composables/common/useMitt'
import { MittEnum } from '@/enums'
import {
  type BatchTypingResult,
  matrixTypingService,
  type TypingUser
} from '@/services/matrix/messaging/MatrixTypingService'

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
