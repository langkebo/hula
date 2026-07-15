import { useMyRoomInfoUpdater } from '@/composables/room/useMyRoomInfoUpdater'

export function resolveMyRoomNickname({ roomId, myName }: { roomId?: string; myName?: string }): string {
  const { resolveMyRoomNickname: _resolve } = useMyRoomInfoUpdater()
  return _resolve({ roomId, myName })
}
