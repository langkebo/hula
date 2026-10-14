/**
 * Matrix Worker 类型定义
 *
 * ⚠️ Batch 3.2（2026-10-13）：`MatrixClientConfig` / `LoginResult` / `SyncOptions` 已删除 ——
 * 它们只服务于 worker 侧的客户端生命周期（`workerClientHandlers.ts`），而该面**从不可达**
 * （主线程从不发送 initialize/login/startClient）。见仓库外取证报告
 * `OPS_ARTIFACTS/TJG_worker_client_forensics_2026-10-13.md`。
 */

export interface WorkerMessage {
  type: string
  id: string
  payload?: unknown
}

export interface WorkerResponse {
  type: string
  id: string
  success: boolean
  data?: unknown
  error?: string | undefined
}

export interface SearchRoomDoc {
  roomId: string
  name: string
  avatarUrl?: string
  memberCount?: number
}

export interface SearchEventDoc {
  eventId: string
  roomId: string
  sender: string
  timestamp: number
  msgtype?: string
  body: string
}

export interface SearchQueryPayload {
  term: string
  scope: 'messages' | 'rooms'
  roomId?: string
  limit?: number
  offset?: number
}

export interface SearchMessageHit {
  eventId: string
  roomId: string
  sender: string
  timestamp: number
  preview: string
  score: number
}

export interface SearchRoomHit {
  roomId: string
  roomName: string
  score: number
}

export interface SearchQueryResult {
  messages?: SearchMessageHit[]
  rooms?: SearchRoomHit[]
}

export interface SearchIndexStats {
  rooms: number
  events: number
  tokens: number
}
