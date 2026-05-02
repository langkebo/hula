import type { MatrixClient } from 'matrix-js-sdk'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import matrixClientService from '../../MatrixClientService'
import { matrixAccountService } from '../MatrixAccountService'

vi.mock('../../MatrixClientService', () => ({
  default: {
    getClient: vi.fn()
  }
}))

vi.mock('@tauri-apps/plugin-log', () => ({
  info: vi.fn(),
  error: vi.fn(),
  warn: vi.fn()
}))

describe('MatrixAccountService - 3PID Management', () => {
  let mockClient: Partial<MatrixClient>
  let mockHttp: { authedRequest: ReturnType<typeof vi.fn> }

  beforeEach(() => {
    mockHttp = {
      authedRequest: vi.fn()
    }

    mockClient = {
      http: mockHttp as unknown as MatrixClient['http'],
      addThreePidOnly: vi.fn(),
      bindThreePid: vi.fn(),
      deleteThreePid: vi.fn(),
      unbindThreePid: vi.fn(),
      requestAdd3pidEmailToken: vi.fn(),
      requestAdd3pidMsisdnToken: vi.fn()
    }

    vi.mocked(matrixClientService.getClient).mockReset()
    vi.mocked(matrixClientService.getClient).mockReturnValue(mockClient as MatrixClient)
  })

  describe('addThreePid', () => {
    it('should add 3PID with sid and clientSecret', async () => {
      vi.mocked(mockClient.addThreePidOnly!).mockResolvedValue(undefined)

      await matrixAccountService.addThreePid('sid123', 'secret456')

      expect(mockClient.addThreePidOnly).toHaveBeenCalledWith({ sid: 'sid123', client_secret: 'secret456' }, false)
    })

    it('should add 3PID with bind=true', async () => {
      vi.mocked(mockClient.addThreePidOnly!).mockResolvedValue(undefined)

      await matrixAccountService.addThreePid('sid123', 'secret456', true)

      expect(mockClient.addThreePidOnly).toHaveBeenCalledWith({ sid: 'sid123', client_secret: 'secret456' }, true)
    })

    it('should throw when client is not initialized', async () => {
      vi.mocked(matrixClientService.getClient).mockReturnValue(null)

      await expect(matrixAccountService.addThreePid('sid', 'secret')).rejects.toThrow('客户端未初始化')
    })
  })

  describe('bindThreePid', () => {
    it('should bind 3PID with all parameters', async () => {
      vi.mocked(mockClient.bindThreePid!).mockResolvedValue(undefined)

      await matrixAccountService.bindThreePid('sid123', 'secret456', 'email', 'test@example.com')

      expect(mockClient.bindThreePid).toHaveBeenCalledWith({
        sid: 'sid123',
        client_secret: 'secret456',
        medium: 'email',
        address: 'test@example.com'
      })
    })

    it('should throw when client is not initialized', async () => {
      vi.mocked(matrixClientService.getClient).mockReturnValue(null)

      await expect(matrixAccountService.bindThreePid('sid', 'secret', 'email', 'a@b.com')).rejects.toThrow(
        '客户端未初始化'
      )
    })
  })

  describe('deleteThreePid', () => {
    it('should delete email 3PID', async () => {
      vi.mocked(mockClient.deleteThreePid!).mockResolvedValue({ id_server_unbind_result: 'success' })

      await matrixAccountService.deleteThreePid('email', 'test@example.com')

      expect(mockClient.deleteThreePid).toHaveBeenCalledWith({
        medium: 'email',
        address: 'test@example.com'
      })
    })

    it('should delete msisdn 3PID', async () => {
      vi.mocked(mockClient.deleteThreePid!).mockResolvedValue({ id_server_unbind_result: 'success' })

      await matrixAccountService.deleteThreePid('msisdn', '+1234567890')

      expect(mockClient.deleteThreePid).toHaveBeenCalledWith({
        medium: 'msisdn',
        address: '+1234567890'
      })
    })
  })

  describe('unbindThreePid', () => {
    it('should unbind 3PID', async () => {
      vi.mocked(mockClient.unbindThreePid!).mockResolvedValue({ id_server_unbind_result: 'success' })

      await matrixAccountService.unbindThreePid('email', 'test@example.com')

      expect(mockClient.unbindThreePid).toHaveBeenCalledWith({
        medium: 'email',
        address: 'test@example.com'
      })
    })
  })

  describe('requestEmailTokenFor3Pid', () => {
    it('should request email token and return sid', async () => {
      vi.mocked(mockClient.requestAdd3pidEmailToken!).mockResolvedValue({ sid: 'email_sid_123' })

      const result = await matrixAccountService.requestEmailTokenFor3Pid('test@example.com', 'client_secret')

      expect(result.sid).toBe('email_sid_123')
      expect(mockClient.requestAdd3pidEmailToken).toHaveBeenCalledWith('client_secret', 'test@example.com', 1)
    })

    it('should respect custom sendAttempt', async () => {
      vi.mocked(mockClient.requestAdd3pidEmailToken!).mockResolvedValue({ sid: 'sid' })

      await matrixAccountService.requestEmailTokenFor3Pid('test@example.com', 'secret', 3)

      expect(mockClient.requestAdd3pidEmailToken).toHaveBeenCalledWith('secret', 'test@example.com', 3)
    })
  })

  describe('requestMsisdnTokenFor3Pid', () => {
    it('should request msisdn token and return result', async () => {
      vi.mocked(mockClient.requestAdd3pidMsisdnToken!).mockResolvedValue({
        sid: 'msisdn_sid_123',
        msisdn: '+1234567890',
        submit_url: 'https://example.com/submit'
      } as unknown as Awaited<ReturnType<MatrixClient['requestAdd3pidMsisdnToken']>>)

      const result = await matrixAccountService.requestMsisdnTokenFor3Pid('1', '234567890', 'secret')

      expect(result.sid).toBe('msisdn_sid_123')
      expect(result.msisdn).toBe('+1234567890')
    })
  })
})
