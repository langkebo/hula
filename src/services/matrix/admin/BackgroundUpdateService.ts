/**
 * 后台更新管理服务（Admin）
 *
 * 对应 synapse-rust 的 `/_synapse/admin/v1/background_updates/*` 路由，
 * 提供后台任务（如数据库迁移、索引重建）的查询与生命周期管理。
 *
 * 路由清单：
 *   GET    /background_updates                         列表
 *   POST   /background_updates                         创建
 *   GET    /background_updates/count                   总数
 *   GET    /background_updates/pending                 pending 列表
 *   GET    /background_updates/running                 running 列表
 *   GET    /background_updates/next                    下一个待执行
 *   GET    /background_updates/status                  汇总状态
 *   POST   /background_updates/retry_failed            重试所有失败
 *   POST   /background_updates/cleanup_locks           清理过期锁
 *   GET    /background_updates/status/{status}/count   按状态计数
 *   GET    /background_updates/{job_name}              详情
 *   DELETE /background_updates/{job_name}              删除
 *   POST   /background_updates/{job_name}/start        启动
 *   POST   /background_updates/{job_name}/progress     更新进度
 *   POST   /background_updates/{job_name}/complete     完成
 *   POST   /background_updates/{job_name}/fail         失败
 *   POST   /background_updates/{job_name}/cancel       取消
 *   GET    /background_updates/{job_name}/history      历史
 *   GET    /background_updates/stats                   统计
 */
import type { MatrixClient } from 'matrix-js-sdk'
import { createLogger } from '@/utils/Logger'
import { MATRIX_PATHS } from '../paths'

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

const SYNAPSE_ADMIN_BASE = MATRIX_PATHS.ADMIN.SYNAPSE_ADMIN_BASE

export class AdminBackgroundUpdateService {
  constructor(private readonly getClient: GetClientGetter) {}

  private async adminRequest<TResponse>(
    method: 'GET' | 'POST' | 'PUT' | 'DELETE',
    path: string,
    queryParams?: Record<string, string | number | boolean | string[] | undefined>,
    body?: Record<string, unknown>
  ): Promise<TResponse> {
    const client = this.getClient()
    return client.http.authedRequest(
      method,
      path,
      queryParams,
      method === 'GET' || method === 'DELETE' ? undefined : body,
      { prefix: SYNAPSE_ADMIN_BASE }
    ) as Promise<TResponse>
  }

  /**
   * 获取后台更新任务列表。
   */
  async listUpdates(params: ListUpdatesParams = {}): Promise<{ updates: BackgroundUpdate[]; next_batch?: string }> {
    try {
      const result = await this.adminRequest<{ updates: BackgroundUpdate[]; next_batch?: string }>(
        'GET',
        '/background_updates',
        {
          limit: params.limit ?? 100,
          ...(params.from ? { from: params.from } : {})
        }
      )
      return {
        updates: result?.updates ?? [],
        next_batch: result?.next_batch
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
      return await this.adminRequest<BackgroundUpdate>('GET', `/background_updates/${encodeURIComponent(jobName)}`)
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
    const result = await this.adminRequest<BackgroundUpdate>(
      'POST',
      '/background_updates',
      undefined,
      request as unknown as Record<string, unknown>
    )
    logger.info(`[AdminBackgroundUpdate] 创建任务: ${request.job_name}`)
    return result
  }

  /**
   * 启动一个 pending 状态的任务。
   */
  async startUpdate(jobName: string): Promise<BackgroundUpdate> {
    const result = await this.adminRequest<BackgroundUpdate>(
      'POST',
      `/background_updates/${encodeURIComponent(jobName)}/start`
    )
    logger.info(`[AdminBackgroundUpdate] 启动任务: ${jobName}`)
    return result
  }

  /**
   * 取消一个尚未完成的任务。
   */
  async cancelUpdate(jobName: string): Promise<BackgroundUpdate> {
    const result = await this.adminRequest<BackgroundUpdate>(
      'POST',
      `/background_updates/${encodeURIComponent(jobName)}/cancel`
    )
    logger.info(`[AdminBackgroundUpdate] 取消任务: ${jobName}`)
    return result
  }

  /**
   * 标记任务完成。
   */
  async completeUpdate(jobName: string): Promise<BackgroundUpdate> {
    const result = await this.adminRequest<BackgroundUpdate>(
      'POST',
      `/background_updates/${encodeURIComponent(jobName)}/complete`
    )
    logger.info(`[AdminBackgroundUpdate] 完成任务: ${jobName}`)
    return result
  }

  /**
   * 标记任务失败并记录错误信息。
   */
  async failUpdate(jobName: string, errorMessage: string): Promise<BackgroundUpdate> {
    const result = await this.adminRequest<BackgroundUpdate>(
      'POST',
      `/background_updates/${encodeURIComponent(jobName)}/fail`,
      undefined,
      { error_message: errorMessage }
    )
    logger.warn(`[AdminBackgroundUpdate] 任务失败: ${jobName} -> ${errorMessage}`)
    return result
  }

  /**
   * 删除任务记录（不会取消运行中的任务）。
   */
  async deleteUpdate(jobName: string): Promise<void> {
    await this.adminRequest<void>('DELETE', `/background_updates/${encodeURIComponent(jobName)}`)
    logger.info(`[AdminBackgroundUpdate] 删除任务: ${jobName}`)
  }

  /**
   * 重试所有失败状态的任务。
   */
  async retryFailed(): Promise<RetryFailedResult> {
    const result = await this.adminRequest<RetryFailedResult>('POST', '/background_updates/retry_failed')
    logger.info(`[AdminBackgroundUpdate] 重试失败任务: ${result?.retried_count ?? 0}`)
    return result ?? { retried_count: 0 }
  }

  /**
   * 清理过期的任务锁。
   */
  async cleanupLocks(): Promise<CleanupLocksResult> {
    const result = await this.adminRequest<CleanupLocksResult>('POST', '/background_updates/cleanup_locks')
    logger.info(`[AdminBackgroundUpdate] 清理过期锁: ${result?.cleaned_count ?? 0}`)
    return result ?? { cleaned_count: 0 }
  }

  /**
   * 获取后台更新汇总状态（pending/running/completed/failed/total 计数 + 当前任务）。
   */
  async getStatus(): Promise<BackgroundUpdateStatusSummary> {
    try {
      const result = await this.adminRequest<BackgroundUpdateStatusSummary>('GET', '/background_updates/status')
      return (
        result ?? {
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
      const result = await this.adminRequest<BackgroundUpdateHistory[]>(
        'GET',
        `/background_updates/${encodeURIComponent(jobName)}/history`,
        {
          limit: params.limit ?? 100,
          ...(params.from ? { from: params.from } : {})
        }
      )
      return result ?? []
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
      const result = await this.adminRequest<BackgroundUpdateStats[]>('GET', '/background_updates/stats', {
        limit: params.limit ?? 30
      })
      return result ?? []
    } catch (err) {
      logger.error(`[AdminBackgroundUpdate] getStats 失败: ${err}`)
      return []
    }
  }
}
