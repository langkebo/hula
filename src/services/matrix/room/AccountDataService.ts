import type { MatrixClient } from '@/services/matrix/sdk'
import { createLogger } from '@/utils/Logger'
import { type AIConnectionInfo, type McpTool, matrixAIConnectionService } from '../ai/MatrixAIConnectionService'
import { BaseMatrixService } from '../BaseMatrixService'
import { matrixBurnAfterReadService } from '../messaging/MatrixBurnAfterReadService'
import { matrixRoomSummaryService, type RoomSummary } from './MatrixRoomSummaryService'

const logger = createLogger('AccountDataService')

type AIConnection = AIConnectionInfo
type MCPTool = McpTool

/**
 * AccountDataManager 实例类型。
 *
 * 注：`matrix-js-sdk/account-data` 子路径在 package.json exports 中未导出，
 * 但 MatrixClient.getAccountDataManager() 已在 matrix-client-extensions.d.ts 中声明，
 * 这里通过 MatrixClient 访问器返回类型派生，保持与其他 Manager 一致的类型模式。
 */
type AccountDataManagerInstance = ReturnType<NonNullable<MatrixClient['getAccountDataManager']>>

/**
 * Room account-data / reporting / retention domain service.
 *
 * Covers per-user-per-room account_data, content-scanner reports,
 * read-lifetime (阅后即焚), anti-screenshot, room summary REST API,
 * AI connections, and the external-service registry list.
 * Extracted from `MatrixRoomService` as part of the P1-1 split.
 */
export class MatrixRoomAccountDataService extends BaseMatrixService {
  private getAccountDataMgr(): AccountDataManagerInstance {
    const client = this.getClient()
    const fn = (client as unknown as { getAccountDataManager?: () => AccountDataManagerInstance }).getAccountDataManager
    if (typeof fn !== 'function') {
      throw new Error('MatrixClient.getAccountDataManager is not available; SDK 未初始化')
    }
    return fn.call(client)
  }

  async getRoomAccountData(roomId: string, eventType: string): Promise<Record<string, unknown> | null> {
    // getClient() 在 try 之外调用，保持原行为：客户端未初始化时抛错而非返回 null
    const mgr = this.getAccountDataMgr()
    try {
      const event = await mgr.getRoomAccountDataFromServer(roomId, eventType)
      if (!event) return null
      return (event.getContent() as Record<string, unknown>) ?? null
    } catch (err) {
      logger.error(`[MatrixRoom] 获取房间 account data 失败: ${err}`)
      return null
    }
  }

  async setRoomAccountData(roomId: string, eventType: string, content: Record<string, unknown>): Promise<void> {
    const mgr = this.getAccountDataMgr()
    try {
      await mgr.setRoomAccountData(roomId, eventType, content)
      logger.info(`[MatrixRoom] 设置房间 account data 成功: ${roomId}/${eventType}`)
    } catch (err) {
      logger.error(`[MatrixRoom] 设置房间 account data 失败: ${err}`)
      throw err
    }
  }

  async getReportScannerInfo(roomId: string, eventId: string): Promise<Record<string, unknown> | null> {
    const client = this.getClient()
    try {
      const result = await client.getReportingManager().getScannerInfo(roomId, eventId)
      return result as Record<string, unknown>
    } catch (err) {
      logger.error(`[MatrixRoom] 获取内容扫描信息失败: ${err}`)
      return null
    }
  }

  // ==================== Vault (安全保险库) ====================

  /** 获取保险库数据
   */
  async getVaultData(roomId: string): Promise<Record<string, unknown>> {
    const client = this.getClient()
    try {
      const result = await client.getRoomSummaryManager().getRoomVaultData(roomId)
      return (result ?? {}) as unknown as Record<string, unknown>
    } catch (err) {
      logger.error(`[MatrixRoom] 获取保险库数据失败: ${err}`)
      return {}
    }
  }

  /** 设置保险库数据
   */
  async setVaultData(roomId: string, content: Record<string, unknown>): Promise<void> {
    const client = this.getClient()
    try {
      await client.getRoomSummaryManager().setRoomVaultData(roomId, content)
      logger.info(`[MatrixRoom] 更新保险库数据成功: ${roomId}`)
    } catch (err) {
      logger.error(`[MatrixRoom] 更新保险库数据失败: ${err}`)
      throw err
    }
  }

