/**
 * 后台更新管理服务（Admin）
 *
 * 对应 synapse-rust 的 `/_synapse/admin/v1/background_updates/*` 路由，
 * 提供后台任务（如数据库迁移、索引重建）的查询与生命周期管理。
 *
 * 封装：委托 SDK `client.getBackgroundUpdateManager()`（`BackgroundUpdateManager`），
 * 不再直接 `http.authedRequest` 拼路径。
 */
import type { MatrixClient } from 'matrix-js-sdk'
import { createLogger } from '@/utils/Logger'

const logger = createLogger('AdminBackgroundUpdate')

type GetClientGetter = () => MatrixClient

/** 后台更新任务实体（对应后端 UpdateResponse）。 */
export interface BackgroundUpdate {
  job_name: string
  job_type: string
  description?: string | null
  table_name?: string | null
  status: string
  progress: unknown
  total_items: number
  processed_items: number
  created_ts: number
  started_ts?: number | null
  completed_ts?: number | null
  error_message?: string | null
  retry_count: number
}

/** 后台更新任务历史记录。 */
export interface BackgroundUpdateHistory {
  id: number
  job_name: string
  execution_start_ts: number
  execution_end_ts?: number | null
  status: string
  items_processed: number
  error_message?: string | null
}

/** 后台更新任务统计信息。 */
export interface BackgroundUpdateStats {
  id: number
  job_name: string
  total_updates: number
  completed_updates: number
  failed_updates: number
  last_run_ts?: number | null
  next_run_ts?: number | null
  average_duration_ms: number
  created_ts: number
  updated_ts: number
}

/** 创建后台更新任务的请求体。 */
export interface CreateBackgroundUpdateRequest {
  job_name: string
  job_type: string
  description?: string
  table_name?: string
  column_name?: string
  total_items?: number
  batch_size?: number
  sleep_ms?: number
  depends_on?: string[]
  metadata?: Record<string, unknown>
}

/** 后台更新汇总状态。 */
export interface BackgroundUpdateStatusSummary {
  pending_count: number
  running_count: number
  completed_count: number
  failed_count: number
  total_count: number
  current_update: BackgroundUpdate | null
}

/** 重试失败任务的结果。 */
export interface RetryFailedResult {
  retried_count: number
}

/** 清理过期锁的结果。 */
export interface CleanupLocksResult {
  cleaned_count: number
}

/** 列表查询参数。 */
export interface ListUpdatesParams {
  limit?: number
  from?: string
}

/** 历史查询参数。 */
export interface GetHistoryParams {
  limit?: number
  from?: string
}

/** 统计查询参数（limit 表示最近多少天）。 */
export interface GetStatsParams {
  limit?: number
}

export class AdminBackgroundUpdateService {
  constructor(private readonly getClient: GetClientGetter) {}

  private getManager() {
    return this.getClient().getBackgroundUpdateManager()
  }

  /**
   * 获取后台更新任务列表。
   */
  async listUpdates(params: ListUpdatesParams = {}): Promise<{ updates: BackgroundUpdate[]; next_batch?: string }> {
    try {
      const result = await this.getManager().listBackgroundUpdates({
        limit: params.limit ?? 100,
        ...(params.from ? { from: params.from } : {})
      })
      return {
        updates: (result?.updates ?? []) as BackgroundUpdate[],
        next_batch: result?.next_batch ?? undefined
      }
    } catch (err) {
      logger.error(`[AdminBackgroundUpdate] listUpdates 失败: ${err}`)
      return { updates: [] }
    }
  }

  /**
   * 获取单个后台更新任务详情。404 时返回 null。
   */
  async getUpdate(jobName: string): Promise<BackgroundUpdate | null> {
    try {
      return (await this.getManager().getUpdate(jobName)) as BackgroundUpdate
    } catch (err) {
      const status = (err as { httpStatus?: number }).httpStatus
      if (status === 404) {
        return null
      }
      logger.error(`[AdminBackgroundUpdate] getUpdate 失败: ${err}`)
      return null
    }
  }

  /**
   * 创建后台更新任务。
   */
  async createUpdate(request: CreateBackgroundUpdateRequest): Promise<BackgroundUpdate> {
    const result = await this.getManager().createBackgroundUpdate(request)
    logger.info(`[AdminBackgroundUpdate] 创建任务: ${request.job_name}`)
    return result as BackgroundUpdate
  }

