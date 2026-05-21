import { readonly, ref } from 'vue'

const currentSessionRoomId = ref('')

export function useCurrentSessionRoomState() {
  return {
    currentSessionRoomId: readonly(currentSessionRoomId)
  }
}

export function getCurrentSessionRoomId(): string {
  return currentSessionRoomId.value
}

export function setCurrentSessionRoomId(roomId: string): string {
  currentSessionRoomId.value = roomId
  return currentSessionRoomId.value
}

export function resetCurrentSessionRoomStateForTests(): void {
  currentSessionRoomId.value = ''
}
