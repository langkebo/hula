/**
 * Matrix SDK Web Worker — 消息分发入口
 *
 * 负责在独立线程中处理 Matrix SDK 初始化、同步、事件处理等耗时操作，
 * 确保主线程阻塞时间 < 50ms。
 *
 * 消息处理器按域拆分到独立模块：
 *   - workerSearchHandlers.ts — 搜索索引引擎
 *   - workerClientHandlers.ts — 客户端生命周期（init/login/start/stop/sync）
 *   - workerProbeHandlers.ts  — 服务器探测（versions/loginFlows/CORS/capabilities）
 *   - workerState.ts          — 共享状态与工具函数
 */

import type {
  MatrixClientConfig,
  SearchEventDoc,
  SearchQueryPayload,
  SearchRoomDoc,
  SyncOptions,
  WorkerMessage
} from './matrixWorkerTypes'
import {
  handleClearStores,
  handleGetClient,
  handleGetStats,
  handleInitialize,
  handleLogin,
  handleStartClient,
  handleStopClient,
  handleSyncOnce
} from './workerClientHandlers'
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
  handleSearchStats,
  handleSearchUpsertEvents,
  handleSearchUpsertRooms,
  initSearchEngine,
  stopSearchEngine
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
  // --- 客户端生命周期 ---
  initialize: (payload) => handleInitialize(payload as MatrixClientConfig),
  login: (payload) => handleLogin(payload as { username: string; password: string; deviceName?: string }),
  startClient: () => handleStartClient(),
  stopClient: () => handleStopClient(),
  clearStores: () => handleClearStores(),
  getStats: () => handleGetStats(),
  getClient: () => handleGetClient(),
  syncOnce: (payload) => handleSyncOnce(payload as SyncOptions),

  // --- 服务器探测 ---
  getServerVersions: (payload) => handleGetServerVersions(payload as { baseUrl: string; accessToken?: string }),
  getLoginFlows: (payload) => handleGetLoginFlows(payload as { baseUrl: string }),
  probeSlidingSyncEndpoints: (payload) =>
    handleProbeSlidingSyncEndpoints(payload as { baseUrl: string; endpoints: string[] }),
  probeCors: (payload) => handleProbeCors(payload as { baseUrl: string }),
  getCapabilities: (payload) => handleGetCapabilities(payload as { baseUrl: string; accessToken: string }),

  // --- 搜索索引 ---
  'search.reset': () => handleSearchReset(),
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

self.onmessage = async (event: MessageEvent<WorkerMessage>) => {
  const { type, id, payload } = event.data

  try {
    const handler = messageHandlers[type]
    if (!handler) {
      await sendResponse(type, id, false, undefined, `Unknown message type: ${type}`)
      return
    }

    // stopClient 需要额外停止搜索引擎
    if (type === 'stopClient') {
      stopSearchEngine()
    }

    const result = await handler(payload)
    await sendResponse(type, id, true, result)
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    await sendResponse(type, id, false, undefined, errorMessage)
  }
}

// 初始化搜索引擎（从 IndexedDB 加载 + 启动内存检查定时器）
void initSearchEngine()

self.postMessage({ type: 'ready', id: 'init', success: true })
