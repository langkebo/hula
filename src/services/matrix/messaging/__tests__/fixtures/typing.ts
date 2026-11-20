import { MatrixEvent } from 'matrix-js-sdk'
import type { BatchTypingResult } from '../../MatrixTypingService'

/**
 * `m.typing` 状态事件（真实 `MatrixEvent`）。
 *
 * SDK `RoomState.getStateEvents('m.typing', '')` 的返回类型就是 `MatrixEvent | null`，
 * `getContent()` 对 typing 事件返回 `{ user_ids: string[] }`；用真实类构造可以保证
 * 夹具与 SDK 契约完全一致，不需要手写 `getContent` 桩或做类型断言。
 */
export function makeTypingStateEvent(userIds: string[]): MatrixEvent {
  return new MatrixEvent({ type: 'm.typing', content: { user_ids: userIds } })
}

/** `matrixTypingService.getBatchTyping()` 的批量结果（房间 → 正在输入的用户）。 */
export function makeBatchTypingResult(overrides: BatchTypingResult = {}): BatchTypingResult {
  return { ...overrides }
}
