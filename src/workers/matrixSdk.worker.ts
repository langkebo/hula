/**
 * Matrix SDK Web Worker — 消息分发入口
 *
 * 负责在独立线程中处理 Matrix SDK 初始化、同步、事件处理等耗时操作，
 * 确保主线程阻塞时间 < 50ms。
 *
 * 消息处理器按域拆分到独立模块：
 *   - workerSearchHandlers.ts — 搜索索引引擎
 *   - workerProbeHandlers.ts  — 服务器探测（versions/loginFlows/CORS/capabilities）
 *   - workerState.ts          — 响应发送工具
 *
 * ⚠️ 本 worker **不持有 MatrixClient**：Batch 3.2 取证确认主线程从不发送
 * initialize/login/startClient/stopClient/getClient（详见仓库外
 * `OPS_ARTIFACTS/TJG_worker_client_forensics_2026-10-13.md`），
 * 原 `workerClientHandlers.ts` 是恒不可达的死面，已删。
 */

import type { SearchEventDoc, SearchQueryPayload, SearchRoomDoc } from './matrixWorkerTypes'
import { validateWorkerMessage } from './workerMessageValidation'
import {
  handleGetCapabilities,
  handleGetLoginFlows,
  handleGetServerVersions,
  handleProbeCors,
  handleProbeSlidingSyncEndpoints
} from './workerProbeHandlers'
import {
  handleSearchBootstrapEvents,
  handleSearchBootstrapRooms,
  handleSearchQuery,
  handleSearchRedactEvent,
  handleSearchRemoveRoom,
  handleSearchReset,
  handleSearchSetKey,
  handleSearchStats,
  handleSearchUpsertEvents,
  handleSearchUpsertRooms,
  initSearchEngine
} from './workerSearchHandlers'
import { sendResponse } from './workerState'

/**
 * Worker 消息分发表
 *
 * 每个消息类型映射到对应的 handler 函数。
 * handler 返回的 data 会被发送给主线程。
 */
type HandlerFn = (payload: unknown) => Promise<unknown> | unknown

const messageHandlers: Record<string, HandlerFn> = {
  // --- 服务器探测 ---
  getServerVersions: (payload) => handleGetServerVersions(payload as { baseUrl: string; accessToken?: string }),
  getLoginFlows: (payload) => handleGetLoginFlows(payload as { baseUrl: string }),
  probeSlidingSyncEndpoints: (payload) =>
    handleProbeSlidingSyncEndpoints(payload as { baseUrl: string; endpoints: string[] }),
  probeCors: (payload) => handleProbeCors(payload as { baseUrl: string }),
  getCapabilities: (payload) => handleGetCapabilities(payload as { baseUrl: string; accessToken: string }),

  // --- 搜索索引 ---
  'search.reset': () => handleSearchReset(),
  'search.setKey': (payload) => handleSearchSetKey(payload as { key?: string | null }),
  'search.bootstrapRooms': (payload) => handleSearchBootstrapRooms(payload as { rooms?: SearchRoomDoc[] }),
  'search.upsertRooms': (payload) => handleSearchUpsertRooms(payload as { rooms?: SearchRoomDoc[] }),
  'search.bootstrapEvents': (payload) => handleSearchBootstrapEvents(payload as { events?: SearchEventDoc[] }),
  'search.upsertEvents': (payload) => handleSearchUpsertEvents(payload as { events?: SearchEventDoc[] }),
  'search.redactEvent': (payload) => handleSearchRedactEvent(payload as { eventId?: string }),
  'search.removeRoom': (payload) => handleSearchRemoveRoom(payload as { roomId?: string }),
  'search.query': (payload) => handleSearchQuery(payload as SearchQueryPayload),
  'search.stats': () => handleSearchStats(),

  // --- 心跳 ---
  ping: () => ({ timestamp: Date.now() })
}

self.onmessage = async (event: MessageEvent<unknown>) => {
  // 边界校验：拒绝格式非法的消息，避免 `as` 断言直接信任外部输入（SC-06）
  const validation = validateWorkerMessage(event.data)
  if (!validation.ok) {
    await sendResponse(validation.type, validation.id, false, undefined, `Invalid worker message: ${validation.error}`)
    return
  }

  const { payload } = validation.value
  const { type, id } = validation.value.message

  try {
    const handler: HandlerFn | undefined = messageHandlers[type]
    if (!handler) {
      await sendResponse(type, id, false, undefined, `Unknown message type: ${type}`)
      return
    }

    const result = await handler(payload)
    await sendResponse(type, id, true, result)
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    await sendResponse(type, id, false, undefined, errorMessage)
  }
}

// 初始化搜索引擎（从 IndexedDB 加载本地搜索索引）
void initSearchEngine()

self.postMessage({ type: 'ready', id: 'init', success: true })
