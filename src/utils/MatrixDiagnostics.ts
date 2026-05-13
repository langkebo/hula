import { matrixWorkerHost } from '@/services/matrix/MatrixWorkerHost'
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
    try {
      const data = matrixWorkerHost.isStarted
        ? await matrixWorkerHost.getServerVersions(this.homeserverUrl)
        : await fetch(`${this.homeserverUrl}/_matrix/client/versions`).then((r) => r.json())

      if (data.versions && data.versions.length > 0) {
        return {
          name: 'API Versions',
          status: 'success',
          message: `支持的版本: ${data.versions.join(', ')}`,
          details: data
        }
      }

      return {
        name: 'API Versions',
        status: 'error',
        message: '未找到支持的 API 版本'
      }
    } catch (error) {
      return {
        name: 'API Versions',
        status: 'error',
        message: `无法连接到服务器: ${error}`
      }
    }
  }

  private async checkLoginFlows(): Promise<DiagnosticResult> {
    try {
      const data = matrixWorkerHost.isStarted
        ? await matrixWorkerHost.getLoginFlows(this.homeserverUrl)
        : await fetch(`${this.homeserverUrl}/_matrix/client/v3/login`).then((r) => r.json())

      if (data.flows && data.flows.length > 0) {
        const flowTypes = data.flows.map((f: { type: string }) => f.type)
        return {
          name: 'Login Flows',
          status: 'success',
          message: `支持的登录方式: ${flowTypes.join(', ')}`,
          details: data
        }
      }

      return {
        name: 'Login Flows',
        status: 'warning',
        message: '未找到登录流程'
      }
    } catch (error) {
      return {
        name: 'Login Flows',
        status: 'error',
        message: `检查登录流程失败: ${error}`
      }
    }
  }

  private async checkSlidingSyncEndpoint(): Promise<DiagnosticResult> {
    const endpoints = [
      '/_matrix/client/v3/sync',
      '/_matrix/client/unstable/org.matrix.msc3575/sync',
      '/_matrix/client/unstable/org.matrix.simplified_msc3575/sync'
    ]

    let results: Array<{ endpoint: string; status: number | 'error'; available: boolean; error?: string }>

    if (matrixWorkerHost.isStarted) {
      results = await matrixWorkerHost.probeSlidingSyncEndpoints(this.homeserverUrl, endpoints)
    } else {
      results = []
      for (const endpoint of endpoints) {
        try {
          const response = await fetch(`${this.homeserverUrl}${endpoint}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({})
          })

          results.push({
            endpoint,
            status: response.status,
            available: response.status !== 404
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
        message: `找到 ${availableEndpoints.length} 个可用端点`,
        details: results
      }
    }

    return {
      name: 'Sliding Sync Endpoints',
      status: 'error',
      message: '未找到可用的 Sliding Sync 端点',
      details: results
    }
  }

  private async checkCORS(): Promise<DiagnosticResult> {
    try {
      const corsHeaders = matrixWorkerHost.isStarted
        ? await matrixWorkerHost.probeCors(this.homeserverUrl)
        : await (async () => {
            const response = await fetch(`${this.homeserverUrl}/_matrix/client/versions`, {
              method: 'OPTIONS'
            })
            return {
              'access-control-allow-origin': response.headers.get('access-control-allow-origin'),
              'access-control-allow-methods': response.headers.get('access-control-allow-methods'),
              'access-control-allow-headers': response.headers.get('access-control-allow-headers')
            }
          })()

      if (corsHeaders['access-control-allow-origin']) {
        return {
          name: 'CORS Configuration',
          status: 'success',
          message: 'CORS 配置正常',
          details: corsHeaders
        }
      }

      return {
        name: 'CORS Configuration',
        status: 'warning',
        message: 'CORS 头部缺失',
        details: corsHeaders
      }
    } catch (error) {
      return {
        name: 'CORS Configuration',
        status: 'error',
        message: `CORS 检查失败: ${error}`
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

// 导出到全局作用域供浏览器控制台使用
if (typeof window !== 'undefined') {
  ;(window as unknown as Record<string, unknown>).runMatrixDiagnostics = runMatrixDiagnostics
}
