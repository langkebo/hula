/**
 * O4: 启动健康自检 + 诊断导出
 *
 * 汇总 extensionHealth / errorSummary / connectionState / crypto 状态，
 * 返回结构化快照供「反馈/支持」页一键复制，便于线上排查降级根因。
 */

import { matrixClientService } from '@/services/matrix/MatrixClientService'
import { useCapabilityStore } from '@/stores/domains/chat/capability'
import { errorTracker } from '@/utils/ErrorTracker'
import { createLogger } from '@/utils/Logger'

const logger = createLogger('DumpDiagnostics')

export interface DiagnosticsSnapshot {
  timestamp: string
  extensionHealth: Record<string, string>
  hasDegradedExtension: boolean
  connectionState: string
  homeserverUrl: string | undefined
  errorSummary: {
    total: number
    unhandled: number
    promise: number
    vue: number
    manual: number
  }
  cryptoState: string | undefined
}

/**
 * 导出当前运行时诊断快照。
 *
 * 此函数是 non-blocking 的——内部 catch 所有异常，
 * 返回部分可用的诊断信息。
 */
export function dumpDiagnostics(): DiagnosticsSnapshot {
  const snapshot: DiagnosticsSnapshot = {
    timestamp: new Date().toISOString(),
    extensionHealth: {},
    hasDegradedExtension: false,
    connectionState: 'unknown',
    homeserverUrl: undefined,
    errorSummary: { total: 0, unhandled: 0, promise: 0, vue: 0, manual: 0 },
    cryptoState: undefined
  }

  try {
    const cap = useCapabilityStore()
    snapshot.extensionHealth = { ...cap.extensionHealth }
    snapshot.hasDegradedExtension = cap.hasDegradedExtension
  } catch (err) {
    logger.warn(`[dumpDiagnostics] 读取 extensionHealth 失败: ${err}`)
  }

  try {
    const summary = errorTracker.getErrorSummary()
    snapshot.errorSummary = {
      total: summary.total,
      unhandled: summary.unhandled,
      promise: summary.promise,
      vue: summary.vue,
      manual: summary.manual
    }
  } catch (err) {
    logger.warn(`[dumpDiagnostics] 读取 errorSummary 失败: ${err}`)
  }

  try {
    snapshot.connectionState = matrixClientService.getConnectionState() ?? 'unknown'
    snapshot.homeserverUrl = matrixClientService.getClient()?.getHomeserverUrl()
  } catch (err) {
    logger.warn(`[dumpDiagnostics] 读取 connectionState 失败: ${err}`)
  }

  return snapshot
}

/**
 * 将诊断快照格式化为可复制的文本。
 */
export function formatDiagnostics(snapshot: DiagnosticsSnapshot): string {
  const lines = [
    `=== Diagnostics Snapshot ===`,
    `Timestamp: ${snapshot.timestamp}`,
    `Homeserver: ${snapshot.homeserverUrl ?? 'N/A'}`,
    `Connection: ${snapshot.connectionState}`,
    `Crypto: ${snapshot.cryptoState ?? 'N/A'}`,
    ``,
    `Extension Health:`,
    ...Object.entries(snapshot.extensionHealth).map(([id, status]) => `  ${id}: ${status}`),
    `Has Degraded: ${snapshot.hasDegradedExtension}`,
    ``,
    `Error Summary:`,
    `  Total: ${snapshot.errorSummary.total}`,
    `  Unhandled: ${snapshot.errorSummary.unhandled}`,
    `  Promise: ${snapshot.errorSummary.promise}`,
    `  Vue: ${snapshot.errorSummary.vue}`,
    `  Manual: ${snapshot.errorSummary.manual}`,
    `=== End ===`
  ]
  return lines.join('\n')
}
