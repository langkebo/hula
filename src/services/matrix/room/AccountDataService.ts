import { createLogger } from '@/utils/Logger'
import { type AIConnectionInfo, type McpTool, matrixAIConnectionService } from '../ai/MatrixAIConnectionService'
import { BaseMatrixService } from '../BaseMatrixService'
import { authedRequestWithPath } from '../MatrixHttpClient'
import { MATRIX_PATHS } from '../paths'
import { matrixRoomSummaryService, type RoomSummary } from './MatrixRoomSummaryService'

const logger = createLogger('AccountDataService')

type AIConnection = AIConnectionInfo
type MCPTool = McpTool

/**
 * Room account-data / reporting / retention domain service.
 *
 * Covers per-user-per-room account_data, content-scanner reports,
 * read-lifetime (阅后即焚), anti-screenshot, room summary REST API,
 * AI connections, and the external-service registry list.
 * Extracted from `MatrixRoomService` as part of the P1-1 split.
 */
export class MatrixRoomAccountDataService extends BaseMatrixService {
  async getRoomAccountData(roomId: string, eventType: string): Promise<Record<string, unknown> | null> {
    const client = this.getClient()
    try {
      const userId = client.getUserId()
      const path = `/user/${encodeURIComponent(userId ?? '')}/rooms/${encodeURIComponent(roomId)}/account_data/${encodeURIComponent(eventType)}`
      const result = await client.http.authedRequest('GET', path)
      return result as Record<string, unknown>
    } catch (err) {
      logger.error(`[MatrixRoom] 获取房间 account data 失败: ${err}`)
      return null
    }
  }

  async setRoomAccountData(roomId: string, eventType: string, content: Record<string, unknown>): Promise<void> {
    const client = this.getClient()
    try {
      const userId = client.getUserId()
      const path = `/user/${encodeURIComponent(userId ?? '')}/rooms/${encodeURIComponent(roomId)}/account_data/${encodeURIComponent(eventType)}`
      await client.http.authedRequest('PUT', path, undefined, content)
      logger.info(`[MatrixRoom] 设置房间 account data 成功: ${roomId}/${eventType}`)
    } catch (err) {
      logger.error(`[MatrixRoom] 设置房间 account data 失败: ${err}`)
      throw err
    }
  }

  async getReportScannerInfo(roomId: string, eventId: string): Promise<Record<string, unknown> | null> {
    const client = this.getClient()
    try {
      const result = await authedRequestWithPath<Record<string, unknown>>(
        client,
        'GET',
        MATRIX_PATHS.ROOM.REPORT_SCANNER_INFO(roomId, eventId)
      )
      return result as Record<string, unknown>
    } catch (err) {
      logger.error(`[MatrixRoom] 获取内容扫描信息失败: ${err}`)
      return null
    }
  }

  // ==================== Vault (安全保险库) ====================

  async getVaultData(roomId: string): Promise<Record<string, unknown>> {
    const client = this.getClient()
    try {
      const result = await client.http.authedRequest('GET', MATRIX_PATHS.ROOM.VAULT_DATA(roomId))
      return result as Record<string, unknown>
    } catch (err) {
      logger.error(`[MatrixRoom] 获取保险库数据失败: ${err}`)
      return {}
    }
  }

  async setVaultData(roomId: string, content: Record<string, unknown>): Promise<void> {
    const client = this.getClient()
    try {
      await client.http.authedRequest('PUT', MATRIX_PATHS.ROOM.VAULT_DATA(roomId), undefined, content)
      logger.info(`[MatrixRoom] 更新保险库数据成功: ${roomId}`)
    } catch (err) {
      logger.error(`[MatrixRoom] 更新保险库数据失败: ${err}`)
      throw err
    }
  }

  async setReadLifetime(roomId: string, lifetimeMs: number): Promise<void> {
    const client = this.getClient()
    try {
      await client.http.authedRequest('PUT', `/rooms/${encodeURIComponent(roomId)}/burn`, undefined, {
        enabled: true,
        burn_after_ms: lifetimeMs
      })
      logger.info(`[MatrixRoom] 设置阅后即焚成功: ${roomId} (${lifetimeMs}ms)`)
    } catch (err) {
      logger.error(`[MatrixRoom] 设置阅后即焚失败: ${err}`)
      throw err
    }
  }

