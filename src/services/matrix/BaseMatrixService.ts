import type { MatrixClient } from 'matrix-js-sdk'
import { useI18nGlobal } from '@/services/i18n'
import type { MatrixClientProvider } from './MatrixClientProvider'
import { matrixClientService } from './MatrixClientService'

const productionProvider: MatrixClientProvider = {
  getClient: () => matrixClientService.getClient(),
  waitForClientReady: (opts) => matrixClientService.waitForClientReady(opts)
}

export abstract class BaseMatrixService {
  private fallbackClient: MatrixClient | null = null
  private hasExplicitFallback = false
  private readonly provider: MatrixClientProvider

  protected readonly t = (key: string, params: Record<string, unknown> = {}): string => useI18nGlobal().t(key, params)

  constructor(provider?: MatrixClientProvider) {
    this.provider = provider ?? productionProvider
  }

  protected setFallbackClient(client: MatrixClient): void {
    this.fallbackClient = client
    this.hasExplicitFallback = true
  }

  protected getClient(): MatrixClient {
    const client = this.provider.getClient() ?? (this.hasExplicitFallback ? this.fallbackClient : null)
    if (!client) {
      throw new Error(this.t('matrix_error.common.client_not_initialized'))
    }
    if (this.hasExplicitFallback && this.fallbackClient !== client) {
      this.fallbackClient = client
    }
    return client
  }

  protected getProvider(): MatrixClientProvider {
    return this.provider
  }
}
