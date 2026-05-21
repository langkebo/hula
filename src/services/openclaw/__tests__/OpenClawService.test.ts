import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/services/ai-provider', () => ({
  isAIExtensionEnabled: () => true
}))

describe('OpenClawService', () => {
  beforeEach(() => {
    vi.resetModules()
    vi.unstubAllGlobals()
  })

  afterEach(() => {
    vi.clearAllMocks()
    vi.unstubAllGlobals()
  })

  it('marks connect as failed when the gateway check is unsuccessful', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: false
    })
    vi.stubGlobal('fetch', fetchMock)

    const { useOpenClaw, ConnectionState } = await import('../OpenClawService')
    const openClaw = useOpenClaw()

    await expect(
      openClaw.connect({
        gatewayUrl: 'http://127.0.0.1:18789',
        token: 'invalid-token'
      })
    ).rejects.toThrow('OpenClaw Gateway 不可用或鉴权失败')

    expect(openClaw.isConnected.value).toBe(false)
    expect(openClaw.connectionState.value.state).toBe(ConnectionState.Error)
    expect(openClaw.error.value).toContain('OpenClaw Gateway 不可用或鉴权失败')
  })

  it('stops an active streaming response when stopCurrentRequest is called', async () => {
    const fetchMock = vi.fn().mockImplementation((_input: string, init?: RequestInit) => {
      const signal = init?.signal

      return new Promise((_, reject) => {
        signal?.addEventListener('abort', () => reject(new DOMException('The operation was aborted.', 'AbortError')), {
          once: true
        })
      })
    })
    vi.stubGlobal('fetch', fetchMock)

    const { openClawClient } = await import('../OpenClawService')

    openClawClient.configure({
      gatewayUrl: 'http://127.0.0.1:18789',
      token: 'test-token'
    })

    const iterator = openClawClient.sendChatCompletion([{ role: 'user', content: 'hello' }], {
      model: 'main'
    })

    const nextChunk = iterator.next()
    openClawClient.stopCurrentRequest()

    await expect(nextChunk).rejects.toThrow()
  })
})
