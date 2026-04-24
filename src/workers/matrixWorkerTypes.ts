/**
 * Matrix Worker 类型定义
 */

export interface MatrixClientConfig {
  homeserverUrl: string
  identityServerUrl?: string
  deviceId?: string
  accessToken?: string
  userId?: string
}

export type ConnectionState = 'DISCONNECTED' | 'CONNECTING' | 'CONNECTED' | 'RECONNECTING' | 'ERROR'

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

export type WorkerRequestHandler = (message: WorkerMessage) => Promise<WorkerResponse>
