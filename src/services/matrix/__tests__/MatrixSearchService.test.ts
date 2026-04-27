import { describe, it, expect, vi, beforeEach } from 'vitest'
import matrixClientService from '../MatrixClientService'
import { matrixSearchService } from '../MatrixSearchService'
import type { MatrixClient } from 'matrix-js-sdk'

vi.mock('../MatrixClientService', () => ({
  default: {
    getClient: vi.fn()
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
      vi.mocked(matrixClientService.getClient).mockReturnValue(null as any)

      await expect(matrixSearchService.searchMessages('test')).rejects.toThrow()
    })

    it('should return empty array when no results', async () => {
      mockClient.search = vi.fn().mockResolvedValue({
        search_categories: { room_events: { results: [], count: 0 } }
      })

      const results = await matrixSearchService.searchMessages('nonexistent')
      expect(results).toEqual([])
    })
  })

  describe('searchUsers', () => {
    it('should throw when client is not initialized', async () => {
      vi.mocked(matrixClientService.getClient).mockReturnValue(null as any)

      await expect(matrixSearchService.searchUsers('test')).rejects.toThrow()
    })
  })
})
