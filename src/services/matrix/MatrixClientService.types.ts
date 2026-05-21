import type { MatrixClient } from 'matrix-js-sdk'

export type ConnectionState = 'DISCONNECTED' | 'CONNECTING' | 'CONNECTED' | 'RECONNECTING' | 'ERROR'

export interface MatrixClientConfig {
  homeserverUrl: string
  identityServerUrl?: string
  deviceId?: string
  accessToken?: string
  userId?: string
  allowInsecureHttp?: boolean
  slidingSync?: {
    roomRangeEnd?: number
    timelineLimit?: number
    pollTimeout?: number
  }
}

export interface LoginResult {
  success: boolean
  userId?: string
  deviceId?: string
  accessToken?: string
  error?: string
}

export type StartClientOptions = Parameters<MatrixClient['startClient']>[0]

export type SyncErrorLike = {
  errcode?: string
  name?: string
}
