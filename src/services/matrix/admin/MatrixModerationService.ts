import matrixClientService from '../MatrixClientService'
import { info, error } from '@tauri-apps/plugin-log'

export interface Report {
  id: string
  eventId: string
  roomId: string
  reporterUserId: string
  reportedUserId: string
  reason: string
  score: number
  status: 'open' | 'resolved' | 'dismissed'
  createdAt: number
  resolvedAt?: number
  resolvedBy?: string
  resolution?: string
}

export interface ReportFilters {
  status?: 'open' | 'resolved' | 'dismissed'
  roomId?: string
  reporterUserId?: string
  reportedUserId?: string
  from?: number
  to?: number
  limit?: number
  offset?: number
}

export interface UserReputation {
  userId: string
  score: number
  level: 'good' | 'neutral' | 'warning' | 'bad'
  reportCount: number
  lastReportAt?: number
  restrictions: string[]
}

export interface ContentFilter {
  id: string
  type: 'keyword' | 'regex' | 'image_hash'
  pattern: string
  action: 'flag' | 'block' | 'quarantine'
  enabled: boolean
  createdAt: number
  updatedAt: number
  hitCount: number
}

export interface CreateContentFilterRequest {
  type: 'keyword' | 'regex' | 'image_hash'
  pattern: string
  action: 'flag' | 'block' | 'quarantine'
}

export interface ResolveReportRequest {
  action: 'dismiss' | 'warn' | 'mute' | 'ban'
  notes?: string
}

type ModerationListener =
  | ((report: Report) => void)
  | ((reputation: UserReputation) => void)
  | ((filter: ContentFilter) => void)
  | ((filterId: string) => void)
  | ((err: Error) => void)

interface ModerationManager {
  start(): Promise<void>
  stop(): void
  on(event: string, callback: ModerationListener): void
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

class MatrixModerationService {
  private moderationManager: ModerationManager | null = null
  private observedClient: ReturnType<typeof matrixClientService.getClient> | null = null
  private managerStarted = false
  private eventListeners: Map<string, Set<(...args: unknown[]) => void>> = new Map()

  private setupEventListeners(manager: ModerationManager): void {
    manager.removeAllListeners()

    manager.on(ModerationEvent.ReportCreated, (report: Report) => {
      this.emit('reportCreated', report)
      info(`[MatrixModeration] 新举报: ${report.id}`)
    })

    manager.on(ModerationEvent.ReportResolved, (report: Report) => {
      this.emit('reportResolved', report)
      info(`[MatrixModeration] 举报已处理: ${report.id}`)
    })

    manager.on(ModerationEvent.UserReputationChanged, (reputation: UserReputation) => {
      this.emit('reputationChanged', reputation)
      info(`[MatrixModeration] 用户信誉变更: ${reputation.userId}`)
    })

    manager.on(ModerationEvent.ContentFilterAdded, (filter: ContentFilter) => {
      this.emit('filterAdded', filter)
      info(`[MatrixModeration] 内容过滤器添加: ${filter.id}`)
    })

    manager.on(ModerationEvent.ContentFilterRemoved, (filterId: string) => {
      this.emit('filterRemoved', filterId)
      info(`[MatrixModeration] 内容过滤器移除: ${filterId}`)
    })

    manager.on(ModerationEvent.Error, (err: Error) => {
      this.emit('error', err)
      error(`[MatrixModeration] 错误: ${err.message}`)
    })
  }

