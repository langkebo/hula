/**
 * 媒体回调与账户数据回调服务（Admin）
 *
 * 对应 synapse-rust 的五条回调端点，全部复用 SDK `AdminConfigManager`（R1：不另建 HTTP 调用）。
 *
 * 路由清单：
 *   GET  /media_callbacks                       媒体回调任务记录（裸数组）
 *   GET  /media_callbacks?callback_type=xxx     按类型过滤任务记录
 *   POST /media_callbacks                       注册媒体回调
 *   GET  /account_data_callbacks                账户数据回调配置（裸数组）
 *   POST /account_data_callbacks                注册账户数据回调
 *
 * 注意：两个列表端点返回的都是裸数组，不存在 `{callbacks, total}` 包装。
 */
import type { AdminConfigManager } from '@/services/matrix/sdk'
import { createLogger } from '@/utils/Logger'
import { BaseMatrixService } from '../BaseMatrixService'

const logger = createLogger('AdminCallback')

/** 媒体回调任务执行记录。 */
export type AdminMediaCallback = Awaited<ReturnType<AdminConfigManager['listMediaCallbacks']>>[number]

/** `POST /media_callbacks` 的请求体。 */
export type CreateMediaCallbackRequest = Parameters<AdminConfigManager['createMediaCallback']>[0]

/** 账户数据回调配置项。 */
export type AdminAccountDataCallback = Awaited<ReturnType<AdminConfigManager['listAccountDataCallbacks']>>[number]

/** `POST /account_data_callbacks` 的请求体。 */
export type CreateAccountDataCallbackRequest = Parameters<AdminConfigManager['createAccountDataCallback']>[0]

/** 媒体回调与账户数据回调管理。 */
export class AdminCallbackService extends BaseMatrixService {
  private getManager() {
    return this.getClient().getAdminManager()
  }

  /** 列出全部媒体回调任务记录。 */
  async listMediaCallbacks(): Promise<AdminMediaCallback[]> {
    try {
      return await this.getManager().config.listMediaCallbacks()
    } catch (err) {
      logger.error(`[AdminCallback] listMediaCallbacks 失败: ${err}`)
      throw err
    }
  }

  /** 按 `callback_type` 过滤媒体回调任务记录。 */
  async listMediaCallbacksByType(callbackType: string): Promise<AdminMediaCallback[]> {
    try {
      return await this.getManager().config.listMediaCallbacksByType(callbackType)
    } catch (err) {
      logger.error(`[AdminCallback] listMediaCallbacksByType 失败: ${err}`)
      throw err
    }
  }

  /** 注册一个媒体回调配置。 */
  async createMediaCallback(payload: CreateMediaCallbackRequest): Promise<AdminMediaCallback> {
    try {
      return await this.getManager().config.createMediaCallback(payload)
    } catch (err) {
      logger.error(`[AdminCallback] createMediaCallback 失败: ${err}`)
      throw err
    }
  }

  /** 列出全部账户数据回调配置。 */
  async listAccountDataCallbacks(): Promise<AdminAccountDataCallback[]> {
    try {
      return await this.getManager().config.listAccountDataCallbacks()
    } catch (err) {
      logger.error(`[AdminCallback] listAccountDataCallbacks 失败: ${err}`)
      throw err
    }
  }

  /** 注册一个账户数据回调配置（后端无 `callback_type`，按 `data_types` 过滤）。 */
  async createAccountDataCallback(payload: CreateAccountDataCallbackRequest): Promise<AdminAccountDataCallback> {
    try {
      return await this.getManager().config.createAccountDataCallback(payload)
    } catch (err) {
      logger.error(`[AdminCallback] createAccountDataCallback 失败: ${err}`)
      throw err
    }
  }
}

export const adminCallbackService = new AdminCallbackService()
