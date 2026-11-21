import type {
  IContent,
  MatrixClient,
  RoomMessageQueueResult,
  RoomSignResult,
  RoomVaultDataResult
} from '@/services/matrix/sdk'
import { createLogger } from '@/utils/Logger'
import { unknownToObject } from '@/utils/typeGuard'
import { BaseMatrixService } from '../BaseMatrixService'
import { matrixBurnAfterReadService } from '../messaging/MatrixBurnAfterReadService'

const logger = createLogger('AccountDataService')

/**
 * AccountDataManager 实例类型。
 *
 * 注：`matrix-js-sdk/account-data` 子路径在 package.json exports 中未导出，
 * 但 MatrixClient.getAccountDataManager() 已在 matrix-client-extensions.d.ts 中声明，
 * 这里通过 MatrixClient 访问器返回类型派生，保持与其他 Manager 一致的类型模式。
 */
type AccountDataManagerInstance = ReturnType<NonNullable<MatrixClient['getAccountDataManager']>>

/**
 * 房间摘要成员条目（与 SDK `RoomSummaryMember` 同形）。
 */
export interface RoomSummaryMemberEntry {
  user_id: string
  display_name?: string
  avatar_url?: string
  membership: string
  is_hero: boolean
}

/**
 * 房间摘要状态条目（与 SDK `IRoomSummaryState` 同形）。
 */
export interface RoomSummaryStateEntry {
  event_type: string
  state_key: string
  event_id?: string
  content: unknown
}

/** 保险库数据（复用 SDK `RoomVaultDataResult`；读取失败时降级为空对象）。 */
export type RoomVaultDataOutcome = Partial<RoomVaultDataResult>

/**
 * 内容扫描信息（后端 `/report/:eventId/scanner_info` 返回，SDK 声明为通用对象）。
 */
export interface ContentScannerInfo {
  clean: boolean
  scanned_at: number
}

/** 加密事件列表条目（与 SDK `EncryptedEventsResult.events` 同形）。 */
export interface EncryptedRoomEvent {
  event_id: string
  sender: string
  type: string
  content: IContent
  timestamp: number
  algorithm?: string
  session_id?: string
}

/** 加密事件列表（读取失败时降级为空对象）。 */
export interface EncryptedEventsOutcome {
  events?: EncryptedRoomEvent[]
  next_batch?: string
}

/** 事件签名结果（复用 SDK `RoomSignResult`）。 */
export type RoomSignOutcome = RoomSignResult

/** 消息队列条目（组件按 `queue` 读取，见 RoomMessageQueuePanel）。 */
export interface RoomMessageQueueEntry {
  event_id: string
  type: string
  content?: unknown
}

/** 消息队列响应：保留 SDK 字段，并补充组件实际消费的 `queue`。 */
export interface RoomMessageQueueOutcome extends RoomMessageQueueResult {
  queue?: RoomMessageQueueEntry[]
}

/**
 * Room account-data / reporting / retention domain service.
 *
 * Covers per-user-per-room account_data, content-scanner reports,
 * read-lifetime (阅后即焚), anti-screenshot, room summary REST API,
 * and the external-service registry list.
 * Extracted from `MatrixRoomService` as part of the P1-1 split.
 */
export class MatrixRoomAccountDataService extends BaseMatrixService {
  private getAccountDataMgr(): AccountDataManagerInstance {
    const client = this.getClient()
    const fn = (client as { getAccountDataManager?: () => AccountDataManagerInstance }).getAccountDataManager
    if (typeof fn !== 'function') {
      throw new Error('MatrixClient.getAccountDataManager is not available; SDK 未初始化')
    }
    return fn.call(client)
  }

  async getRoomAccountData(roomId: string, eventType: string): Promise<IContent | null> {
    // getClient() 在 try 之外调用，保持原行为：客户端未初始化时抛错而非返回 null
    const mgr = this.getAccountDataMgr()
    try {
      const event = await mgr.getRoomAccountDataFromServer(roomId, eventType)
      if (!event) return null
      return event.getContent() ?? null
    } catch (err) {
      logger.error(`[MatrixRoom] 获取房间 account data 失败: ${err}`)
      return null
    }
  }

  async setRoomAccountData(roomId: string, eventType: string, content: IContent): Promise<void> {
    const mgr = this.getAccountDataMgr()
    try {
      await mgr.setRoomAccountData(roomId, eventType, content)
      logger.info(`[MatrixRoom] 设置房间 account data 成功: ${roomId}/${eventType}`)
    } catch (err) {
      logger.error(`[MatrixRoom] 设置房间 account data 失败: ${err}`)
      throw err
    }
  }

  async getReportScannerInfo(roomId: string, eventId: string): Promise<ContentScannerInfo | null> {
    const client = this.getClient()
    try {
      const result = await client.getReportingManager().getScannerInfo(roomId, eventId)
      return unknownToObject<ContentScannerInfo>(result)
    } catch (err) {
      logger.error(`[MatrixRoom] 获取内容扫描信息失败: ${err}`)
      return null
    }
  }

  // ==================== Vault (安全保险库) ====================

  /** 获取保险库数据
   */
  async getVaultData(roomId: string, throwOnError = false): Promise<RoomVaultDataOutcome> {
    const client = this.getClient()
    try {
      const result = await client.getRoomSummaryManager().getRoomVaultData(roomId)
      return result ?? {}
    } catch (err) {
      logger.error(`[MatrixRoom] 获取保险库数据失败: ${err}`)
      if (throwOnError) throw err
      return {}
    }
  }

  /** 设置保险库数据
   */
  async setVaultData(roomId: string, content: IContent): Promise<void> {
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

  async getRoomSummaryMembers(roomId: string): Promise<RoomSummaryMemberEntry[]> {
    const client = this.getClient()
    try {
      return await client.getRoomSummaryManager().getRoomSummaryMembers(roomId)
    } catch (err) {
      logger.error(`[MatrixRoom] 获取房间摘要成员失败: ${err}`)
      throw err
    }
  }

  async getRoomSummaryState(roomId: string): Promise<RoomSummaryStateEntry[]> {
    const client = this.getClient()
    try {
      return await client.getRoomSummaryManager().getAllSummaryState(roomId)
    } catch (err) {
      logger.error(`[MatrixRoom] 获取房间摘要状态失败: ${err}`)
      throw err
    }
  }

  // === P2-8 事件签名与验证 ===

  /** 签名事件
   */
  async signEvent(roomId: string, eventId: string): Promise<RoomSignOutcome> {
    const client = this.getClient()
    try {
      const result = await client.getRoomSummaryManager().signRoomEvent(roomId, eventId)
      logger.info(`[MatrixRoom] 事件签名成功: ${roomId}/${eventId}`)
      return result
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
  async getMessageQueue(roomId: string): Promise<RoomMessageQueueOutcome> {
    const client = this.getClient()
    try {
      const result = await client.getRoomSummaryManager().getRoomMessageQueue(roomId)
      return result
    } catch (err) {
      logger.error(`[MatrixRoom] 获取消息队列失败: ${err}`)
      return {}
    }
  }

  // === P2-9 加密事件列表扩展 ===

  /** 获取加密事件数据
   */
  async getEncryptedEvents(roomId: string): Promise<EncryptedEventsOutcome> {
    const client = this.getClient()
    try {
      const result = await client.getRoomSummaryManager().getEncryptedEvents(roomId)
      return result as EncryptedEventsOutcome
    } catch (err) {
      logger.error(`[MatrixRoom] 获取加密事件列表失败: ${err}`)
      return {}
    }
  }
}

export const matrixRoomAccountDataService = new MatrixRoomAccountDataService()
