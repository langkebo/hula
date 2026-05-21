import { error, info } from '@tauri-apps/plugin-log'
import type { MatrixClient } from 'matrix-js-sdk'
import type {
  ContentFilter,
  CreateContentFilterRequest,
  Report,
  ReportFilters,
  ResolveReportRequest,
  UserReputation
} from './AdminTypes'

type GetClientGetter = () => MatrixClient

interface ModerationManager {
  start(): Promise<void>
  stop(): void
  on(event: string, callback: (...args: unknown[]) => void): void
  removeAllListeners(): void
  getReports(filters?: ReportFilters): Promise<Report[]>
  resolveReport(reportId: string, request: ResolveReportRequest): Promise<void>
  getUserReputation(userId: string): Promise<UserReputation>
  setUserReputation(userId: string, score: number): Promise<void>
  getContentFilters(): Promise<ContentFilter[]>
  addContentFilter(filter: CreateContentFilterRequest): Promise<ContentFilter>
  removeContentFilter(filterId: string): Promise<void>
}

const ModerationEvent = {
  ReportCreated: 'Moderation.report.created',
  ReportResolved: 'Moderation.report.resolved',
  UserReputationChanged: 'Moderation.reputation.changed',
  ContentFilterAdded: 'Moderation.filter.added',
  ContentFilterRemoved: 'Moderation.filter.removed',
  Error: 'Moderation.error'
} as const

export class AdminModerationService {
  private moderationManager: ModerationManager | null = null
  private observedClient: ReturnType<typeof this.getClient> | null = null
  private managerStarted = false
  private eventListeners: Map<string, Set<(...args: unknown[]) => void>> = new Map()

  constructor(private readonly getClient: GetClientGetter) {}

  private async ensureModerationManager(throwOnMissing = true): Promise<ModerationManager | null> {
    const client = this.getClient()
    const manager = (client as unknown as { moderationManager?: ModerationManager }).moderationManager ?? null
    if (!manager) {
      if (throwOnMissing) {
        throw new Error('[AdminModeration] moderationManager 未初始化')
      }
      return null
    }

    if (this.observedClient !== client || this.moderationManager !== manager) {
      if (this.moderationManager && this.moderationManager !== manager) {
        this.moderationManager.stop()
        this.moderationManager.removeAllListeners()
      }

      this.observedClient = client
      this.moderationManager = manager
      this.managerStarted = false
      this.setupModerationEventListeners(manager)
    }

    if (!this.managerStarted) {
      await manager.start()
      this.managerStarted = true
    }

    return manager
  }

  private setupModerationEventListeners(manager: ModerationManager): void {
    manager.removeAllListeners()

    manager.on(ModerationEvent.ReportCreated, (...args: unknown[]) => {
      const report = args[0] as Report
      this.emitModerationEvent('reportCreated', report)
      info(`[Admin] 新举报: ${report.id}`)
    })

    manager.on(ModerationEvent.ReportResolved, (...args: unknown[]) => {
      const report = args[0] as Report
      this.emitModerationEvent('reportResolved', report)
      info(`[Admin] 举报已处理: ${report.id}`)
    })

    manager.on(ModerationEvent.UserReputationChanged, (...args: unknown[]) => {
      const reputation = args[0] as UserReputation
      this.emitModerationEvent('reputationChanged', reputation)
      info(`[Admin] 用户信誉变更: ${reputation.userId}`)
    })

    manager.on(ModerationEvent.ContentFilterAdded, (...args: unknown[]) => {
      const filter = args[0] as ContentFilter
      this.emitModerationEvent('filterAdded', filter)
      info(`[Admin] 内容过滤器添加: ${filter.id}`)
    })

    manager.on(ModerationEvent.ContentFilterRemoved, (...args: unknown[]) => {
      const filterId = args[0] as string
      this.emitModerationEvent('filterRemoved', filterId)
      info(`[Admin] 内容过滤器移除: ${filterId}`)
    })

    manager.on(ModerationEvent.Error, (...args: unknown[]) => {
      const err = args[0] as Error
      this.emitModerationEvent('error', err)
      error(`[Admin] Moderation 错误: ${err.message}`)
    })
  }

