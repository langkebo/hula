import type { MatrixClient } from 'matrix-js-sdk'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import matrixClientService from '../../MatrixClientService'
import { userDirectoryService } from '../MatrixUserDirectoryService'

vi.mock('@tauri-apps/plugin-log', () => ({
  info: vi.fn(),
  error: vi.fn()
}))

describe('MatrixUserDirectoryService', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.spyOn(matrixClientService, 'getClient').mockReturnValue(null)
  })

  it('falls back to matrixClientService client when searching users', async () => {
    const client = {
      searchUserDirectory: vi.fn().mockResolvedValue({
        results: [
          {
            user_id: '@alice:example.com',
            display_name: 'Alice',
            avatar_url: 'mxc://example/avatar'
          }
        ]
      })
    }
    vi.mocked(matrixClientService.getClient).mockReturnValue(client as unknown as MatrixClient)

    const result = await userDirectoryService.searchUsers('alice', 5)

    expect(client.searchUserDirectory).toHaveBeenCalledWith({
      term: 'alice',
      limit: 5
    })
    expect(result).toEqual([
      {
        userId: '@alice:example.com',
        displayName: 'Alice',
        avatarUrl: 'mxc://example/avatar'
      }
    ])
  })

  it('refreshes cached client when matrixClientService returns a new client', async () => {
    const oldClient = {
      searchUserDirectory: vi.fn().mockResolvedValue({ results: [] })
    }
    const newClient = {
      searchUserDirectory: vi.fn().mockResolvedValue({
        results: [
          {
            user_id: '@bob:example.com',
            display_name: 'Bob'
          }
        ]
      })
    }
    vi.mocked(matrixClientService.getClient).mockReturnValue(newClient as unknown as MatrixClient)

    userDirectoryService.initialize(oldClient as unknown as MatrixClient)
    const result = await userDirectoryService.searchUsers('bob')

    expect(oldClient.searchUserDirectory).not.toHaveBeenCalled()
    expect(newClient.searchUserDirectory).toHaveBeenCalledWith({
      term: 'bob',
      limit: 10
    })
    expect(result[0].userId).toBe('@bob:example.com')
  })

  it('listUserDirectory delegates to UserDirectoryManager.listUserDirectoryPaginated', async () => {
    const listUserDirectoryPaginated = vi.fn().mockResolvedValue({
      users: [
        {
          user_id: '@alice:server',
          display_name: 'Alice',
          avatar_url: 'mxc://example/avatar'
        }
      ],
      next_batch: 'next123'
    })
    vi.mocked(matrixClientService.getClient).mockReturnValue({
      getUserDirectoryManager: () => ({ listUserDirectoryPaginated })
    } as unknown as MatrixClient)

    const result = await userDirectoryService.listUserDirectory(50, 'cursor123')

    expect(listUserDirectoryPaginated).toHaveBeenCalledWith(50, 'cursor123')
    expect(result.users).toHaveLength(1)
    expect(result.users[0]).toEqual({
      userId: '@alice:server',
      displayName: 'Alice',
      avatarUrl: 'mxc://example/avatar'
    })
    expect(result.next_batch).toBe('next123')
  })

  it('listUserDirectory returns empty users when manager throws', async () => {
    const listUserDirectoryPaginated = vi.fn().mockRejectedValue(new Error('network down'))
    vi.mocked(matrixClientService.getClient).mockReturnValue({
      getUserDirectoryManager: () => ({ listUserDirectoryPaginated })
    } as unknown as MatrixClient)

    const result = await userDirectoryService.listUserDirectory(50)

    expect(listUserDirectoryPaginated).toHaveBeenCalledWith(50, undefined)
    expect(result.users).toEqual([])
    expect(result.next_batch).toBeUndefined()
  })
})
