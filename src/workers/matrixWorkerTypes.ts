/**
 * Matrix Worker 类型定义
 */

export interface MatrixClientConfig {
  homeserverUrl: string
  identityServerUrl?: string
  deviceId?: string
  accessToken?: string
  userId?: string
  allowInsecureHttp?: boolean
}

export interface LoginResult {
  success: boolean
  userId?: string
  deviceId?: string
  accessToken?: string
  error?: string
}

export interface SyncOptions {
  timeout?: number
  cursor?: string
  fullState?: boolean
  limit?: number
  filter?: unknown
}

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
  error?: string
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