  private async ensureManager(throwOnMissing = true): Promise<ModerationManager | null> {
    const client = matrixClientService.getClient()
    if (!client) {
      if (throwOnMissing) {
        throw new Error('[MatrixModeration] 客户端未初始化')
      }
      return null
    }

    const manager = (client as unknown as { moderationManager?: ModerationManager }).moderationManager ?? null
    if (!manager) {
      if (throwOnMissing) {
        throw new Error('[MatrixModeration] ModerationManager 未初始化')
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
      this.setupEventListeners(manager)
    }

    if (!this.managerStarted) {
      await manager.start()
      this.managerStarted = true
    }

    return manager
  }

  private async getManager(): Promise<ModerationManager> {
    const manager = await this.ensureManager(false)
    if (!manager) {
      throw new Error('[MatrixModeration] ModerationManager 未初始化')
    }
    return manager
  }

  async initialize(): Promise<void> {
    const manager = await this.ensureManager(false)
    if (!manager) {
      error('[MatrixModeration] ModerationManager 未在客户端上找到')
      return
    }

    info('[MatrixModeration] ModerationService 初始化完成')
  }

  async getReports(filters?: ReportFilters): Promise<Report[]> {
    const manager = await this.getManager()
    try {
      const reports = await manager.getReports(filters)
      info(`[MatrixModeration] 获取举报列表: ${reports.length} 条`)
      return reports
    } catch (err) {
      error(`[MatrixModeration] 获取举报列表失败: ${err}`)
      throw err
    }
  }

  async resolveReport(reportId: string, request: ResolveReportRequest): Promise<void> {
    const manager = await this.getManager()
    try {
      await manager.resolveReport(reportId, request)
      info(`[MatrixModeration] 处理举报成功: ${reportId} -> ${request.action}`)
    } catch (err) {
      error(`[MatrixModeration] 处理举报失败: ${err}`)
      throw err
    }
  }

  async getUserReputation(userId: string): Promise<UserReputation> {
    const manager = await this.getManager()
    try {
      const reputation = await manager.getUserReputation(userId)
      info(`[MatrixModeration] 获取用户信誉: ${userId} -> ${reputation.level}`)
      return reputation
    } catch (err) {
      error(`[MatrixModeration] 获取用户信誉失败: ${err}`)
      throw err
    }
  }

  async setUserReputation(userId: string, score: number): Promise<void> {
    const manager = await this.getManager()
    try {
      await manager.setUserReputation(userId, score)
      info(`[MatrixModeration] 设置用户信誉: ${userId} -> ${score}`)
    } catch (err) {
      error(`[MatrixModeration] 设置用户信誉失败: ${err}`)
      throw err
    }
  }

  async getContentFilters(): Promise<ContentFilter[]> {
    const manager = await this.getManager()
    try {
      const filters = await manager.getContentFilters()
      info(`[MatrixModeration] 获取内容过滤器: ${filters.length} 条`)
      return filters
    } catch (err) {
      error(`[MatrixModeration] 获取内容过滤器失败: ${err}`)
      throw err
    }
  }

  async addContentFilter(filter: CreateContentFilterRequest): Promise<ContentFilter> {
    const manager = await this.getManager()
    try {
      const result = await manager.addContentFilter(filter)
      info(`[MatrixModeration] 添加内容过滤器: ${result.id}`)
      return result
    } catch (err) {
      error(`[MatrixModeration] 添加内容过滤器失败: ${err}`)
      throw err
    }
  }

  async removeContentFilter(filterId: string): Promise<void> {
    const manager = await this.getManager()
    try {
      await manager.removeContentFilter(filterId)
      info(`[MatrixModeration] 移除内容过滤器: ${filterId}`)
    } catch (err) {
      error(`[MatrixModeration] 移除内容过滤器失败: ${err}`)
      throw err
    }
  }

  stop(): void {
    if (this.moderationManager) {
      this.moderationManager.stop()
      this.moderationManager.removeAllListeners()
      this.moderationManager = null
    }
    this.observedClient = null
    this.managerStarted = false
    this.eventListeners.clear()
    info('[MatrixModeration] ModerationService 已停止')
  }

  on(event: string, callback: (...args: unknown[]) => void): void {
    if (!this.eventListeners.has(event)) {
      this.eventListeners.set(event, new Set())
    }
    this.eventListeners.get(event)!.add(callback)
  }

  off(event: string, callback: (...args: unknown[]) => void): void {
    const listeners = this.eventListeners.get(event)
    if (listeners) {
      listeners.delete(callback)
    }
  }

  private emit(event: string, data?: unknown): void {
    const listeners = this.eventListeners.get(event)
    if (listeners) {
      listeners.forEach((callback) => callback(data))
    }
  }
}

export const matrixModerationService = new MatrixModerationService()
export default matrixModerationService
