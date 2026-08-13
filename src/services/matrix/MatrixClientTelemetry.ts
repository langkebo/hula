/**
 * MatrixClientTelemetry — 遥测与 manager 统计协作类
 *
 * 承载 MatrixClientService 的遥测相关职责：
 * - getTelemetry：获取 SDK TelemetryManager 实例
 * - getManagerStatsList：遍历 client 上所有 getXxxManager() 访问器，
 *   聚合各 manager 的 getRequestStats() 统计
 *
 * 通过 deps 注入主类持有的协作模块（connectionManager）。
 * TelemetryManager 实例由本类持有，主类在 initialize 后调用 setTelemetryManager。
 */
import type { TelemetryManager } from '@/services/matrix/sdk'
import type { MatrixConnectionManager } from './MatrixConnectionManager'

/** 单个 manager 的请求统计快照 */
export interface ManagerRequestStats {
  total: number
  successful: number
  failed: number
  retried: number
}

/** getManagerStatsList 返回的条目类型 */
export interface ManagerStatsEntry {
  name: string
  stats: ManagerRequestStats
}

/** Telemetry 子服务依赖的主类协作模块集合 */
export interface MatrixClientTelemetryDeps {
  readonly connectionManager: MatrixConnectionManager
}

/**
 * 遥测协作类。
 *
 * 持有 TelemetryManager 引用（由主类在 client 创建后注入），
 * 其余状态由 deps 中的 connectionManager 提供。
 */
export class MatrixClientTelemetry {
  private telemetryManager: TelemetryManager | null = null

  constructor(private readonly deps: MatrixClientTelemetryDeps) {}

  /** 设置遥测管理器
   */
  setTelemetryManager(manager: TelemetryManager | null): void {
    this.telemetryManager = manager
  }

  /** 获取遥测数据
   */
  getTelemetry(): TelemetryManager | null {
    return this.telemetryManager
  }

  /** 获取管理器统计列表
   */
  getManagerStatsList(): ManagerStatsEntry[] {
    const client = this.deps.connectionManager.getClient()
    if (!client) return []

    const results: ManagerStatsEntry[] = []
    const getterNames = this.extractManagerGetterNames(client)

    for (const getterName of getterNames) {
      const getter: unknown = (client as unknown as Record<string, unknown>)[getterName]
      if (typeof getter !== 'function') continue
      try {
        const manager = (getter as () => unknown).call(client)
        if (
          manager &&
          typeof (manager as { getRequestStats?: () => ManagerRequestStats }).getRequestStats === 'function'
        ) {
          const stats = (manager as { getRequestStats: () => ManagerRequestStats }).getRequestStats()
          const managerName = this.toManagerMetricName(getterName)
          results.push({ name: managerName, stats })
        }
      } catch {
        // ignore individual manager access errors
      }
    }

    return results
  }

  private extractManagerGetterNames(client: object): string[] {
    const getterNames = new Set<string>()
    let prototype = Object.getPrototypeOf(client)

    while (prototype && prototype !== Object.prototype) {
      for (const name of Object.getOwnPropertyNames(prototype)) {
        if (name !== 'constructor' && /^get[A-Z].*Manager$/.test(name)) {
          getterNames.add(name)
        }
      }
      prototype = Object.getPrototypeOf(prototype)
    }

    return [...getterNames]
  }

  private toManagerMetricName(getterName: string): string {
    const baseName = getterName.replace(/^get/, '').replace(/Manager$/, '')
    return baseName ? baseName.charAt(0).toLowerCase() + baseName.slice(1) : getterName
  }
}
