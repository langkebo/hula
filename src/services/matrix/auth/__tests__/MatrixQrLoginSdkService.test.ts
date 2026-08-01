import { describe, expect, it, vi } from 'vitest'

const mockGenerateQrLoginToken = vi.fn().mockResolvedValue({
  login_token: 'token123',
  expires_in_ms: 60000
})

vi.mock('matrix-js-sdk', async (importOriginal) => {
  const actual = await importOriginal<typeof import('matrix-js-sdk')>()
  return {
    ...actual,
    MSC4108SignInWithQR: vi.fn().mockImplementation(function () {
      return { generateQrLoginToken: mockGenerateQrLoginToken }
    })
  }
})

// reciprocateLogin() never calls loadSdkRendezvous(), but the module's dynamic
// import('matrix-js-sdk/rendezvous') is statically analysed by vite at transform
// time. The SDK's `exports` map has no "./rendezvous" subpath, so we stub it
// here to let the module load. The stub is never invoked by the code under test.
vi.mock('matrix-js-sdk/rendezvous', () => ({
  MSC4108RendezvousSession: vi.fn(),
  MSC4108SecureChannel: vi.fn()
}))

vi.mock('@tauri-apps/plugin-log', () => ({
  info: vi.fn(),
  error: vi.fn(),
  warn: vi.fn()
}))

vi.mock('../../MatrixClientService', () => ({
  default: {
    getClient: vi.fn(() => null)
  }
}))

import matrixClientService from '../../MatrixClientService'
import { matrixQrLoginSdkService } from '../MatrixQrLoginSdkService'

describe('MatrixQrLoginSdkService', () => {
  describe('reciprocateLogin', () => {
    it('uses MSC4108SignInWithQR.generateQrLoginToken instead of authedRequest', async () => {
      // Mock client
      const mockClient = {
        getDomain: vi.fn().mockReturnValue('example.com'),
        getHomeserverUrl: vi.fn().mockReturnValue('https://example.com'),
        getUserId: vi.fn().mockReturnValue('@user:example.com'),
        getDeviceId: vi.fn().mockReturnValue('DEV001'),
        http: { authedRequest: vi.fn() } // should NOT be called for qr_token
      }
      vi.mocked(matrixClientService.getClient).mockReturnValue(mockClient as never)

      // Mock channel with sequential secureReceive responses
      const mockChannel = {
        connect: vi.fn().mockResolvedValue(undefined),
        secureSend: vi.fn().mockResolvedValue(undefined),
        secureReceive: vi
          .fn()
          .mockResolvedValueOnce({ type: 'm.login.protocol', protocol: 'm.login.token', device_id: 'newdev' })
          .mockResolvedValueOnce({ type: 'm.login.success', user_id: '@user:example.com', device_id: 'newdev' }),
        close: vi.fn().mockResolvedValue(undefined),
        cancel: vi.fn().mockResolvedValue(undefined)
      }
      ;(matrixQrLoginSdkService as unknown as { channel: unknown; session: unknown }).channel = mockChannel
      ;(matrixQrLoginSdkService as unknown as { channel: unknown; session: unknown }).session = { id: 'test-session' }

      mockGenerateQrLoginToken.mockClear()

      const result = await matrixQrLoginSdkService.reciprocateLogin()

      expect(mockGenerateQrLoginToken).toHaveBeenCalled()
      expect(mockClient.http.authedRequest).not.toHaveBeenCalled()
      expect(result.user_id).toBe('@user:example.com')
    })
  })
})
