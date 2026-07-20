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
})