  private emitModerationEvent(event: string, data?: unknown): void {
    const listeners = this.eventListeners.get(event)
    if (listeners) {
      listeners.forEach((callback) => callback(data))
    }
  }

  onModerationEvent(event: string, callback: (...args: unknown[]) => void): void {
    if (!this.eventListeners.has(event)) {
      this.eventListeners.set(event, new Set())
    }
    this.eventListeners.get(event)!.add(callback)
  }

  offModerationEvent(event: string, callback: (...args: unknown[]) => void): void {
    const listeners = this.eventListeners.get(event)
    if (listeners) {
      listeners.delete(callback)
    }
  }

  stopModeration(): void {
    if (this.moderationManager) {
      this.moderationManager.stop()
      this.moderationManager.removeAllListeners()
      this.moderationManager = null
    }
    this.observedClient = null
    this.managerStarted = false
    this.eventListeners.clear()
    info('[Admin] Moderation 已停止')
  }

  async getModerationReports(filters?: ReportFilters): Promise<Report[]> {
    const manager = (await this.ensureModerationManager())!
    try {
      const reports = await manager.getReports(filters)
      info(`[Admin] 获取举报列表: ${reports.length} 条`)
      return reports
    } catch (err) {
      error(`[Admin] 获取举报列表失败: ${err}`)
      throw err
    }
  }

  async resolveModerationReport(reportId: string, request: ResolveReportRequest): Promise<void> {
    const manager = (await this.ensureModerationManager())!
    try {
      await manager.resolveReport(reportId, request)
      info(`[Admin] 处理举报成功: ${reportId} -> ${request.action}`)
    } catch (err) {
      error(`[Admin] 处理举报失败: ${err}`)
      throw err
    }
  }

  async getUserReputation(userId: string): Promise<UserReputation> {
    const manager = (await this.ensureModerationManager())!
    try {
      const reputation = await manager.getUserReputation(userId)
      info(`[Admin] 获取用户信誉: ${userId} -> ${reputation.level}`)
      return reputation
    } catch (err) {
      error(`[Admin] 获取用户信誉失败: ${err}`)
      throw err
    }
  }

  async setUserReputation(userId: string, score: number): Promise<void> {
    const manager = (await this.ensureModerationManager())!
    try {
      await manager.setUserReputation(userId, score)
      info(`[Admin] 设置用户信誉: ${userId} -> ${score}`)
    } catch (err) {
      error(`[Admin] 设置用户信誉失败: ${err}`)
      throw err
    }
  }

  async getContentFilters(): Promise<ContentFilter[]> {
    const manager = (await this.ensureModerationManager())!
    try {
      const filters = await manager.getContentFilters()
      info(`[Admin] 获取内容过滤器: ${filters.length} 条`)
      return filters
    } catch (err) {
      error(`[Admin] 获取内容过滤器失败: ${err}`)
      throw err
    }
  }

  async addContentFilter(filter: CreateContentFilterRequest): Promise<ContentFilter> {
    const manager = (await this.ensureModerationManager())!
    try {
      const result = await manager.addContentFilter(filter)
      info(`[Admin] 添加内容过滤器: ${result.id}`)
      return result
    } catch (err) {
      error(`[Admin] 添加内容过滤器失败: ${err}`)
      throw err
    }
  }

  async removeContentFilter(filterId: string): Promise<void> {
    const manager = (await this.ensureModerationManager())!
    try {
      await manager.removeContentFilter(filterId)
      info(`[Admin] 移除内容过滤器: ${filterId}`)
    } catch (err) {
      error(`[Admin] 移除内容过滤器失败: ${err}`)
      throw err
    }
  }
}
