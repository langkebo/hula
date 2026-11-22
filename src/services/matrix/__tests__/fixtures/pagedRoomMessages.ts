/**
 * `MatrixEventService.getPagedRoomMessages` 的分页响应夹具。
 *
 * 该方法的返回类型是内联对象字面量（未导出命名类型），
 * 因此从单例的返回签名推导 `PagedRoomMessagesFixture`，避免测试里自造结构。
 *
 * 早前测试用 `{ messages, isLast, cursor } as never` 绕过类型，
 * 漏字段或拼错键名不会被发现；改用本夹具后由 `vue-tsc` 兜住。
 */
import type { matrixEventService } from '@/services/matrix/MatrixEventService'

export type PagedRoomMessagesFixture = Awaited<ReturnType<typeof matrixEventService.getPagedRoomMessages>>

export function makePagedRoomMessages(overrides: Partial<PagedRoomMessagesFixture> = {}): PagedRoomMessagesFixture {
  return {
    messages: [],
    isLast: true,
    cursor: '',
    ...overrides
  }
}
