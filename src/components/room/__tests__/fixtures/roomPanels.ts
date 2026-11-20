/**
 * 房间详情/面板测试夹具。
 *
 * 类型来源：
 * - 房间信息：`MatrixGroupInfo`（group store `loadGroupInfo()` 返回值）；
 * - 加密事件：`AccountDataService.EncryptedRoomEvent`（与 SDK `EncryptedEventsResult.events` 同形）；
 * - 加密设置：`MatrixEncryptionService.EncryptionSettings`（`m.room.encryption` 状态事件）；
 * - 消息队列：`AccountDataService.RoomMessageQueueOutcome`（SDK `RoomMessageQueueResult` + 组件消费的 `queue`）；
 * - 空间 / TURN：`MetadataService.RoomSpacesOutcome` / `RoomTurnServerOutcome` 判别联合。
 */

import type { EncryptionSettings } from '@/services/matrix/crypto/MatrixEncryptionService'
import type {
  EncryptedEventsOutcome,
  EncryptedRoomEvent,
  RoomMessageQueueEntry,
  RoomMessageQueueOutcome
} from '@/services/matrix/room/AccountDataService'
import type {
  RoomSpaceMembership,
  RoomSpacesOutcome,
  RoomTurnServerConfig,
  RoomTurnServerOutcome
} from '@/services/matrix/room/MetadataService'
import type { RoomReceiptSnapshot, RoomReceiptsOutcome } from '@/services/matrix/room/timelineOutcomes'

export { makeGroupInfo } from '@/stores/domains/chat/__tests__/fixtures/group'

/** 加密事件条目 */
export function makeEncryptedRoomEvent(overrides: Partial<EncryptedRoomEvent> = {}): EncryptedRoomEvent {
  return {
    event_id: '$event:example.org',
    sender: '@alice:example.org',
    type: 'm.room.encrypted',
    content: {
      algorithm: 'm.megolm.v1.aes-sha2',
      ciphertext: 'cipher',
      session_id: 'sess1',
      sender_key: 'sender-key',
      device_id: 'DEVICE'
    },
    timestamp: 1,
    algorithm: 'm.megolm.v1.aes-sha2',
    session_id: 'sess1',
    ...overrides
  }
}

/** `getEncryptedEvents()` 响应 */
export function makeEncryptedEventsOutcome(events: EncryptedRoomEvent[] = []): EncryptedEventsOutcome {
  return { events }
}

/** `getEncryptionSettings()` 返回值（`m.room.encryption` 内容） */
export function makeEncryptionSettings(overrides: Partial<EncryptionSettings> = {}): EncryptionSettings {
  return {
    algorithm: 'm.megolm.v1.aes-sha2',
    rotationPeriodMs: 604800000,
    rotationPeriodMsgs: 100,
    ...overrides
  }
}

export function makeRoomMessageQueueEntry(overrides: Partial<RoomMessageQueueEntry> = {}): RoomMessageQueueEntry {
  return { event_id: '$queued:example.org', type: 'm.room.message', content: { body: 'hello' }, ...overrides }
}

/** `getMessageQueue()` 响应（SDK 字段 + 组件消费的 `queue`） */
export function makeRoomMessageQueueOutcome(entries: RoomMessageQueueEntry[] = []): RoomMessageQueueOutcome {
  return { queue: entries }
}

export function makeRoomSpaceMembership(overrides: Partial<RoomSpaceMembership> = {}): RoomSpaceMembership {
  return { roomId: '!space:example.org', name: 'Space', canonicalAlias: '', avatarUrl: '', topic: '', ...overrides }
}

export function roomSpacesOk(spaces: RoomSpaceMembership[]): RoomSpacesOutcome {
  return { status: 'ok', spaces }
}

export function roomSpacesError(): RoomSpacesOutcome {
  return { status: 'error' }
}

export function makeRoomTurnServerConfig(overrides: Partial<RoomTurnServerConfig> = {}): RoomTurnServerConfig {
  return { uris: ['turn:turn.example.org'], ttl: null, ...overrides }
}

export function roomTurnServerOk(config: RoomTurnServerConfig): RoomTurnServerOutcome {
  return { status: 'ok', config }
}

export function roomTurnServerError(): RoomTurnServerOutcome {
  return { status: 'error' }
}

export function receiptsOk(snapshot: RoomReceiptSnapshot): RoomReceiptsOutcome {
  return { status: 'ok', snapshot }
}

export function receiptsEmpty(): RoomReceiptsOutcome {
  return { status: 'empty' }
}

export function receiptsUnsupported(): RoomReceiptsOutcome {
  return { status: 'unsupported' }
}

export function receiptsError(): RoomReceiptsOutcome {
  return { status: 'error' }
}
