import type { MatrixClient } from 'matrix-js-sdk'
import { useI18nGlobal } from '@/services/i18n'
import * as MatrixClientServiceModule from './MatrixClientService'

const matrixClientServiceExports = MatrixClientServiceModule as Record<string, unknown>
const matrixClientService = (
  'default' in matrixClientServiceExports
    ? matrixClientServiceExports['default']
    : matrixClientServiceExports['matrixClientService']
) as {
  getClient(): MatrixClient | null
}

export abstract class BaseMatrixService {
  private fallbackClient: MatrixClient | null = null
  private hasExplicitFallback = false

  protected readonly t = (key: string, params: Record<string, unknown> = {}): string => useI18nGlobal().t(key, params)

  protected setFallbackClient(client: MatrixClient): void {
    this.fallbackClient = client
    this.hasExplicitFallback = true
  }

  protected getClient(): MatrixClient {
    const client = matrixClientService.getClient() ?? (this.hasExplicitFallback ? this.fallbackClient : null)
    if (!client) {
      throw new Error(this.t('matrix_error.common.client_not_initialized'))
    }
    if (this.hasExplicitFallback && this.fallbackClient !== client) {
      this.fallbackClient = client
    }
    return client
  }
}
