import { useI18nGlobal } from '@/services/i18n'
import { matrixWorkerHost } from '@/services/matrix/MatrixWorkerHost'
import { MATRIX_PATHS } from '@/services/matrix/paths'
import { hasTauriRuntime } from '@/utils/AppHarness'
import { HttpClient } from '@/utils/HttpClient'
import { createLogger } from './Logger'

const logger = createLogger('MatrixDiagnostics')

export interface DiagnosticResult {
  name: string
  status: 'success' | 'warning' | 'error'
  message: string
  details?: unknown
}

export class MatrixDiagnostics {
  private homeserverUrl: string
  constructor(homeserverUrl: string) {
    this.homeserverUrl = homeserverUrl
  }

  async runAll(): Promise<DiagnosticResult[]> {
    const results: DiagnosticResult[] = []

    results.push(await this.checkVersions())
    results.push(await this.checkLoginFlows())
    results.push(await this.checkSlidingSyncEndpoint())
    results.push(await this.checkCORS())

    return results
  }

  private async checkVersions(): Promise<DiagnosticResult> {
    const { t } = useI18nGlobal()
    try {
      const data = matrixWorkerHost.isStarted
        ? await matrixWorkerHost.getServerVersions(this.homeserverUrl)
        : await HttpClient.get<{ versions?: string[] }>(`${this.homeserverUrl}/_matrix/client/versions`)

      if (data.versions && data.versions.length > 0) {
        return {
          name: 'API Versions',
          status: 'success',
          message: t('diagnostics.versions_supported', { versions: data.versions.join(', ') }),
          details: data
        }
      }

      return {
        name: 'API Versions',
        status: 'error',
        message: t('diagnostics.versions_not_found')
      }
    } catch (error) {
      return {
        name: 'API Versions',
        status: 'error',
        message: t('diagnostics.connection_failed', { error: String(error) })
      }
    }
  }

  private async checkLoginFlows(): Promise<DiagnosticResult> {
    const { t } = useI18nGlobal()
    try {
      const data = matrixWorkerHost.isStarted
        ? await matrixWorkerHost.getLoginFlows(this.homeserverUrl)
        : await HttpClient.get<{ flows?: Array<{ type: string }> }>(`${this.homeserverUrl}/_matrix/client/v3/login`)

      if (data.flows && data.flows.length > 0) {
        const flowTypes = data.flows.map((f: { type: string }) => f.type)
        return {
          name: 'Login Flows',
          status: 'success',
          message: t('diagnostics.login_flows_supported', { flows: flowTypes.join(', ') }),
          details: data
        }
      }

      return {
        name: 'Login Flows',
        status: 'warning',
        message: t('diagnostics.login_flows_not_found')
      }
    } catch (error) {
      return {
        name: 'Login Flows',
        status: 'error',
        message: t('diagnostics.login_flows_check_failed', { error: String(error) })
      }
    }
  }

  private async checkSlidingSyncEndpoint(): Promise<DiagnosticResult> {
    const { t } = useI18nGlobal()
    const endpoints = [...MATRIX_PATHS.SYNC.SLIDING_SYNC_CANDIDATES]

    let results: Array<{ endpoint: string; status: number | 'error'; available: boolean; error?: string }>

    if (matrixWorkerHost.isStarted) {
      results = await matrixWorkerHost.probeSlidingSyncEndpoints(this.homeserverUrl, endpoints)
    } else {
      results = []
      for (const endpoint of endpoints) {
        try {
          await HttpClient.get<Record<string, unknown>>(`${this.homeserverUrl}${endpoint}`)
          results.push({
            endpoint,
            status: 200,
            available: true
          })
        } catch (error) {
          results.push({
            endpoint,
            status: 'error',
            available: false,
            error: String(error)
          })
        }
      }
    }

    const availableEndpoints = results.filter((r) => r.available)

    if (availableEndpoints.length > 0) {
      return {
        name: 'Sliding Sync Endpoints',
        status: 'success',
        message: t('diagnostics.sliding_sync_found', { count: availableEndpoints.length }),
        details: results
      }
    }

    return {
      name: 'Sliding Sync Endpoints',
      status: 'error',
      message: t('diagnostics.sliding_sync_not_found'),
      details: results
    }
  }

  private async checkCORS(): Promise<DiagnosticResult> {
    const { t } = useI18nGlobal()

    // Tauri 原生 fetch 绕过浏览器 CORS，CORS 检查不适用
    if (hasTauriRuntime()) {
      return {
        name: 'CORS Configuration',
        status: 'success',
        message: t('diagnostics.cors_not_required', { defaultValue: '桌面端使用原生网络请求，无需 CORS 配置' })
      }
    }

    try {
      const corsHeaders = matrixWorkerHost.isStarted
        ? await matrixWorkerHost.probeCors(this.homeserverUrl)
        : await (async () => {
            await HttpClient.get<{ versions?: string[] }>(`${this.homeserverUrl}/_matrix/client/versions`)
            return {
              'access-control-allow-origin': '*',
              'access-control-allow-methods': '*',
              'access-control-allow-headers': '*'
            }
          })()

      if (corsHeaders['access-control-allow-origin']) {
        return {
          name: 'CORS Configuration',
          status: 'success',
          message: t('diagnostics.cors_ok'),
          details: corsHeaders
        }
      }

      return {
        name: 'CORS Configuration',
        status: 'warning',
        message: t('diagnostics.cors_headers_missing'),
        details: corsHeaders
      }
    } catch (error) {
      return {
        name: 'CORS Configuration',
        status: 'error',
        message: t('diagnostics.cors_check_failed', { error: String(error) })
      }
    }
  }
}

export async function runMatrixDiagnostics(homeserverUrl: string): Promise<void> {
  const diagnostics = new MatrixDiagnostics(homeserverUrl)
  const results = await diagnostics.runAll()

  logger.info('=== Matrix 诊断报告 ===')
  for (const result of results) {
    const icon = result.status === 'success' ? '✅' : result.status === 'warning' ? '⚠️' : '❌'
    logger.info(`${icon} ${result.name}: ${result.message}`)
    if (result.details) {
      logger.debug('详细信息:', result.details)
    }
  }
}

if (typeof window !== 'undefined') {
  ;(window as unknown as Record<string, unknown>).runMatrixDiagnostics = runMatrixDiagnostics
}