  /**
   * 启动一个 pending 状态的任务。
   */
  async startUpdate(jobName: string): Promise<BackgroundUpdate> {
    const result = await this.getManager().startUpdate(jobName)
    logger.info(`[AdminBackgroundUpdate] 启动任务: ${jobName}`)
    return result as BackgroundUpdate
  }

  /**
   * 取消一个尚未完成的任务。
   */
  async cancelUpdate(jobName: string): Promise<BackgroundUpdate> {
    const result = await this.getManager().cancelUpdate(jobName)
    logger.info(`[AdminBackgroundUpdate] 取消任务: ${jobName}`)
    return result as BackgroundUpdate
  }

  /**
   * 标记任务完成。
   */
  async completeUpdate(jobName: string): Promise<BackgroundUpdate> {
    const result = await this.getManager().completeUpdate(jobName)
    logger.info(`[AdminBackgroundUpdate] 完成任务: ${jobName}`)
    return result as BackgroundUpdate
  }

  /**
   * 标记任务失败并记录错误信息。
   */
  async failUpdate(jobName: string, errorMessage: string): Promise<BackgroundUpdate> {
    const result = await this.getManager().failUpdate(jobName, { error_message: errorMessage })
    logger.warn(`[AdminBackgroundUpdate] 任务失败: ${jobName} -> ${errorMessage}`)
    return result as BackgroundUpdate
  }

  /**
   * 删除任务记录（不会取消运行中的任务）。
   */
  async deleteUpdate(jobName: string): Promise<void> {
    await this.getManager().deleteUpdate(jobName)
    logger.info(`[AdminBackgroundUpdate] 删除任务: ${jobName}`)
  }

  /**
   * 重试所有失败状态的任务。
   */
  async retryFailed(): Promise<RetryFailedResult> {
    const result = await this.getManager().retryFailedUpdates()
    logger.info(`[AdminBackgroundUpdate] 重试失败任务: ${result?.retried_count ?? 0}`)
    return result ?? { retried_count: 0 }
  }

  /**
   * 清理过期的任务锁。
   */
  async cleanupLocks(): Promise<CleanupLocksResult> {
    const result = await this.getManager().cleanupLocks()
    logger.info(`[AdminBackgroundUpdate] 清理过期锁: ${result?.cleaned_count ?? 0}`)
    return result ?? { cleaned_count: 0 }
  }

  /**
   * 获取后台更新汇总状态（pending/running/completed/failed/total 计数 + 当前任务）。
   */
  async getStatus(): Promise<BackgroundUpdateStatusSummary> {
    try {
      const result = await this.getManager().getStatus()
      return (
        (result as BackgroundUpdateStatusSummary) ?? {
          pending_count: 0,
          running_count: 0,
          completed_count: 0,
          failed_count: 0,
          total_count: 0,
          current_update: null
        }
      )
    } catch (err) {
      logger.error(`[AdminBackgroundUpdate] getStatus 失败: ${err}`)
      return {
        pending_count: 0,
        running_count: 0,
        completed_count: 0,
        failed_count: 0,
        total_count: 0,
        current_update: null
      }
    }
  }

  /**
   * 获取指定任务的执行历史。
   */
  async getHistory(jobName: string, params: GetHistoryParams = {}): Promise<BackgroundUpdateHistory[]> {
    try {
      const result = await this.getManager().getHistory(jobName, { limit: params.limit ?? 100 })
      return (result ?? []) as BackgroundUpdateHistory[]
    } catch (err) {
      logger.error(`[AdminBackgroundUpdate] getHistory 失败: ${err}`)
      return []
    }
  }

  /**
   * 获取任务统计信息（最近 N 天）。
   */
  async getStats(params: GetStatsParams = {}): Promise<BackgroundUpdateStats[]> {
    try {
      const result = await this.getManager().getStats(params.limit ?? 30)
      return (result ?? []) as BackgroundUpdateStats[]
    } catch (err) {
      logger.error(`[AdminBackgroundUpdate] getStats 失败: ${err}`)
      return []
    }
  }
}