  async getExternalServices(): Promise<Array<Record<string, unknown>>> {
    const client = this.getClient()
    const adminPaths = [MATRIX_PATHS.ADMIN.EXTERNAL_SERVICES, MATRIX_PATHS.ADMIN.MATRIX_EXTERNAL_SERVICES]
    for (const path of adminPaths) {
      try {
        const result = await client.http.authedRequest('GET', path)
        const services =
          result && typeof result === 'object' && 'services' in result
            ? (result as { services: Array<Record<string, unknown>> }).services
            : result && typeof result === 'object' && 'data' in result
              ? (result as { data: Array<Record<string, unknown>> }).data
              : (result as Array<Record<string, unknown>>)
        return Array.isArray(services) ? services : []
      } catch (err) {
        logger.warn('Account data operation failed:', err)
      }
    }
    logger.error('[MatrixRoom] 获取外部服务列表失败: Admin API not available')
    return []
  }

  // ==================== Anti-Screenshot ====================

  async getAntiScreenshot(roomId: string): Promise<{ enabled: boolean }> {
    const client = this.getClient()
    try {
      const result = await client.http.authedRequest('GET', MATRIX_PATHS.ROOM.ANTI_SCREENSHOT(roomId))
      const data = result as { enabled?: boolean }
      return { enabled: data.enabled ?? false }
    } catch (err) {
      logger.error(`[MatrixRoom] 获取防截屏设置失败: ${err}`)
      return { enabled: false }
    }
  }

  async setAntiScreenshot(roomId: string, enabled: boolean): Promise<void> {
    const client = this.getClient()
    try {
      await client.http.authedRequest('PUT', MATRIX_PATHS.ROOM.ANTI_SCREENSHOT(roomId), undefined, { enabled })
      logger.info(`[MatrixRoom] 设置防截屏成功: ${roomId} (enabled=${enabled})`)
    } catch (err) {
      logger.error(`[MatrixRoom] 设置防截屏失败: ${err}`)
      throw err
    }
  }

  // ==================== Burn (阅后即焚) ====================

  async getBurnStats(): Promise<{ total: number; active: number }> {
    const client = this.getClient()
    try {
      const result = await client.http.authedRequest('GET', MATRIX_PATHS.BURN.STATS)
      const data = result as { total?: number; active?: number }
      return { total: data.total ?? 0, active: data.active ?? 0 }
    } catch (err) {
      logger.error(`[MatrixRoom] 获取阅后即焚统计失败: ${err}`)
      return { total: 0, active: 0 }
    }
  }

  async burnRoom(roomId: string): Promise<void> {
    const client = this.getClient()
    try {
      await client.http.authedRequest('POST', MATRIX_PATHS.BURN.ROOM_BURN(roomId))
      logger.info(`[MatrixRoom] 立即焚毁房间成功: ${roomId}`)
    } catch (err) {
      logger.error(`[MatrixRoom] 立即焚毁房间失败: ${err}`)
      throw err
    }
  }

  // ==================== Room Summary REST API ====================

  async getRoomSummary(roomId: string): Promise<RoomSummary | null> {
    try {
      return await matrixRoomSummaryService.getRoomSummary(roomId)
    } catch (err) {
      logger.error(`[MatrixRoom] 获取房间摘要失败: ${err}`)
      return null
    }
  }

  async getRoomSummaryMembers(roomId: string): Promise<unknown> {
    const client = this.getClient()
    try {
      const result = await client.http.authedRequest('GET', MATRIX_PATHS.ROOM.SUMMARY_MEMBERS(roomId))
      return result
    } catch (err) {
      logger.error(`[MatrixRoom] 获取房间摘要成员失败: ${err}`)
      throw err
    }
  }

  async getRoomSummaryState(roomId: string): Promise<unknown> {
    const client = this.getClient()
    try {
      const result = await client.http.authedRequest('GET', MATRIX_PATHS.ROOM.SUMMARY_STATE(roomId))
      return result
    } catch (err) {
      logger.error(`[MatrixRoom] 获取房间摘要状态失败: ${err}`)
      throw err
    }
  }

