/* eslint-disable @typescript-eslint/no-explicit-any */
import { matrixClientService } from './MatrixClientService'
import { BaseManager } from './BaseManager'

export interface BurnConfig {
  enabled: boolean
  timeout_ms: number
  auto_delete: boolean
}

export interface BurnStats {
  total_burned: number
  pending_count: number
  last_burn_ts: number
}

export interface BurnPendingMessage {
  event_id: string
  room_id: string
  sender: string
  burn_at: number
}

const DEFAULT_BURN_STATS: BurnStats = { total_burned: 0, pending_count: 0, last_burn_ts: 0 }

class MatrixBurnAfterReadService extends BaseManager {
  private burnAfterReadManager: any = null
  private initialized = false

  initialize(): void {
    if (this.initialized) return

    const client = matrixClientService.getClient()
    if (!client) {
      return
    }

    try {
      this.burnAfterReadManager = (client as any).getBurnAfterReadManager?.() ?? null
      this.initialized = true
    } catch (_err) {}
  }

  private get client() {
    const client = matrixClientService.getClient()
    if (!client) throw new Error('Matrix client not initialized')
    return client
  }

  async setRoomBurnConfig(roomId: string, config: BurnConfig, throwOnError = false): Promise<boolean> {
    try {
      if (this.burnAfterReadManager) {
        await this.burnAfterReadManager.setRoomBurnConfig(roomId, config)
        return true
      }

      await this.client.http.authedRequest(
        'PUT' as any,
        `/_matrix/client/v1/rooms/${encodeURIComponent(roomId)}/burn`,
        undefined,
        config,
        { prefix: '' }
      )
      return true
    } catch (error) {
      return this.handleError(error, 'setRoomBurnConfig', false, throwOnError)
    }
  }

  async getRoomBurnConfig(roomId: string, throwOnError = true): Promise<BurnConfig | null> {
    try {
      if (this.burnAfterReadManager) {
        return await this.burnAfterReadManager.getRoomBurnConfig(roomId)
      }

      const response = await this.client.http.authedRequest(
        'GET' as any,
        `/_matrix/client/v1/rooms/${encodeURIComponent(roomId)}/burn`,
        undefined,
        undefined,
        { prefix: '' }
      )
      return response as BurnConfig
    } catch (error) {
      return this.handleError(error, 'getRoomBurnConfig', null, throwOnError)
    }
  }

  async getPendingBurnMessages(roomId: string, throwOnError = true): Promise<BurnPendingMessage[]> {
    try {
      if (this.burnAfterReadManager) {
        return await this.burnAfterReadManager.getPendingBurnMessages(roomId)
      }

      const response = await this.client.http.authedRequest(
        'GET' as any,
        `/_matrix/client/v1/rooms/${encodeURIComponent(roomId)}/burn/pending`,
        undefined,
        undefined,
        { prefix: '' }
      )
      return response?.messages ?? []
    } catch (error) {
      return this.handleError(error, 'getPendingBurnMessages', [] as BurnPendingMessage[], throwOnError)
    }
  }

  async markMessageRead(roomId: string, eventId: string, throwOnError = false): Promise<boolean> {
    try {
      if (this.burnAfterReadManager) {
        await this.burnAfterReadManager.markMessageRead(roomId, eventId)
        return true
      }

      await this.client.http.authedRequest(
        'POST' as any,
        `/_matrix/client/v1/rooms/${encodeURIComponent(roomId)}/burn/${encodeURIComponent(eventId)}`,
        undefined,
        {},
        { prefix: '' }
      )
      return true
    } catch (error) {
      return this.handleError(error, 'markMessageRead', false, throwOnError)
    }
  }

  async cancelBurn(roomId: string, eventId: string, throwOnError = false): Promise<boolean> {
    try {
      if (this.burnAfterReadManager) {
        await this.burnAfterReadManager.cancelBurn(roomId, eventId)
        return true
      }

      await this.client.http.authedRequest(
        'DELETE' as any,
        `/_matrix/client/v1/rooms/${encodeURIComponent(roomId)}/burn/${encodeURIComponent(eventId)}`,
        undefined,
        undefined,
        { prefix: '' }
      )
      return true
    } catch (error) {
      return this.handleError(error, 'cancelBurn', false, throwOnError)
    }
  }

  async getBurnStats(throwOnError = true): Promise<BurnStats> {
    try {
      if (this.burnAfterReadManager) {
        return await this.burnAfterReadManager.getBurnStats()
      }

      const response = await this.client.http.authedRequest(
        'GET' as any,
        '/_matrix/client/v1/user/burn/stats',
        undefined,
        undefined,
        { prefix: '' }
      )
      return response as BurnStats
    } catch (error) {
      return this.handleError(error, 'getBurnStats', DEFAULT_BURN_STATS, throwOnError)
    }
  }
}

const matrixBurnAfterReadService = new MatrixBurnAfterReadService()
export default matrixBurnAfterReadService
