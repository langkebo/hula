import { beforeEach, describe, expect, it, vi } from 'vitest'
import { BaseMatrixService } from '../BaseMatrixService'
import type { MatrixClientProvider } from '../MatrixClientProvider'
import type { MatrixClient } from '../sdk'

vi.mock('../MatrixClientService', () => ({
  matrixClientService: {
    getClient: vi.fn(),
    waitForClientReady: vi.fn()
  }
}))

const asUnknown = <T>(value: unknown): T => value as unknown as T

class TestService extends BaseMatrixService {
  callGetClient(): MatrixClient {
    return this.getClient()
  }

  callSetFallbackClient(client: MatrixClient): void {
    this.setFallbackClient(client)
  }

  callGetProvider(): MatrixClientProvider {
    return this.getProvider()
  }
}

function makeClient(id = 'client'): MatrixClient {
  return asUnknown<MatrixClient>({ id })
}

function makeProvider(): MatrixClientProvider {
  return {
    getClient: vi.fn(),
    waitForClientReady: vi.fn()
  }
}

describe('BaseMatrixService', () => {
  let provider: MatrixClientProvider

  beforeEach(() => {
    vi.clearAllMocks()
    provider = makeProvider()
  })

  it('getClient returns the client from the provider when present', () => {
    const client = makeClient('provider-client')
    ;(provider.getClient as ReturnType<typeof vi.fn>).mockReturnValue(client)
    const service = new TestService(provider)
    expect(service.callGetClient()).toBe(client)
  })

  it('getClient throws when the provider has no client and no fallback is set', () => {
    ;(provider.getClient as ReturnType<typeof vi.fn>).mockReturnValue(null)
    const service = new TestService(provider)
    expect(() => service.callGetClient()).toThrow()
  })

  it('getClient returns the fallback client when the provider returns null', () => {
    ;(provider.getClient as ReturnType<typeof vi.fn>).mockReturnValue(null)
    const fallback = makeClient('fallback-client')
    const service = new TestService(provider)
    service.callSetFallbackClient(fallback)
    expect(service.callGetClient()).toBe(fallback)
  })

  it('getClient prefers the provider client over an explicitly set fallback', () => {
    const client = makeClient('provider-client')
    ;(provider.getClient as ReturnType<typeof vi.fn>).mockReturnValue(client)
    const fallback = makeClient('fallback-client')
    const service = new TestService(provider)
    service.callSetFallbackClient(fallback)
    expect(service.callGetClient()).toBe(client)
  })

  it('getProvider returns the injected provider', () => {
    const service = new TestService(provider)
    expect(service.callGetProvider()).toBe(provider)
  })

  it('getProvider returns the default production provider when none is passed', () => {
    const service = new TestService()
    const defaultProvider = service.callGetProvider()
    expect(defaultProvider.getClient).toBeDefined()
    expect(defaultProvider.waitForClientReady).toBeDefined()
  })
})
