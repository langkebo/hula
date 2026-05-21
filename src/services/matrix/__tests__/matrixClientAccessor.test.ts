import { beforeEach, describe, expect, it, vi } from 'vitest'
import * as accessorModule from '../matrixClientAccessor'

const { warnMock } = vi.hoisted(() => ({
  warnMock: vi.fn()
}))

vi.mock('@tauri-apps/plugin-log', () => ({
  info: vi.fn(),
  warn: warnMock,
  error: vi.fn()
}))

describe('matrixClientAccessor', () => {
  beforeEach(() => {
    accessorModule.resetMatrixClientAccessorForTests()
    warnMock.mockClear()
  })

  it('prefers explicitly registered accessor', async () => {
    accessorModule.setMatrixClientAccessor({
      getClient: () => ({ id: 'explicit-client' }) as never,
      getAccessToken: () => 'explicit-token',
      getHomeserverUrl: () => 'https://explicit.example.com',
      waitForClientReady: async () => ({ id: 'ready-client' }) as never
    })

    expect(accessorModule.hasRegisteredMatrixClientAccessor()).toBe(true)
    expect(accessorModule.getMatrixAccessToken()).toBe('explicit-token')
    expect(accessorModule.getMatrixHomeserverUrl()).toBe('https://explicit.example.com')
    expect(accessorModule.getMatrixClient()).toEqual({ id: 'explicit-client' })
    await expect(accessorModule.waitForMatrixClientReady()).resolves.toEqual({ id: 'ready-client' })
  })

  it('returns null or rejects when accessor is not registered', async () => {
    expect(accessorModule.hasRegisteredMatrixClientAccessor()).toBe(false)
    expect(accessorModule.getMatrixAccessToken()).toBeNull()
    expect(accessorModule.getMatrixHomeserverUrl()).toBeNull()
    expect(accessorModule.getMatrixClient()).toBeNull()
    await expect(accessorModule.waitForMatrixClientReady()).rejects.toThrow('Matrix client accessor is not registered')
    expect(warnMock).toHaveBeenCalledTimes(1)
  })
})
