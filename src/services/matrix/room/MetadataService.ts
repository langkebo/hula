import { error } from '@tauri-apps/plugin-log'
import matrixClientService from '../MatrixClientService'

/**
 * Room metadata domain service.
 *
 * Read-only room descriptors: version (from `m.room.create` state),
 * capabilities / metadata / turn_server / sync (via synapse-rust
 * authedRequest endpoints).
 * Extracted from `MatrixRoomService` as part of the P1-1 split.
 */
export class MatrixRoomMetadataService {
  private getClient() {
    const client = matrixClientService.getClient()
    if (!client) throw new Error('[MatrixRoom] 客户端未初始化')
    return client
  }

  async getRoomVersion(roomId: string): Promise<string | null> {
    const client = this.getClient()
    try {
      const room = client.getRoom(roomId)
      if (!room) return null
      const createEvent = room.currentState?.getStateEvents?.('m.room.create', '')
      const content = createEvent?.getContent?.() as { room_version?: string } | undefined
      return content?.room_version ?? null
    } catch (err) {
      error(`[MatrixRoom] 获取房间版本失败: ${err}`)
      return null
    }
  }

  async getRoomCapabilities(roomId: string): Promise<Record<string, unknown>> {
    const client = this.getClient()
    try {
      const result = await client.http.authedRequest(
        'GET',
        `/_matrix/client/v3/rooms/${encodeURIComponent(roomId)}/capabilities`
      )
      return result as Record<string, unknown>
    } catch (err) {
      error(`[MatrixRoom] 获取房间能力失败: ${err}`)
      return {}
    }
  }

  async getRoomMetadata(roomId: string): Promise<Record<string, unknown>> {
    const client = this.getClient()
    try {
      const result = await client.http.authedRequest(
        'GET',
        `/_matrix/client/v3/rooms/${encodeURIComponent(roomId)}/metadata`
      )
      return result as Record<string, unknown>
    } catch (err) {
      error(`[MatrixRoom] 获取房间元数据失败: ${err}`)
      return {}
    }
  }

  async getRoomTurnServer(roomId: string): Promise<Record<string, unknown>> {
    const client = this.getClient()
    try {
      const result = await client.http.authedRequest(
        'GET',
        `/_matrix/client/v3/rooms/${encodeURIComponent(roomId)}/turn_server`
      )
      return result as Record<string, unknown>
    } catch (err) {
      error(`[MatrixRoom] 获取房间 TURN 服务器失败: ${err}`)
      return {}
    }
  }

  async getRoomSync(roomId: string): Promise<Record<string, unknown>> {
    const client = this.getClient()
    try {
      const result = await client.http.authedRequest(
        'GET',
        `/_matrix/client/v3/rooms/${encodeURIComponent(roomId)}/sync`
      )
      return result as Record<string, unknown>
    } catch (err) {
      error(`[MatrixRoom] 获取房间级同步失败: ${err}`)
      return {}
    }
  }
}

export const matrixRoomMetadataService = new MatrixRoomMetadataService()
