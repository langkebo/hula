import { beforeEach, describe, expect, it, vi } from 'vitest'
import { matrixClientService } from '../../MatrixClientService'
import { synapseThirdpartyService } from '../SynapseThirdpartyService'

vi.mock('../../MatrixClientService', () => ({
  matrixClientService: {
    getClient: vi.fn()
  }
}))

vi.mock('@/services/i18n', () => ({
  useI18nGlobal: () => ({ t: (key: string) => key })
}))

describe('SynapseThirdpartyService', () => {
  const getClientMock = matrixClientService.getClient as ReturnType<typeof vi.fn>

  let manager: {
    getThirdpartyProtocols: ReturnType<typeof vi.fn>
    getThirdpartyLocation: ReturnType<typeof vi.fn>
    getThirdpartyUser: ReturnType<typeof vi.fn>
  }

  beforeEach(() => {
    getClientMock.mockReset()
    manager = {
      getThirdpartyProtocols: vi.fn(),
      getThirdpartyLocation: vi.fn(),
      getThirdpartyUser: vi.fn()
    }
    getClientMock.mockReturnValue({ getThirdPartyManager: () => manager })
  })

  describe('getThirdpartyProtocols', () => {
    it('returns {} when the Matrix client is not initialized', async () => {
      getClientMock.mockReturnValue(null)
      const result = await synapseThirdpartyService.getThirdpartyProtocols()
      expect(result).toEqual({})
      expect(manager.getThirdpartyProtocols).not.toHaveBeenCalled()
    })

    it('returns the protocols on success', async () => {
      manager.getThirdpartyProtocols.mockResolvedValue({ 'm.room.message': { field_types: [], locations: [] } })
      const result = await synapseThirdpartyService.getThirdpartyProtocols()
      expect(result).toEqual({ 'm.room.message': { field_types: [], locations: [] } })
    })

    it('returns {} when the backend returns null', async () => {
      manager.getThirdpartyProtocols.mockResolvedValue(null)
      const result = await synapseThirdpartyService.getThirdpartyProtocols()
      expect(result).toEqual({})
    })

    it('returns {} when the request fails', async () => {
      manager.getThirdpartyProtocols.mockRejectedValue(new Error('down'))
      const result = await synapseThirdpartyService.getThirdpartyProtocols()
      expect(result).toEqual({})
    })
  })

  describe('getThirdpartyLocation', () => {
    it('returns [] when the Matrix client is not initialized', async () => {
      getClientMock.mockReturnValue(null)
      const result = await synapseThirdpartyService.getThirdpartyLocation('protocol')
      expect(result).toEqual([])
      expect(manager.getThirdpartyLocation).not.toHaveBeenCalled()
    })

    it('returns the locations on success', async () => {
      manager.getThirdpartyLocation.mockResolvedValue([{ alias: '#room:hs', protocol: 'protocol' }])
      const result = await synapseThirdpartyService.getThirdpartyLocation('protocol', { alias: '#room:hs' })
      expect(result).toEqual([{ alias: '#room:hs', protocol: 'protocol' }])
      expect(manager.getThirdpartyLocation).toHaveBeenCalledWith('protocol', { alias: '#room:hs' })
    })

    it('returns [] when the backend returns null', async () => {
      manager.getThirdpartyLocation.mockResolvedValue(null)
      const result = await synapseThirdpartyService.getThirdpartyLocation('protocol')
      expect(result).toEqual([])
    })

    it('returns [] when the request fails', async () => {
      manager.getThirdpartyLocation.mockRejectedValue(new Error('down'))
      const result = await synapseThirdpartyService.getThirdpartyLocation('protocol')
      expect(result).toEqual([])
    })
  })

  describe('getThirdpartyUser', () => {
    it('returns [] when the Matrix client is not initialized', async () => {
      getClientMock.mockReturnValue(null)
      const result = await synapseThirdpartyService.getThirdpartyUser('protocol')
      expect(result).toEqual([])
      expect(manager.getThirdpartyUser).not.toHaveBeenCalled()
    })

    it('returns the users on success', async () => {
      manager.getThirdpartyUser.mockResolvedValue([{ userid: '@u:hs', protocol: 'protocol' }])
      const result = await synapseThirdpartyService.getThirdpartyUser('protocol', { userid: '@u:hs' })
      expect(result).toEqual([{ userid: '@u:hs', protocol: 'protocol' }])
      expect(manager.getThirdpartyUser).toHaveBeenCalledWith('protocol', { userid: '@u:hs' })
    })

    it('returns [] when the backend returns null', async () => {
      manager.getThirdpartyUser.mockResolvedValue(null)
      const result = await synapseThirdpartyService.getThirdpartyUser('protocol')
      expect(result).toEqual([])
    })

    it('returns [] when the request fails', async () => {
      manager.getThirdpartyUser.mockRejectedValue(new Error('down'))
      const result = await synapseThirdpartyService.getThirdpartyUser('protocol')
      expect(result).toEqual([])
    })
  })
})
