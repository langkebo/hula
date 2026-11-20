import type {
  PushCleanupLogsResponse,
  PushConfigResponse,
  PushConfigUpdateResponse,
  PushProcessQueueResponse
} from '@/services/matrix/admin/AdminPushService'

/**
 * 推送运维（Push）域测试夹具。
 *
 * 类型全部来自 `AdminPushService.ts` 的导出契约（`Awaited<ReturnType<AdminPushManager[...]>>`）：
 * - `getConfig` 返回 `config` + `initialized_providers` + 可选 `supported_keys`，密钥值已被后端掩码；
 * - `setConfig` 响应与 `getConfig` 同形，但**不含** `supported_keys`；
 * - `processQueue` 是 `processed` + `message`，`cleanupLogs` 是 `cleaned` + `message`。
 */

/** 生成 `GET /push/config` 响应，默认值模拟只启用 apns、密钥已掩码的配置。 */
export function makePushConfig(overrides: Partial<PushConfigResponse> = {}): PushConfigResponse {
  return {
    config: { poll_timeout: '30', apns_secret: '***abcd' },
    initialized_providers: ['apns'],
    supported_keys: ['poll_timeout', 'apns_secret'],
    ...overrides
  }
}

/** 生成 `PUT /push/config` 响应（无 `supported_keys`）。 */
export function makePushConfigUpdate(overrides: Partial<PushConfigUpdateResponse> = {}): PushConfigUpdateResponse {
  return {
    config: { poll_timeout: '30', apns_secret: '***abcd' },
    initialized_providers: ['apns'],
    ...overrides
  }
}

/** 生成 `POST /push/process` 响应。 */
export function makePushProcessResult(overrides: Partial<PushProcessQueueResponse> = {}): PushProcessQueueResponse {
  return { processed: 12, message: 'ok', ...overrides }
}

/** 生成 `POST /push/cleanup` 响应。 */
export function makePushCleanupResult(overrides: Partial<PushCleanupLogsResponse> = {}): PushCleanupLogsResponse {
  return { cleaned: 7, message: 'ok', ...overrides }
}
