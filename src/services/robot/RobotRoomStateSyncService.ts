import { BaseMatrixService } from '@/services/matrix/BaseMatrixService'
import { createLogger } from '@/utils/Logger'
import type { RobotInstance, RobotRuntimeStatus } from './types'

const logger = createLogger('RobotRoomStateSyncService')

export const ROBOT_ROOM_STATE_EVENT_TYPE = 'org.hula.room.robots'
const ROBOT_ROOM_STATE_VERSION = '1.0'

type PersistedRobotInstance = {
  botId: string
  ownerUserId?: string
  status: RobotRuntimeStatus
  createdAt: number
  updatedAt: number
  metadata?: Record<string, unknown>
}

type RobotRoomStateSnapshot = {
  version: typeof ROBOT_ROOM_STATE_VERSION
  updatedAt: number
  instances: PersistedRobotInstance[]
}

const DURABLE_STATUS_MAP: Record<RobotRuntimeStatus, RobotRuntimeStatus> = {
  idle: 'idle',
  running: 'idle',
  thinking: 'idle',
  degraded: 'degraded',
  paused: 'paused',
  error: 'error',
  offline: 'offline'
}

function cloneMetadata(metadata?: Record<string, unknown>): Record<string, unknown> | undefined {
  if (!metadata || typeof metadata !== 'object' || Array.isArray(metadata)) {
    return undefined
  }

  return { ...metadata }
}

function buildInstanceId(roomId: string, botId: string): string {
  return `${roomId}:${botId}`
}

function isRobotRuntimeStatus(status: unknown): status is RobotRuntimeStatus {
  return (
    status === 'idle' ||
    status === 'running' ||
    status === 'thinking' ||
    status === 'degraded' ||
    status === 'paused' ||
    status === 'error' ||
    status === 'offline'
  )
}

function normalizeStatus(status: RobotRuntimeStatus): RobotRuntimeStatus {
  return DURABLE_STATUS_MAP[status] || 'idle'
}

class RobotRoomStateSyncService extends BaseMatrixService {
  deserializeRoomState(roomId: string, content: unknown): RobotInstance[] {
    if (!content || typeof content !== 'object' || Array.isArray(content)) {
      return []
    }

    const snapshot = content as Partial<RobotRoomStateSnapshot>
    if (snapshot.version !== ROBOT_ROOM_STATE_VERSION || !Array.isArray(snapshot.instances)) {
      return []
    }

    return snapshot.instances
      .map((item) => this.deserializeInstance(roomId, item))
      .filter((item): item is RobotInstance => !!item)
  }

  async loadRoomInstances(roomId: string): Promise<RobotInstance[]> {
    try {
      const client = this.getClient()
      const room = client.getRoom(roomId)
      const stateEvent = room?.currentState?.getStateEvents?.(ROBOT_ROOM_STATE_EVENT_TYPE, '')

      if (stateEvent?.getContent) {
        return this.deserializeRoomState(roomId, stateEvent.getContent())
      }

      const content = await client.getRoomStateEvent(roomId, ROBOT_ROOM_STATE_EVENT_TYPE, '')
      return this.deserializeRoomState(roomId, content)
    } catch (err) {
      logger.warn(`[RobotRoomState] failed to load state for ${roomId}: ${String(err)}`)
      return []
    }
  }

  async saveRoomInstances(roomId: string, instances: RobotInstance[]): Promise<void> {
    const client = this.getClient()
    const content: RobotRoomStateSnapshot = {
      version: ROBOT_ROOM_STATE_VERSION,
      updatedAt: Date.now(),
      instances: instances
        .filter((instance) => instance.roomId === roomId && instance.status !== 'offline')
        .map((instance) => ({
          botId: instance.botId,
          ownerUserId: instance.ownerUserId,
          status: normalizeStatus(instance.status),
          createdAt: instance.createdAt,
          updatedAt: instance.updatedAt,
          metadata: cloneMetadata(instance.metadata)
        }))
    }

    await client.sendStateEvent(roomId, ROBOT_ROOM_STATE_EVENT_TYPE, content, '')
    logger.info(`[RobotRoomState] saved ${content.instances.length} robot instances for ${roomId}`)
  }

  private deserializeInstance(roomId: string, item: unknown): RobotInstance | null {
    if (!item || typeof item !== 'object' || Array.isArray(item)) {
      return null
    }

    const instance = item as Partial<PersistedRobotInstance>
    if (
      typeof instance.botId !== 'string' ||
      !instance.botId ||
      !isRobotRuntimeStatus(instance.status) ||
      typeof instance.createdAt !== 'number' ||
      typeof instance.updatedAt !== 'number'
    ) {
      return null
    }

    return {
      id: buildInstanceId(roomId, instance.botId),
      roomId,
      botId: instance.botId,
      ownerUserId: typeof instance.ownerUserId === 'string' ? instance.ownerUserId : undefined,
      status: normalizeStatus(instance.status),
      createdAt: instance.createdAt,
      updatedAt: instance.updatedAt,
      metadata: cloneMetadata(instance.metadata)
    }
  }
}

export const robotRoomStateSyncService = new RobotRoomStateSyncService()
