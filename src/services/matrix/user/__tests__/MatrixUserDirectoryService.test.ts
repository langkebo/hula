import type { MatrixClient } from 'matrix-js-sdk'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const { mockClientService } = vi.hoisted(() => ({
  mockClientService: {
    getClient: vi.fn(() => null as MatrixClient | null)
  }
}))

vi.mock('@tauri-apps/plugin-log', () => ({
  info: vi.fn(),
  error: vi.fn()
}))

vi.mock('../../MatrixClientService', () => ({
  matrixClientService: mockClientService
}))

const { userDirectoryService } = await import('../MatrixUserDirectoryService')

describe('MatrixUserDirectoryService', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockClientService.getClient.mockReturnValue(null)
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
    mockClientService.getClient.mockReturnValue(client as unknown as MatrixClient)

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
    mockClientService.getClient.mockReturnValue(newClient as unknown as MatrixClient)

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
