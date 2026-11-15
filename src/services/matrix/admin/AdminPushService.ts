/**
 * 推送配置与队列维护服务（Admin）
 *
 * 对应 synapse-rust 的四条推送运维端点，全部复用 SDK `AdminPushManager`（R1：不另建 HTTP 调用）。
 *
 * 路由清单：
 *   GET  /push/config          读取推送配置（敏感值以掩码返回）
 *   POST /push/config          更新推送配置（值为 null 表示清除该项）
 *   POST /push/process-queue   手动消费推送队列
 *   POST /push/cleanup-logs    清理推送日志
 *
 * 注意：`getConfig()` 返回的 `config` 中敏感项是掩码字符串，不可原样回写，
 * 只能提交需要变更的键；需要清除某键时传 `null`。
 */
import type { AdminPushManager } from '@/services/matrix/sdk'
import { createLogger } from '@/utils/Logger'
import { BaseMatrixService } from '../BaseMatrixService'

const logger = createLogger('AdminPush')

/** 推送配置读取结果。 */
export type PushConfigResponse = Awaited<ReturnType<AdminPushManager['getConfig']>>

/** 推送配置更新结果。 */
export type PushConfigUpdateResponse = Awaited<ReturnType<AdminPushManager['setConfig']>>

/** `POST /push/config` 的请求体。 */
export type PushConfigPatchRequest = Parameters<AdminPushManager['setConfig']>[0]

/** 队列消费结果。 */
export type PushProcessQueueResponse = Awaited<ReturnType<AdminPushManager['processQueue']>>

/** 日志清理结果。 */
export type PushCleanupLogsResponse = Awaited<ReturnType<AdminPushManager['cleanupLogs']>>

/** 推送配置与队列维护。 */
export class AdminPushService extends BaseMatrixService {
  private getManager() {
    return this.getClient().getAdminManager()
  }

  /** 读取推送配置。 */
  async getConfig(): Promise<PushConfigResponse> {
    try {
      return await this.getManager().push.getConfig()
    } catch (err) {
      logger.error(`[AdminPush] getConfig 失败: ${err}`)
      throw err
    }
  }

  /** 更新推送配置（仅提交需要变更的键，`null` 表示清除）。 */
  async setConfig(patch: PushConfigPatchRequest): Promise<PushConfigUpdateResponse> {
    try {
      return await this.getManager().push.setConfig(patch)
    } catch (err) {
      logger.error(`[AdminPush] setConfig 失败: ${err}`)
      throw err
    }
  }

  /** 手动消费推送队列。 */
  async processQueue(batchSize?: number): Promise<PushProcessQueueResponse> {
    try {
      return await this.getManager().push.processQueue(batchSize)
    } catch (err) {
      logger.error(`[AdminPush] processQueue 失败: ${err}`)
      throw err
    }
  }

  /** 清理推送日志。 */
  async cleanupLogs(days?: number): Promise<PushCleanupLogsResponse> {
    try {
      return await this.getManager().push.cleanupLogs(days)
    } catch (err) {
      logger.error(`[AdminPush] cleanupLogs 失败: ${err}`)
      throw err
    }
  }
}

export const adminPushService = new AdminPushService()
