import type { RobotPresenceSnapshot, RobotRuntimeStatus } from './types'

type PresenceListener = (snapshot: RobotPresenceSnapshot) => void

class RobotPresenceService {
  private snapshots = new Map<string, RobotPresenceSnapshot>()
  private listeners = new Set<PresenceListener>()

  private buildKey(roomId: string, botId: string): string {
    return `${roomId}:${botId}`
  }

  setPresence(roomId: string, botId: string, status: RobotRuntimeStatus, message?: string): RobotPresenceSnapshot {
    const snapshot: RobotPresenceSnapshot = {
      roomId,
      botId,
      status,
      message,
      lastActiveAt: Date.now()
    }
    this.snapshots.set(this.buildKey(roomId, botId), snapshot)
    this.emit(snapshot)
    return snapshot
  }

  getPresence(roomId: string, botId: string): RobotPresenceSnapshot | null {
    return this.snapshots.get(this.buildKey(roomId, botId)) ?? null
  }

  listPresences(roomId?: string): RobotPresenceSnapshot[] {
    const all = [...this.snapshots.values()]
    return roomId ? all.filter((snapshot) => snapshot.roomId === roomId) : all
  }

  subscribe(listener: PresenceListener): () => void {
    this.listeners.add(listener)
    return () => {
      this.listeners.delete(listener)
    }
  }

  private emit(snapshot: RobotPresenceSnapshot): void {
    for (const listener of this.listeners) {
      listener({ ...snapshot })
    }
  }
}

export const robotPresenceService = new RobotPresenceService()
