import type { RoomRetentionConfig } from '@/composables/room/useRoomRetention'

/** `m.room.retention` 状态事件：`RoomRetentionConfig['getStateEvent']` 的非空返回值。 */
export type RetentionStateEvent = NonNullable<Awaited<ReturnType<RoomRetentionConfig['getStateEvent']>>>

/** 构造保留策略状态事件（默认 7 天，对应 `max_lifetime` 毫秒）。 */
export function makeRetentionStateEvent(overrides: Partial<RetentionStateEvent> = {}): RetentionStateEvent {
  return {
    content: { max_lifetime: 7 * 24 * 60 * 60 * 1000 },
    ...overrides
  }
}
