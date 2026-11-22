/**
 * 模块管理服务（Admin）
 *
 * 对应 synapse-rust 的 `/_synapse/admin/v1/modules` 路由，直接复用 SDK
 * `AdminManager.listModules`，不另建 HTTP 调用。
 *
 * 路由清单：
 *   GET /modules                 模块列表（游标键 next_batch）
 *   GET /modules/type/{type}     按类型返回裸数组
 */
import { DEFAULT_PAGE_LIMIT } from '@/common/constants'
import type { AdminModuleInfo, AdminModulePage } from '@/services/matrix/sdk'
import { createLogger } from '@/utils/Logger'
import { BaseMatrixService } from '../BaseMatrixService'

const logger = createLogger('AdminModule')

/** 模块在 UI 中的三态。 */
export type AdminModuleStatus = 'loaded' | 'unloaded' | 'failed'

/** 页面渲染用的模块条目（由 SDK 原始字段映射而来）。 */
export interface AdminModuleItem {
  id: number
  name: string
  type: string
  version: string
  description?: string
  status: AdminModuleStatus
  priority: number
  executionCount: number
  errorCount: number
  lastError?: string
  lastExecutedTs: number | null
}

/** 模块列表分页结果。 */
interface AdminModuleListResult {
  modules: AdminModuleItem[]
  nextBatch: string | null
}

/** 将 SDK 原始模块信息映射为 UI 条目。 */
function toModuleItem(raw: AdminModuleInfo): AdminModuleItem {
  const failed = raw.error_count > 0 || Boolean(raw.last_error)
  return {
    id: raw.id,
    name: raw.module_name,
    type: raw.module_type,
    version: raw.version,
    ...(raw.description ? { description: raw.description } : {}),
    status: failed ? 'failed' : raw.is_enabled ? 'loaded' : 'unloaded',
    priority: raw.priority,
    executionCount: raw.execution_count,
    errorCount: raw.error_count,
    ...(raw.last_error ? { lastError: raw.last_error } : {}),
    lastExecutedTs: raw.last_executed_ts
  }
}

export class AdminModuleService extends BaseMatrixService {
  private getManager() {
    return this.getClient().getAdminManager()
  }

  /**
   * 拉取模块列表，按 `next_batch` 游标分页。
   */
  async listModules(options: { limit?: number; from?: string } = {}): Promise<AdminModuleListResult> {
    try {
      const page: AdminModulePage = await this.getManager().listModules({
        limit: options.limit ?? DEFAULT_PAGE_LIMIT,
        ...(options.from ? { from: options.from } : {})
      })
      return {
        modules: (page?.modules ?? []).map(toModuleItem),
        nextBatch: page?.next_batch ?? null
      }
    } catch (err) {
      logger.error(`[AdminModule] listModules 失败: ${err}`)
      throw err
    }
  }
}

export const adminModuleService = new AdminModuleService()