  // ==================== AI Connections ====================

  async getAIConnections(): Promise<AIConnection[]> {
    try {
      return await matrixAIConnectionService.listConnections()
    } catch (err) {
      logger.error(`[MatrixRoom] 获取 AI 连接列表失败: ${err}`)
      throw err
    }
  }

  async createAIConnection(config: Record<string, unknown>): Promise<AIConnection> {
    try {
      const id = await matrixAIConnectionService.createConnection(
        config as unknown as Parameters<typeof matrixAIConnectionService.createConnection>[0]
      )
      return await matrixAIConnectionService.getConnection(id)
    } catch (err) {
      logger.error(`[MatrixRoom] 创建 AI 连接失败: ${err}`)
      throw err
    }
  }

  async deleteAIConnection(id: string): Promise<void> {
    try {
      await matrixAIConnectionService.deleteConnection(id)
    } catch (err) {
      logger.error(`[MatrixRoom] 删除 AI 连接失败: ${err}`)
      throw err
    }
  }

  async getMCPTools(): Promise<MCPTool[]> {
    try {
      return await matrixAIConnectionService.listMcpTools()
    } catch (err) {
      logger.error(`[MatrixRoom] 获取 MCP 工具列表失败: ${err}`)
      throw err
    }
  }

  async callMCPTool(toolId: string, params: Record<string, unknown>): Promise<unknown> {
    try {
      return await matrixAIConnectionService.callMcpTool({ tool: toolId, parameters: params })
    } catch (err) {
      logger.error(`[MatrixRoom] 调用 MCP 工具失败: ${err}`)
      throw err
    }
  }

  // === P2-8 事件签名与验证 ===

  async signEvent(roomId: string, eventId: string): Promise<{ signature: string; signed_by: string }> {
    const client = this.getClient()
    const path = `/rooms/${encodeURIComponent(roomId)}/sign/${encodeURIComponent(eventId)}`
    try {
      const result = await client.http.authedRequest('PUT', path)
      logger.info(`[MatrixRoom] 事件签名成功: ${roomId}/${eventId}`)
      return result as { signature: string; signed_by: string }
    } catch (err) {
      logger.error(`[MatrixRoom] 事件签名失败: ${err}`)
      throw err
    }
  }

  async verifyEvent(roomId: string, eventId: string): Promise<{ valid: boolean; verifier: string }> {
    const client = this.getClient()
    const path = `/rooms/${encodeURIComponent(roomId)}/verify/${encodeURIComponent(eventId)}`
    try {
      const result = await client.http.authedRequest('POST', path)
      logger.info(`[MatrixRoom] 事件验证成功: ${roomId}/${eventId}`)
      return result as { valid: boolean; verifier: string }
    } catch (err) {
      logger.error(`[MatrixRoom] 事件验证失败: ${err}`)
      throw err
    }
  }

  // === P2-6 消息队列状态 ===

  async getMessageQueue(roomId: string): Promise<{ queue?: Array<{ event_id: string; type: string }> }> {
    const client = this.getClient()
    const path = `/rooms/${encodeURIComponent(roomId)}/message_queue`
    try {
      const result = await client.http.authedRequest('GET', path)
      return result as { queue?: Array<{ event_id: string; type: string }> }
    } catch (err) {
      logger.error(`[MatrixRoom] 获取消息队列失败: ${err}`)
      return {}
    }
  }

  // === P2-9 加密事件列表扩展 ===

  async getEncryptedEvents(roomId: string): Promise<{ events?: Array<Record<string, unknown>> }> {
    const client = this.getClient()
    const path = `/rooms/${encodeURIComponent(roomId)}/encrypted_events`
    try {
      const result = await client.http.authedRequest('GET', path)
      return result as { events?: Array<Record<string, unknown>> }
    } catch (err) {
      logger.error(`[MatrixRoom] 获取加密事件列表失败: ${err}`)
      return {}
    }
  }
}

export const matrixRoomAccountDataService = new MatrixRoomAccountDataService()
