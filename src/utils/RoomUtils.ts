import { useMyRoomInfoUpdater } from '@/hooks/useMyRoomInfoUpdater'

export function resolveMyRoomNickname({ roomId, myName }: { roomId?: string; myName?: string }): string {
  const { resolveMyRoomNickname: _resolve } = useMyRoomInfoUpdater()
  return _resolve({ roomId, myName })
}
