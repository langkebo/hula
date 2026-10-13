/**
 * Worker 共享基础设施
 *
 * ⚠️ 本模块曾同时持有 `sdk` / `client` / `slidingSyncInstance` 三个 SDK 相关可变状态，
 * 以及 `initSDK()` / `extractClientConfig()`。2026-10-13 取证（Batch 3.2，报告见仓库外
 * `OPS_ARTIFACTS/TJG_worker_client_forensics_2026-10-13.md`）确认它们**永远不可达**：
 * 主线程 `MatrixWorkerHost` 从不发送 `initialize` / `login` / `startClient` / `stopClient` /
 * `getClient`，故 `state.client` 恒为 null；`state.sdk` 连 `import('matrix-js-sdk')` 都没发生过。
 * 这些死状态会误导后续开发以为 worker 里有一个可用的 MatrixClient，故整体移除。
 *
 * 现在本模块只剩主线程 ↔ worker 的响应发送工具。
 */

import type { WorkerResponse } from './matrixWorkerTypes'

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
