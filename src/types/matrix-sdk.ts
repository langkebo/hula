// matrix-js-sdk 类型导出
// 从 matrix-js-sdk 导出常用类型，避免使用 any

import type { MatrixClient, MatrixEvent, Room, RoomMember, User, MatrixError, IContent, EventType } from 'matrix-js-sdk'

// MsgType 枚举定义
export enum MsgType {
  Text = 'm.text',
  Emote = 'm.emote',
  Notice = 'm.notice',
  Image = 'm.image',
  Audio = 'm.audio',
  Video = 'm.video',
  Location = 'm.location',
  File = 'm.file'
}

export type { MatrixClient, MatrixEvent, Room, RoomMember, User, MatrixError, IContent, EventType }

export type CallEvent = 'hangup' | 'replaced' | 'feeds_changed' | 'error' | 'state' | 'invite'
export type SlidingSyncState = 'Consuming' | 'Cold' | 'Requesting' | 'Syncing' | 'Terminal' | 'Error'

export interface RoomAccountData {
  type: string
  content: IContent
}

export interface RoomKeyRequest {
  roomId: string
  algorithm: string
  requestBody: Record<string, unknown>
}

export interface RoomKeyRequestCancellation {
  userId: string
  deviceId: string
  requestId: string
}

export interface SignatureList {
  [key: string]: {
    [key: string]: string | Record<string, unknown>
  }
}

export interface DeviceSigning {
  authUploadDeviceSigningKeys?: (
    makeRequest: (authData: Record<string, unknown>) => Promise<Record<string, unknown>>
  ) => Promise<void>
  uploadDeviceSignatures?: (
    signatures: SignatureList,
    uploadFunction?: (signed: SignatureList) => Promise<void>
  ) => Promise<void>
}

export interface CryptoStoreError extends Error {
  code?: string
}

export type KeyBackupInfo = {
  version: string
  algorithm: string
  auth_data: Record<string, unknown>
  etag?: string
  count?: number
}

export type KeysBackupSession = {
  first_message_index: number
  forwarded_count: number
  is_verified: boolean
  session_data: Record<string, unknown>
}

export type RoomKeyBackup = {
  sessions?: Record<string, KeysBackupSession>
  etag?: string
  version?: string
}

export interface MSC2716HistoricalEventsResponse {
  chunk: MatrixEvent[]
  next_batch?: string
  prev_batch?: string
}

export interface JoinRuleEventContent {
  join_rule: 'public' | 'knock' | 'invite' | 'private'
  allow?: Array<{
    type: string
    via?: string[]
    key?: string
  }>
}

export interface BeaconInfoEventContent {
  uri?: string
  description?: string
  timestamp?: number
  live?: boolean
  duration?: number
}

export interface BeaconEventContent extends BeaconInfoEventContent {
  'm.relates_to'?: {
    rel_type: string
    event_id: string
  }
}

export type LiveBeacon = {
  type: 'm.beacon_info'
  beaconId: string
  roomId: string
  userId: string
  description?: string
  uri?: string
  timestamp: number
  isLive: boolean
  expiresAt?: number
  lastUpdated: number
}

export interface EncryptionKeysImportResult {
  imported: number
  total: number
}

export interface RoomEncryptionSettings {
  algorithm?: string
  rotation_period_ms?: number
  rotation_period_msgs?: number
  extra_keys?: Array<string>
  only_allow_known_devices?: boolean
}

export interface SSSSCallbackResult {
  passphrase?: string
  result?: unknown
  报答?: boolean
}

export type { MatrixClient as MatrixClientClass }
