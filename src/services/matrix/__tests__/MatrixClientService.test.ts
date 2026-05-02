import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
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

  describe('sdk listeners lifecycle', () => {
    it('should not register duplicate sdk listeners for same client', () => {
      const client = {
        on: vi.fn(),
        off: vi.fn()
      }

      ;(matrixClientService as unknown as { client: unknown }).client = client
      ;(matrixClientService as unknown as { observedClient: unknown }).observedClient = null

      ;(matrixClientService as unknown as { setupEventListeners: () => void }).setupEventListeners()
      ;(matrixClientService as unknown as { setupEventListeners: () => void }).setupEventListeners()

      expect(client.on).toHaveBeenCalledTimes(3)
      expect(client.off).not.toHaveBeenCalled()
    })

    it('should detach old sdk listeners when client changes', () => {
      const oldClient = {
        on: vi.fn(),
        off: vi.fn()
      }
      const newClient = {
        on: vi.fn(),
        off: vi.fn()
      }

      ;(matrixClientService as unknown as { client: unknown }).client = oldClient
      ;(matrixClientService as unknown as { observedClient: unknown }).observedClient = null
      ;(matrixClientService as unknown as { setupEventListeners: () => void }).setupEventListeners()

      ;(matrixClientService as unknown as { client: unknown }).client = newClient
      ;(matrixClientService as unknown as { setupEventListeners: () => void }).setupEventListeners()

      expect(oldClient.off).toHaveBeenCalledTimes(3)
      expect(newClient.on).toHaveBeenCalledTimes(3)
    })
  })
})
