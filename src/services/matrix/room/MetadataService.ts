import { createLogger } from '@/utils/Logger'
import { unknownToObject } from '@/utils/typeGuard'
import { BaseMatrixService } from '../BaseMatrixService'

const logger = createLogger('MetadataService')

/**
 * 房间外部关联 ID（G-08）。
 *
 * 后端 `GET /_matrix/vendor/v1/rooms/{roomId}/external_ids` 返回
 * `{ type: 'room_alias', value: '#alias:server' }`；SDK 的类型声明写成了
 * `{ provider, external_id }`，与实际响应不一致，因此在此归一化两种形状。
 */
export interface RoomExternalId {
  type: string
  value: string
}

function readStringField(record: Record<string, unknown>, keys: string[]): string {
  for (const key of keys) {
    const value = record[key]
    if (typeof value === 'string' && value.length > 0) return value
  }
  return ''
}

function toRoomExternalId(entry: unknown): RoomExternalId | null {
  const record = unknownToObject(entry)
  if (!record) return null
  const type = readStringField(record, ['type', 'provider'])
  const value = readStringField(record, ['value', 'external_id'])
  if (!type || !value) return null
  return { type, value }
}

function normalizeExternalIds(raw: unknown): RoomExternalId[] {
  const record = unknownToObject(raw)
  const list = Array.isArray(raw) ? raw : record && Array.isArray(record.external_ids) ? record.external_ids : []
  return list.map(toRoomExternalId).filter((item): item is RoomExternalId => item !== null)
}

/**
 * Room metadata domain service.
 *
 * Read-only room descriptors: version (from `m.room.create` state),
 * capabilities / metadata / turn_server / sync (via synapse-rust
 * authedRequest endpoints).
 * Extracted from `MatrixRoomService` as part of the P1-1 split.
 */
export class MatrixRoomMetadataService extends BaseMatrixService {
  async getRoomVersion(roomId: string): Promise<string | null> {
    const client = this.getClient()
    try {
      const room = client.getRoom(roomId)
      if (!room) return null
      const createEvent = room.currentState?.getStateEvents?.('m.room.create', '')
      const content = createEvent?.getContent?.() as { room_version?: string } | undefined
      return content?.room_version ?? null
    } catch (err) {
      logger.error(`[MatrixRoom] 获取房间版本失败: ${err}`)
      return null
    }
  }

  async getRoomCapabilities(roomId: string): Promise<Record<string, unknown>> {
    const client = this.getClient()
    try {
      const result = await client.getRoomManager().getRoomCapabilities(roomId)
      return unknownToObject(result) ?? {}
    } catch (err) {
      logger.error(`[MatrixRoom] 获取房间能力失败: ${err}`)
      return {}
    }
  }

  async getRoomMetadata(roomId: string): Promise<Record<string, unknown>> {
    const client = this.getClient()
    try {
      const result = await client.getRoomManager().getRoomMetadata(roomId)
      return unknownToObject(result) ?? {}
    } catch (err) {
      logger.error(`[MatrixRoom] 获取房间元数据失败: ${err}`)
      return {}
    }
  }

  async getRoomTurnServer(roomId: string): Promise<Record<string, unknown>> {
    const client = this.getClient()
    try {
      const result = await client.getRoomSummaryManager().getRoomTurnServer(roomId)
      return unknownToObject(result) ?? {}
    } catch (err) {
      logger.error(`[MatrixRoom] 获取房间 TURN 服务器失败: ${err}`)
      return {}
    }
  }

  async getRoomSync(roomId: string): Promise<Record<string, unknown>> {
    const client = this.getClient()
    try {
      const result = await client.getRoomSummaryManager().getRoomSync(roomId)
      return unknownToObject(result) ?? {}
    } catch (err) {
      logger.error(`[MatrixRoom] 获取房间级同步失败: ${err}`)
      return {}
    }
  }

  async getRoomPermissions(roomId: string): Promise<Record<string, unknown>> {
    const client = this.getClient()
    try {
      const result = await client.getRoomSummaryManager().getRoomPermissions(roomId)
      return unknownToObject(result) ?? {}
    } catch (err) {
      logger.error(`[MatrixRoom] 获取房间权限失败: ${err}`)
      return {}
    }
  }

  /**
   * 获取房间外部关联 ID（G-08，只读）。
   *
   * 端点不存在（`M_UNRECOGNIZED`）或读取失败时返回空数组，调用方据此整块不渲染。
   */
  async getRoomExternalIds(roomId: string): Promise<RoomExternalId[]> {
    try {
      const client = this.getClient()
      const result = await client.getRoomSummaryManager().eventOps.getRoomExternalIds(roomId)
      return normalizeExternalIds(result)
    } catch (err) {
      logger.warn(`[MatrixRoom] 获取房间外部关联 ID 失败: ${err}`)
      return []
    }
  }
}

export const matrixRoomMetadataService = new MatrixRoomMetadataService()
