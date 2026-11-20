/**
 * 焚毁统计测试夹具。
 *
 * 契约来源：`MatrixBurnAfterReadService.getBurnStats()` 的返回类型 `BurnStats`
 * （服务层把 SDK 的 `total_burned` / `total_pending` / `rooms_with_burn_enabled`
 * 归一为驼峰字段）。
 */
import type { BurnStats } from '@/services/matrix/messaging/MatrixBurnAfterReadService'

export function makeBurnStats(overrides: Partial<BurnStats> = {}): BurnStats {
  return {
    totalBurned: 0,
    totalPending: 0,
    roomsWithBurnEnabled: 0,
    ...overrides
  }
}
