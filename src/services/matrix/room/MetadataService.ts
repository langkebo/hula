import { createLogger } from '@/utils/Logger'
import { BaseMatrixService } from '../BaseMatrixService'
import { MATRIX_PATHS } from '../paths'

const logger = createLogger('MetadataService')

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
      return result as Record<string, unknown>
    } catch (err) {
      logger.error(`[MatrixRoom] 获取房间能力失败: ${err}`)
      return {}
    }
  }

  async getRoomMetadata(roomId: string): Promise<Record<string, unknown>> {
    const client = this.getClient()
    try {
      const result = await client.getRoomManager().getRoomMetadata(roomId)
      return result as Record<string, unknown>
    } catch (err) {
      logger.error(`[MatrixRoom] 获取房间元数据失败: ${err}`)
      return {}
    }
  }

  async getRoomTurnServer(roomId: string): Promise<Record<string, unknown>> {
    const client = this.getClient()
    try {
      const result = await client.getRoomSummaryManager().getRoomTurnServer(roomId)
      return result as unknown as Record<string, unknown>
    } catch (err) {
      logger.error(`[MatrixRoom] 获取房间 TURN 服务器失败: ${err}`)
      return {}
    }
  }

  async getRoomSync(roomId: string): Promise<Record<string, unknown>> {
    const client = this.getClient()
    try {
      const result = await client.getRoomSummaryManager().getRoomSync(roomId)
      return result as unknown as Record<string, unknown>
    } catch (err) {
      logger.error(`[MatrixRoom] 获取房间级同步失败: ${err}`)
      return {}
    }
  }

  async getRoomPermissions(roomId: string): Promise<Record<string, unknown>> {
    const client = this.getClient()
    try {
      const result = await client.getRoomSummaryManager().getRoomPermissions(roomId)
      return result as unknown as Record<string, unknown>
    } catch (err) {
      logger.error(`[MatrixRoom] 获取房间权限失败: ${err}`)
      return {}
    }
  }
}

export const matrixRoomMetadataService = new MatrixRoomMetadataService()