  async setReadLifetime(roomId: string, lifetimeMs: number): Promise<void> {
    try {
      await matrixBurnAfterReadService.enableBurn(roomId, lifetimeMs, true)
      logger.info(`[MatrixRoom] 设置阅后即焚成功: ${roomId} (${lifetimeMs}ms)`)
    } catch (err) {
      logger.error(`[MatrixRoom] 设置阅后即焚失败: ${err}`)
      throw err
    }
  }

  async getExternalServices(): Promise<Array<Record<string, unknown>>> {
    const client = this.getClient()
    try {
      const result = await client.getExternalServiceManager().listServices()
      const services = result?.services
      return Array.isArray(services) ? (services as unknown as Array<Record<string, unknown>>) : []
    } catch (err) {
      logger.warn('Account data operation failed:', err)
      return []
    }
  }

  // ==================== Anti-Screenshot ====================

  async getAntiScreenshot(roomId: string): Promise<{ enabled: boolean }> {
    const client = this.getClient()
    try {
      return await client.getRoomSummaryManager().getAntiScreenshot(roomId)
    } catch (err) {
      logger.error(`[MatrixRoom] 获取防截屏设置失败: ${err}`)
      return { enabled: false }
    }
  }

  async setAntiScreenshot(roomId: string, enabled: boolean): Promise<void> {
    const client = this.getClient()
    try {
      await client.getRoomSummaryManager().setAntiScreenshot(roomId, enabled)
      logger.info(`[MatrixRoom] 设置防截屏成功: ${roomId} (enabled=${enabled})`)
    } catch (err) {
      logger.error(`[MatrixRoom] 设置防截屏失败: ${err}`)
      throw err
    }
  }

  // ==================== Burn (阅后即焚) ====================

  async getBurnStats(): Promise<{ total: number; active: number }> {
    try {
      const stats = await matrixBurnAfterReadService.getBurnStats()
      return { total: stats.totalBurned, active: stats.totalPending }
    } catch (err) {
      logger.error(`[MatrixRoom] 获取阅后即焚统计失败: ${err}`)
      return { total: 0, active: 0 }
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
      return await client.getRoomSummaryManager().getRoomSummaryMembers(roomId)
    } catch (err) {
      logger.error(`[MatrixRoom] 获取房间摘要成员失败: ${err}`)
      throw err
    }
  }

  async getRoomSummaryState(roomId: string): Promise<unknown> {
    const client = this.getClient()
    try {
      return await client.getRoomSummaryManager().getAllSummaryState(roomId)
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

  /** 签名事件
   */
  async signEvent(roomId: string, eventId: string): Promise<Record<string, unknown>> {
    const client = this.getClient()
    try {
      const result = await client.getRoomSummaryManager().signRoomEvent(roomId, eventId)
      logger.info(`[MatrixRoom] 事件签名成功: ${roomId}/${eventId}`)
      return result as unknown as Record<string, unknown>
    } catch (err) {
      logger.error(`[MatrixRoom] 事件签名失败: ${err}`)
      throw err
    }
  }

  /** 验证事件签名
   */
  async verifyEvent(roomId: string, eventId: string): Promise<{ valid: boolean }> {
    const client = this.getClient()
    try {
      const result = await client.getRoomSummaryManager().verifyRoomEvent(roomId, eventId)
      logger.info(`[MatrixRoom] 事件验证成功: ${roomId}/${eventId}`)
      return { valid: Boolean(result.valid) }
    } catch (err) {
      logger.error(`[MatrixRoom] 事件验证失败: ${err}`)
      throw err
    }
  }

  // === P2-6 消息队列状态 ===

  /** 获取消息队列数据
   */
  async getMessageQueue(roomId: string): Promise<Record<string, unknown>> {
    const client = this.getClient()
    try {
      const result = await client.getRoomSummaryManager().getRoomMessageQueue(roomId)
      return result as unknown as Record<string, unknown>
    } catch (err) {
      logger.error(`[MatrixRoom] 获取消息队列失败: ${err}`)
      return {}
    }
  }

  // === P2-9 加密事件列表扩展 ===

  /** 获取加密事件数据
   */
  async getEncryptedEvents(roomId: string): Promise<{ events?: Array<Record<string, unknown>> }> {
    const client = this.getClient()
    try {
      const result = await client.getRoomSummaryManager().getEncryptedEvents(roomId)
      return result as { events?: Array<Record<string, unknown>> }
    } catch (err) {
      logger.error(`[MatrixRoom] 获取加密事件列表失败: ${err}`)
      return {}
    }
  }
}

export const matrixRoomAccountDataService = new MatrixRoomAccountDataService()
