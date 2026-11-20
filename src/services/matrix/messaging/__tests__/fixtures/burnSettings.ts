import type { MatrixClient } from '@/services/matrix/sdk'

type BurnAfterReadManagerInstance = ReturnType<MatrixClient['getBurnAfterReadManager']>

/** SDK `getBurnSettings()` 的响应（契约 DTO `BurnSettings`）。 */
export type BurnSettingsResponse = Awaited<ReturnType<BurnAfterReadManagerInstance['getBurnSettings']>>

/**
 * 线上可能出现的响应形状：旧部署不返回 `scope`，服务层兜底为 `per_user`。
 */
export type BurnSettingsWire = Omit<BurnSettingsResponse, 'scope'> & {
  scope?: BurnSettingsResponse['scope']
}

export function makeBurnSettingsResponse(overrides: Partial<BurnSettingsWire> = {}): BurnSettingsWire {
  return {
    enabled: true,
    burn_after_ms: 60_000,
    ...overrides
  }
}
