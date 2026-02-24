import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import matrixClientService from '../MatrixClientService'

vi.mock('@tauri-apps/plugin-log', () => ({
  info: vi.fn(),
  error: vi.fn(),
  warn: vi.fn()
}))

describe('MatrixClientService', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.resetAllMocks()
  })

  describe('initialization', () => {
    it('should not have client initially', () => {
      expect(matrixClientService.getClient()).toBeNull()
    })
  })

  describe('logout', () => {
    it('should handle logout when not logged in', async () => {
      await expect(matrixClientService.logout()).resolves.not.toThrow()
    })
  })

  describe('getConnectionState', () => {
    it('should return DISCONNECTED when client is null', () => {
      expect(matrixClientService.getConnectionState()).toBe('DISCONNECTED')
    })
  })

  describe('getSSOLoginUrl', () => {
    it('should throw error when client is not initialized', async () => {
      await expect(matrixClientService.getSSOLoginUrl()).rejects.toThrow('客户端未初始化')
    })
  })
})
