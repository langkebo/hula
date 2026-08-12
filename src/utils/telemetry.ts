/**
 * O2: 轻量 telemetry 事件总线
 *
 * 统一 error / perf / health 三类事件的入口。
 * - error  → ErrorTracker.trackError
 * - health → ErrorTracker.trackManual（warn/error 级别）
 * - perf   → 预留接口，后续接 perf 采集器
 *
 * 取代散落在各服务中直接调用 errorTracker 的模式，
 * 后续新增 perf 采集器只需在 track 内部添加分发逻辑。
 */

import { errorTracker } from '@/utils/ErrorTracker'
import { createLogger } from '@/utils/Logger'

const logger = createLogger('Telemetry')

export type TelemetryEvent =
  | { kind: 'error'; name: string; error: unknown; context?: Record<string, unknown> }
  | { kind: 'perf'; name: string; durationMs: number; context?: Record<string, unknown> }
  | {
      kind: 'health'
      name: string
      severity: 'info' | 'warn' | 'error'
      context?: Record<string, unknown>
    }

/**
 * 发射一个 telemetry 事件，按类型分发到对应采集器。
 *
 * 此函数是 non-blocking 的——内部 catch 所有异常，
 * 不会因 telemetry 失败而影响主流程。
 */
export function track(event: TelemetryEvent): void {
  try {
    switch (event.kind) {
      case 'error': {
        const error = event.error instanceof Error ? event.error : new Error(String(event.error))
        errorTracker.trackError('manual', error, event.context ?? {})
        break
      }
      case 'health': {
        if (event.severity === 'warn' || event.severity === 'error') {
          errorTracker.trackManual(event.name, event.context ?? {})
        } else {
          logger.info(`[health:info] ${event.name}`, event.context ?? {})
        }
        break
      }
      case 'perf': {
        // 预留：后续接 perf 采集器（PerformanceReporter / Prometheus）
        logger.info(`[perf] ${event.name}: ${event.durationMs}ms`, event.context ?? {})
        break
      }
    }
  } catch (err) {
    // telemetry 是 non-blocking 的，不应影响主流程
    logger.warn(`telemetry track 失败（已忽略）: ${err}`)
  }
}
