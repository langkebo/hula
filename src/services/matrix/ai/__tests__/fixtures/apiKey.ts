/**
 * API Key 域测试夹具。
 *
 * 类型来源是 `ApiKeyService` 自己导出的真实契约：
 * - `ApiKey` / `Platform` / `ApiKeyBalance` / `ApiKeyBalanceInfo`：服务层具名导出；
 * - 分页壳 `{ list: ApiKey[]; total: number }`：从 `page()` 方法签名推导。
 *
 * 手写字面量缺字段（如漏 `status`、`balanceInfos`）会被 `vue-tsc` 直接拦下。
 */
import type { ApiKey, ApiKeyBalance, ApiKeyBalanceInfo, apiKeyService, Platform } from '../../ApiKeyService'

export type ApiKeyPageFixture = Awaited<ReturnType<typeof apiKeyService.page>>

export function makeApiKey(overrides: Partial<ApiKey> = {}): ApiKey {
  return { id: 'k1', name: 'n', apiKey: 'sk', platform: 'openai', status: 1, ...overrides }
}

/** `page()` 的返回壳：`{ list, total }`。 */
export function makeApiKeyPage(overrides: Partial<ApiKeyPageFixture> = {}): ApiKeyPageFixture {
  return { list: [], total: 0, ...overrides }
}

export function makePlatform(overrides: Partial<Platform> = {}): Platform {
  return { label: 'OpenAI', platform: 'openai', examples: 'sk-xxx', docs: 'https://...', ...overrides }
}

export function makeApiKeyBalanceInfo(overrides: Partial<ApiKeyBalanceInfo> = {}): ApiKeyBalanceInfo {
  return { totalBalance: '10.0', currency: 'USD', ...overrides }
}

export function makeApiKeyBalance(overrides: Partial<ApiKeyBalance> = {}): ApiKeyBalance {
  return { balanceInfos: [makeApiKeyBalanceInfo()], ...overrides }
}
