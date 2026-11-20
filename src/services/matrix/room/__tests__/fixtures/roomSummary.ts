import type { RoomSummary } from '../../../extensions/SynapseRoomSummaryService'

/**
 * 线上响应形状：后端对未设置的字符串字段返回 `null`（服务层负责归一）。
 */
export type RoomSummaryWire = Omit<RoomSummary, 'name' | 'topic' | 'avatar_url' | 'canonical_alias' | 'join_rule'> & {
  name?: string | null
  topic?: string | null
  avatar_url?: string | null
  canonical_alias?: string | null
  join_rule?: string | null
}

/**
 * 房间摘要响应（形状对齐 SDK `RoomSummaryManager.getRoomSummary()`）。
 *
 * 类型来源：`SynapseRoomSummaryService` 导出的 `RoomSummary`。
 */
export function makeServerRoomSummary(overrides: Partial<RoomSummaryWire> = {}): RoomSummaryWire {
  return {
    room_id: '!room:matrix.test',
    name: null,
    topic: null,
    avatar_url: null,
    canonical_alias: null,
    join_rule: null,
    heroes: [],
    ...overrides
  }
}
