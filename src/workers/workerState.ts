/**
 * Worker 共享状态与基础设施
 *
 * 所有 handler 模块共享的可变状态（SDK 实例、client、slidingSync），
 * 以及通用工具函数（sendResponse、initSDK）。
 */

import type { MatrixClientConfig, WorkerResponse } from './matrixWorkerTypes'

// --- 共享可变状态对象 ---
export const state = {
  sdk: null as typeof import('matrix-js-sdk') | null,
  client: null as import('matrix-js-sdk').MatrixClient | null,
  slidingSyncInstance: null as unknown,
  memoryCheckIntervalId: null as ReturnType<typeof setInterval> | null
}

// --- 通用工具函数 ---

/**
 * 初始化 Matrix SDK（惰性加载）
 */
export async function initSDK(): Promise<typeof import('matrix-js-sdk')> {
  if (state.sdk) return state.sdk
  const loaded = await import('matrix-js-sdk')
  state.sdk = loaded
  const sdkModule = loaded as unknown as { initLogger?: () => void }
  if (typeof sdkModule.initLogger === 'function') {
    sdkModule.initLogger()
  }
  return loaded
}

/**
 * 发送响应消息到主线程
 */
export async function sendResponse(
  type: string,
  id: string,
  success: boolean,
  data?: unknown,
  error?: string
): Promise<void> {
  const response: WorkerResponse = { type, id, success, data, error }
  self.postMessage(response)
}

/**
 * 从 client 提取 MatrixClientConfig（用于 reinitialize）
 */
export function extractClientConfig(): MatrixClientConfig | null {
  if (!state.client) return null
  return state.client as unknown as MatrixClientConfig
}
