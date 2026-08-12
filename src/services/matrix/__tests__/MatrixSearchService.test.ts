import type { MatrixClient } from 'matrix-js-sdk'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import matrixClientService from '../MatrixClientService'
import { matrixSearchService } from '../MatrixSearchService'
import matrixWorkerHost from '../MatrixWorkerHost'

vi.spyOn(matrixClientService, 'getClient')

// 阻断真实 MatrixClientService 的传递依赖加载 matrix-js-sdk
// （主项目 node_modules 缺少 @babel/runtime/loglevel，本地 SDK 构建产物无法解析，
//  参见 ChatSidebar.test.ts 同类说明）。getClient 以 vi.fn 提供给 spyOn/mockReturnValue。
vi.mock('../MatrixClientService', () => ({
  default: {
    getClient: vi.fn()
  }
}))

vi.mock('../MatrixWorkerHost', () => ({
  default: {
    isStarted: false,
    querySearchIndex: vi.fn()
  }
}))

vi.mock('@/services/i18n', () => ({
  useI18nGlobal: () => ({ t: (key: string) => key })
}))

vi.mock('@tauri-apps/plugin-log', () => ({
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn()
}))

describe('MatrixSearchService', () => {
  let mockClient: Partial<MatrixClient>
  let searchMgr: {
    searchMessageText: ReturnType<typeof vi.fn>
    searchUserDirectory: ReturnType<typeof vi.fn>
  }

  beforeEach(() => {
    searchMgr = {
      searchMessageText: vi.fn(),
      searchUserDirectory: vi.fn()
    }
    mockClient = {
      getSearchManager: vi.fn(() => searchMgr as unknown as ReturnType<NonNullable<MatrixClient['getSearchManager']>>),
      getUserId: vi.fn(() => '@user:example.com'),
      getRoom: vi.fn()
    }

    vi.mocked(matrixClientService.getClient).mockReset()
    vi.mocked(matrixClientService.getClient).mockReturnValue(mockClient as MatrixClient)
    vi.mocked(matrixWorkerHost.querySearchIndex).mockReset()
    vi.mocked(matrixWorkerHost.querySearchIndex).mockResolvedValue({ messages: [] })
    vi.mocked(matrixWorkerHost, true).isStarted = false
  })

  describe('searchMessages via SearchManager', () => {
    it('should search messages via getSearchManager().searchMessageText', async () => {
      searchMgr.searchMessageText.mockResolvedValue({
        search_categories: {
          room_events: {
            results: [
              {
                result: {
                  room_id: '!room:example.com',
                  event_id: '$event_1',
                  sender: '@user:example.com',
                  content: { body: 'hello world', msgtype: 'm.text' },
                  origin_server_ts: 1234567890
                }
              }
            ],
            count: 1
          }
        }
      })

      const results = await matrixSearchService.searchMessages('hello')

      expect(searchMgr.searchMessageText).toHaveBeenCalledWith(
        expect.objectContaining({
          term: 'hello'
        })
      )
      expect(results.length).toBeGreaterThan(0)
    })

    it('should pass room_id when searching within a specific room', async () => {
      searchMgr.searchMessageText.mockResolvedValue({
        search_categories: { room_events: { results: [], count: 0 } }
      })

      await matrixSearchService.searchMessages('test', { roomId: '!room:example.com' })

      expect(searchMgr.searchMessageText).toHaveBeenCalledWith(
        expect.objectContaining({
          term: 'test',
          room_id: '!room:example.com'
        })
      )
    })

    it('should throw when client is not initialized', async () => {
      vi.mocked(matrixClientService.getClient).mockReturnValue(null)

      await expect(matrixSearchService.searchMessages('test')).rejects.toThrow()
    })

    it('should return empty array when no results', async () => {
      searchMgr.searchMessageText.mockResolvedValue({
        search_categories: { room_events: { results: [], count: 0 } }
      })

      const results = await matrixSearchService.searchMessages('nonexistent')
      expect(results).toEqual([])
    })

    it('should use worker search when source is local and worker is started', async () => {
      vi.mocked(matrixWorkerHost, true).isStarted = true
      vi.mocked(matrixWorkerHost.querySearchIndex).mockResolvedValue({
        messages: [
          {
            eventId: '$local_1',
            roomId: '!room:example.com',
            sender: '@user:example.com',
            timestamp: 1234567890,
            preview: 'hello from worker',
            score: 100
          }
        ]
      })

      const results = await matrixSearchService.searchMessages('hello', { source: 'local' })

      expect(matrixWorkerHost.querySearchIndex).toHaveBeenCalledWith(
        expect.objectContaining({
          term: 'hello',
          scope: 'messages'
        })
      )
      expect(searchMgr.searchMessageText).not.toHaveBeenCalled()
      expect(results[0]?.eventId).toBe('$local_1')
      expect(results[0]?.content.body).toBe('hello from worker')
    })

    it('should fall back to SearchManager when hybrid search misses locally', async () => {
      vi.mocked(matrixWorkerHost, true).isStarted = true
      searchMgr.searchMessageText.mockResolvedValue({
        search_categories: {
          room_events: {
            results: [
              {
                result: {
                  room_id: '!room:example.com',
                  event_id: '$remote_1',
                  sender: '@user:example.com',
                  content: { body: 'hello remote', msgtype: 'm.text' },
                  origin_server_ts: 1234567890
                }
              }
            ],
            count: 1
          }
        }
      })

      const results = await matrixSearchService.searchMessages('hello', { source: 'hybrid' })

      expect(matrixWorkerHost.querySearchIndex).toHaveBeenCalled()
      expect(searchMgr.searchMessageText).toHaveBeenCalled()
      expect(results[0]?.eventId).toBe('$remote_1')
    })
  })

  describe('searchRoomMessages', () => {
    it('returns results, count and highlights for a non-empty query', async () => {
      searchMgr.searchMessageText.mockResolvedValue({
        search_categories: {
          room_events: {
            results: [
              {
                result: {
                  room_id: '!room:example.com',
                  event_id: '$event_1',
                  sender: '@alice:example.com',
                  content: { body: 'hello world', msgtype: 'm.text' },
                  origin_server_ts: 1234567890
                }
              }
            ],
            count: 1,
            highlights: ['hello']
          }
        }
      })

      const res = await matrixSearchService.searchRoomMessages('!room:example.com', 'hello')

      expect(searchMgr.searchMessageText).toHaveBeenCalledWith(
        expect.objectContaining({
          term: 'hello',
          room_id: '!room:example.com'
        })
      )
      expect(res.results.length).toBe(1)
      expect(res.results[0]?.eventId).toBe('$event_1')
      expect(res.results[0]?.sender).toBe('@alice:example.com')
      expect(res.results[0]?.timestamp).toBe(1234567890)
      expect(res.count).toBe(1)
      expect(res.highlights).toEqual(['hello'])
    })

    it('returns empty results for blank query without calling SearchManager', async () => {
      const res = await matrixSearchService.searchRoomMessages('!room:example.com', '   ')

      expect(searchMgr.searchMessageText).not.toHaveBeenCalled()
      expect(res.results).toEqual([])
      expect(res.count).toBe(0)
      expect(res.highlights).toEqual([])
    })

    it('throws when client is not initialized', async () => {
      vi.mocked(matrixClientService.getClient).mockReturnValue(null)

      await expect(matrixSearchService.searchRoomMessages('!room:example.com', 'hello')).rejects.toThrow()
    })

    it('propagates errors from SearchManager', async () => {
      searchMgr.searchMessageText.mockRejectedValue(new Error('network down'))

      await expect(matrixSearchService.searchRoomMessages('!room:example.com', 'hello')).rejects.toThrow('network down')
    })

    it('defaults count/highlights when omitted by server', async () => {
      searchMgr.searchMessageText.mockResolvedValue({
        search_categories: {
          room_events: {
            results: [
              {
                result: {
                  room_id: '!room:example.com',
                  event_id: '$event_2',
                  sender: '@bob:example.com',
                  content: { body: 'hi', msgtype: 'm.text' },
                  origin_server_ts: 1
                }
              }
            ]
          }
        }
      })

      const res = await matrixSearchService.searchRoomMessages('!room:example.com', 'hi')

      expect(res.results.length).toBe(1)
      expect(res.count).toBe(1)
      expect(res.highlights).toEqual([])
    })
  })

  describe('searchUsers via SearchManager', () => {
    it('should throw when client is not initialized', async () => {
      vi.mocked(matrixClientService.getClient).mockReturnValue(null)

      await expect(matrixSearchService.searchUsers('test')).rejects.toThrow()
    })

    it('calls getSearchManager().searchUserDirectory and maps results', async () => {
      searchMgr.searchUserDirectory.mockResolvedValue({
        results: [{ user_id: '@alice:hs', display_name: 'Alice', avatar_url: 'mxc://hs/a' }],
        limited: false
      })

      const results = await matrixSearchService.searchUsers('alice', 10)

      expect(searchMgr.searchUserDirectory).toHaveBeenCalledWith({ term: 'alice', limit: 10 })
      expect(results).toEqual([
        {
          userId: '@alice:hs',
          displayName: 'Alice',
          avatarUrl: 'mxc://hs/a'
        }
      ])
    })

    it('returns empty array on M_UNAUTHORIZED/M_FORBIDDEN instead of throwing', async () => {
      searchMgr.searchUserDirectory.mockRejectedValue(new Error('M_FORBIDDEN'))

      const results = await matrixSearchService.searchUsers('test')
      expect(results).toEqual([])
    })

    it('rethrows non-auth errors', async () => {
      searchMgr.searchUserDirectory.mockRejectedValue(new Error('network down'))

      await expect(matrixSearchService.searchUsers('test')).rejects.toThrow('network down')
    })
  })
})
