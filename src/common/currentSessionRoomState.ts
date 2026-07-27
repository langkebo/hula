import { readonly, ref } from 'vue'

const currentSessionRoomId = ref('')

function _useCurrentSessionRoomState() {
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

function _resetCurrentSessionRoomStateForTests(): void {
  currentSessionRoomId.value = ''
}
