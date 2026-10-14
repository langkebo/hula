import { ref } from 'vue'

const currentSessionRoomId = ref('')

export function getCurrentSessionRoomId(): string {
  return currentSessionRoomId.value
}

export function setCurrentSessionRoomId(roomId: string): string {
  currentSessionRoomId.value = roomId
  return currentSessionRoomId.value
}
