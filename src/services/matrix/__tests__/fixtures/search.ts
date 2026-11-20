/**
 * 消息搜索夹具。
 *
 * 契约来源：`MatrixSearchService.searchRoomMessages()` 的返回
 * `{ results: SearchResult[]; count: number; highlights: string[] }`。
 */
import type { matrixSearchService, SearchResult } from '@/services/matrix/MatrixSearchService'

export type SearchRoomMessagesResponse = Awaited<ReturnType<typeof matrixSearchService.searchRoomMessages>>

/** 单条命中（`SearchResult`：`content` 为 `Record<string, unknown>`）。 */
export function makeSearchResult(overrides: Partial<SearchResult> = {}): SearchResult {
  return {
    roomId: '!room:example.com',
    eventId: '$event:example.com',
    sender: '@alice:example.com',
    content: { body: 'match', msgtype: 'm.text' },
    timestamp: 1000,
    ...overrides
  }
}

export function makeSearchRoomMessagesResponse(results: SearchResult[] = []): SearchRoomMessagesResponse {
  return { results, count: results.length, highlights: [] }
}
