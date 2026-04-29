import { info, error } from '@tauri-apps/plugin-log'
import matrixClientService from '../MatrixClientService'

/**
 * Room account-data / reporting / retention domain service.
 *
 * Covers per-user-per-room account_data, content-scanner reports,
 * read-lifetime (阅后即焚), and the external-service registry list.
 * Extracted from `MatrixRoomService` as part of the P1-1 split.
 */
export class MatrixRoomAccountDataService {
  private getClient() {
    const client = matrixClientService.getClient()
    if (!client) throw new Error('[MatrixRoom] 客户端未初始化')
    return client
  }

  async getRoomAccountData(roomId: string, eventType: string): Promise<Record<string, unknown> | null> {
    const client = this.getClient()
    try {
      const result = await client.http.authedRequest(
        'GET',
        `/_matrix/client/v3/user/${encodeURIComponent(client.getUserId()!)}/rooms/${encodeURIComponent(roomId)}/account_data/${encodeURIComponent(eventType)}`
      )
      return result as Record<string, unknown>
    } catch (err) {
      error(`[MatrixRoom] 获取房间 account data 失败: ${err}`)
      return null
    }
  }

  async setRoomAccountData(roomId: string, eventType: string, content: Record<string, unknown>): Promise<void> {
    const client = this.getClient()
    try {
      await client.http.authedRequest(
        'PUT',
        `/_matrix/client/v3/user/${encodeURIComponent(client.getUserId()!)}/rooms/${encodeURIComponent(roomId)}/account_data/${encodeURIComponent(eventType)}`,
        undefined,
        content
      )
      info(`[MatrixRoom] 设置房间 account data 成功: ${roomId}/${eventType}`)
    } catch (err) {
      error(`[MatrixRoom] 设置房间 account data 失败: ${err}`)
      throw err
    }
  }

  async getReportScannerInfo(roomId: string, eventId: string): Promise<Record<string, unknown> | null> {
    const client = this.getClient()
    try {
      const result = await client.http.authedRequest(
        'GET',
        `/_matrix/client/v1/rooms/${encodeURIComponent(roomId)}/report/${encodeURIComponent(eventId)}/scanner_info`
      )
      return result as Record<string, unknown>
    } catch (err) {
      error(`[MatrixRoom] 获取内容扫描信息失败: ${err}`)
      return null
    }
  }

  async setReadLifetime(roomId: string, lifetimeMs: number): Promise<void> {
    const client = this.getClient()
    try {
      await client.http.authedRequest('PUT', `/_matrix/client/v3/rooms/${encodeURIComponent(roomId)}/burn`, undefined, {
        enabled: true,
        burn_after_ms: lifetimeMs
      })
      info(`[MatrixRoom] 设置阅后即焚成功: ${roomId} (${lifetimeMs}ms)`)
    } catch (err) {
      error(`[MatrixRoom] 设置阅后即焚失败: ${err}`)
      throw err
    }
  }

  async getExternalServices(): Promise<Array<Record<string, unknown>>> {
    const client = this.getClient()
    try {
      // synapse-rust 中此接口目前在 admin 命名空间下
      const result = await client.http.authedRequest('GET', '/_synapse/admin/v1/external_services')
      // 兼容两种响应格式：裸数组或带 data 包装的
      const services =
        result && typeof result === 'object' && 'data' in result
          ? (result as { data: Array<Record<string, unknown>> }).data
          : (result as Array<Record<string, unknown>>)
      return Array.isArray(services) ? services : []
    } catch (err) {
      error(`[MatrixRoom] 获取外部服务列表失败: ${err}`)
      return []
    }
  }
}

export const matrixRoomAccountDataService = new MatrixRoomAccountDataService()
