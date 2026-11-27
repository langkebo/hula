import { useI18nGlobal } from '@/services/i18n'
import { matrixWorkerHost } from '@/services/matrix/MatrixWorkerHost'
import { CLIENT_VERSIONS, MATRIX_PATHS, PREFIX_V3 } from '@/services/matrix/paths'
import { hasTauriRuntime } from '@/utils/AppHarness'
import { HttpClient } from '@/utils/HttpClient'
import { createLogger } from './Logger'
import { classifySlidingSyncEndpointStatus, isSlidingSyncAuthRequiredStatus } from './slidingSyncEndpointStatus'

const logger = createLogger('MatrixDiagnostics')

export interface DiagnosticResult {
  name: string
  status: 'success' | 'warning' | 'error'
  message: string
  details?: unknown
}

/**
 * 从 HTTP 异常中提取状态码。
 *
 * 两条探测路径抛出的错误形状不同：
 * - 主线程走 `HttpClient`，抛 `HttpClientError`，状态码在 `status`；
 * - SDK / 部分旧代码抛 `MatrixError` 形状，状态码在 `httpStatus`。
 * 只认 `httpStatus` 会让 401（端点存在但需认证）被当成网络错误，误报「未找到」。
 */
function extractHttpStatus(error: unknown): number | undefined {
  if (typeof error !== 'object' || error === null) return undefined
  const record = error as { status?: unknown; httpStatus?: unknown }
  if (typeof record.status === 'number') return record.status
  if (typeof record.httpStatus === 'number') return record.httpStatus
  return undefined
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
        : await HttpClient.get<{ versions?: string[] }>(`${this.homeserverUrl}${CLIENT_VERSIONS}`, {
            // homeserver 由 env/用户配置（动态 host）
            allowDynamicHost: true
          })

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
        : await HttpClient.get<{ flows?: Array<{ type: string }> }>(`${this.homeserverUrl}${PREFIX_V3}/login`, {
            // homeserver 由 env/用户配置（动态 host）
            allowDynamicHost: true
          })

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

    let probes: Array<{ endpoint: string; status: number | 'error'; error?: string }>

    if (matrixWorkerHost.isStarted) {
      probes = await matrixWorkerHost.probeSlidingSyncEndpoints(this.homeserverUrl, endpoints)
    } else {
      probes = []
      for (const endpoint of endpoints) {
        try {
          // Sliding Sync 是 POST 端点：用 GET 探测会得到 405（Method Not Allowed）。
          // 与 worker 侧一致——POST 空 body，只有 404/501 才代表未实现；
          // 400/401/403/405/429 说明端点已路由。
          await HttpClient.post<Record<string, unknown>>(
            `${this.homeserverUrl}${endpoint}`,
            {},
            { allowDynamicHost: true }
          )
          probes.push({ endpoint, status: 200 })
        } catch (error) {
          const httpStatus = extractHttpStatus(error)
          probes.push({
            endpoint,
            status: httpStatus ?? 'error',
            error: String(error)
          })
        }
      }
    }

    // 三态：可用（含需鉴权）/ 未实现（404、501）/ 不可达（网络异常等无法确认）
    const results = probes.map((probe) => ({
      ...probe,
      state: classifySlidingSyncEndpointStatus(probe.status)
    }))
    const available = results.filter((r) => r.state === 'available')
    const notImplemented = results.filter((r) => r.state === 'not_implemented')

    if (available.length > 0) {
      const needsAuth = available.some((r) => isSlidingSyncAuthRequiredStatus(r.status))
      return {
        name: 'Sliding Sync Endpoints',
        status: 'success',
        message: needsAuth
          ? t('diagnostics.sliding_sync_requires_auth', { count: available.length })
          : t('diagnostics.sliding_sync_found', { count: available.length }),
        details: results
      }
    }

    if (notImplemented.length > 0) {
      return {
        name: 'Sliding Sync Endpoints',
        status: 'error',
        message: t('diagnostics.sliding_sync_not_implemented'),
        details: results
      }
    }

    // 网络异常 / 5xx：无法确认端点是否存在，不能用「未实现」的结论误导用户
    return {
      name: 'Sliding Sync Endpoints',
      status: 'warning',
      message: t('diagnostics.sliding_sync_unreachable'),
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
            await HttpClient.get<{ versions?: string[] }>(`${this.homeserverUrl}${CLIENT_VERSIONS}`, {
              allowDynamicHost: true
            })
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

async function runMatrixDiagnostics(homeserverUrl: string): Promise<void> {
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
  Object.assign(window, { runMatrixDiagnostics })
}
