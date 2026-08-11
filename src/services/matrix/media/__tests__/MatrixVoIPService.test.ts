import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { MatrixClient } from '@/services/matrix/sdk'
import matrixClientService from '../../MatrixClientService'

vi.mock('@tauri-apps/plugin-log', () => ({
  info: vi.fn(),
  error: vi.fn(),
  warn: vi.fn()
}))

const { matrixVoIPService } = await import('../MatrixVoIPService')

describe('MatrixVoIPService', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.spyOn(matrixClientService, 'getClient').mockReturnValue(null)
    ;(matrixVoIPService as unknown as { calls: Map<string, unknown> }).calls.clear()
    ;(matrixVoIPService as unknown as { callHandlers: Map<string, unknown> }).callHandlers.clear()
    ;(matrixVoIPService as unknown as { localStream: unknown }).localStream = null
    ;(matrixVoIPService as unknown as { screenStream: unknown }).screenStream = null
    ;(matrixVoIPService as unknown as { observedClient: unknown }).observedClient = null
  })

  it('rebinds call listeners and clears runtime calls when matrix client changes', async () => {
    const oldListeners = new Map<string, (...args: unknown[]) => void>()
    const newListeners = new Map<string, (...args: unknown[]) => void>()
    const oldClient = {
      voipHandler: {},
      on: vi.fn((event: string, handler: (...args: unknown[]) => void) => {
        oldListeners.set(event, handler)
      }),
      off: vi.fn((event: string) => {
        oldListeners.delete(event)
      })
    }
    const newClient = {
      voipHandler: {},
      on: vi.fn((event: string, handler: (...args: unknown[]) => void) => {
        newListeners.set(event, handler)
      }),
      off: vi.fn((event: string) => {
        newListeners.delete(event)
      })
    }

    vi.mocked(matrixClientService.getClient).mockReturnValue(oldClient as unknown as MatrixClient)
    await matrixVoIPService.initialize()

    oldListeners.get('Call.incoming')?.({
      callId: 'old-call',
      roomId: '!old:example.com',
      isVideo: false
    })

    expect(matrixVoIPService.getActiveCalls()).toHaveLength(1)

    vi.mocked(matrixClientService.getClient).mockReturnValue(newClient as unknown as MatrixClient)
    await matrixVoIPService.initialize()

    expect(oldClient.off).toHaveBeenCalledWith('Call.incoming', expect.any(Function))
    expect(oldClient.off).toHaveBeenCalledWith('Call.hangup', expect.any(Function))
    expect(oldClient.off).toHaveBeenCalledWith('Call.replaced', expect.any(Function))
    expect(newClient.on).toHaveBeenCalledWith('Call.incoming', expect.any(Function))
    expect(newClient.on).toHaveBeenCalledWith('Call.hangup', expect.any(Function))
    expect(newClient.on).toHaveBeenCalledWith('Call.replaced', expect.any(Function))
    expect(matrixVoIPService.getActiveCalls()).toEqual([])
  })
})
