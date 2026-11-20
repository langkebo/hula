/**
 * 模块管理夹具。
 *
 * 契约来源：SDK `AdminModuleInfo` / `AdminModulePage`
 * （`GET /_synapse/admin/v1/modules` 的 `next_batch` 游标，无 `total`）。
 *
 * 说明：`AdminModuleInfo` 的必填字段包含 `config` / `created_ts` / `updated_ts` / `last_error`，
 * 旧测试用 `as AdminModuleInfo` 掩盖了缺字段，这里按真实契约补齐。
 */
import type { AdminModuleInfo, AdminModulePage } from '@/services/matrix/sdk'

export function makeAdminModuleInfo(overrides: Partial<AdminModuleInfo> = {}): AdminModuleInfo {
  return {
    id: 1,
    module_name: 'media-repo',
    module_type: 'background',
    version: '0.1.0',
    description: '媒体仓库',
    is_enabled: true,
    priority: 10,
    config: null,
    created_ts: 1_700_000_000_000,
    updated_ts: 1_700_000_000_000,
    last_executed_ts: 1_700_000_000_000,
    execution_count: 5,
    error_count: 0,
    last_error: null,
    ...overrides
  }
}

export function makeAdminModulePage(modules: AdminModuleInfo[] = [], nextBatch: string | null = null): AdminModulePage {
  return { modules, next_batch: nextBatch }
}
