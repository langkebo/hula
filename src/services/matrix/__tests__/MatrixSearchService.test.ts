import type { MatrixClient } from 'matrix-js-sdk'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import matrixClientService from '../MatrixClientService'
import { matrixSearchService } from '../MatrixSearchService'
import matrixWorkerHost from '../MatrixWorkerHost'

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

describe('MatrixSearchService', () => {
  let mockClient: Partial<MatrixClient>

  beforeEach(() => {
    mockClient = {
      search: vi.fn(),
      getUserId: vi.fn(() => '@user:example.com'),
      getRoom: vi.fn()
    }

    vi.mocked(matrixClientService.getClient).mockReset()
    vi.mocked(matrixClientService.getClient).mockReturnValue(mockClient as MatrixClient)
    vi.mocked(matrixWorkerHost.querySearchIndex).mockReset()
    vi.mocked(matrixWorkerHost.querySearchIndex).mockResolvedValue({ messages: [] })
    vi.mocked(matrixWorkerHost, true).isStarted = false
  })

  describe('searchMessages', () => {
    it('should search messages with query', async () => {
      mockClient.search = vi.fn().mockResolvedValue({
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

      expect(mockClient.search).toHaveBeenCalledWith(
        expect.objectContaining({
          search_categories: expect.objectContaining({
            room_events: expect.objectContaining({
              search_term: 'hello'
            })
          })
        })
      )
      expect(results.length).toBeGreaterThan(0)
    })

    it('should search messages within a specific room', async () => {
      mockClient.search = vi.fn().mockResolvedValue({
        search_categories: { room_events: { results: [], count: 0 } }
      })

      await matrixSearchService.searchMessages('test', { roomId: '!room:example.com' })

      expect(mockClient.search).toHaveBeenCalledWith(
        expect.objectContaining({
          search_categories: {
            room_events: expect.objectContaining({
              filter: expect.objectContaining({
                rooms: ['!room:example.com']
              })
            })
          }
        })
      )
    })

    it('should throw when client is not initialized', async () => {
      vi.mocked(matrixClientService.getClient).mockReturnValue(null)

      await expect(matrixSearchService.searchMessages('test')).rejects.toThrow()
    })

    it('should return empty array when no results', async () => {
      mockClient.search = vi.fn().mockResolvedValue({
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
      expect(mockClient.search).not.toHaveBeenCalled()
      expect(results[0]?.eventId).toBe('$local_1')
      expect(results[0]?.content.body).toBe('hello from worker')
    })

    it('should fall back to remote search when hybrid search misses locally', async () => {
      vi.mocked(matrixWorkerHost, true).isStarted = true
      mockClient.search = vi.fn().mockResolvedValue({
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
      expect(mockClient.search).toHaveBeenCalled()
      expect(results[0]?.eventId).toBe('$remote_1')
    })
  })

  describe('searchUsers', () => {
    it('should throw when client is not initialized', async () => {
      vi.mocked(matrixClientService.getClient).mockReturnValue(null)

      await expect(matrixSearchService.searchUsers('test')).rejects.toThrow()
    })
  })
})
