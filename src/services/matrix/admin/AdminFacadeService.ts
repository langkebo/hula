import type { MatrixClient } from 'matrix-js-sdk'
import { TauriCommand } from '@/enums'
import { hasTauriRuntime } from '@/utils/AppHarness'
import { createLogger } from '@/utils/Logger'
import { invokeWithResult } from '@/utils/TauriInvokeHandler'
import { AdminApiProbeService } from './AdminApiProbeService'
import { AdminFacadeUserRoomMethods } from './AdminFacadeUserRoomMethods'
import { AdminModerationService } from './AdminModerationService'
import { AdminServerNotificationService } from './AdminServerNotificationService'
import type { AdminServerConfigInfo, ServerHealth, ServerStats, ServerStatus, ServerVersion } from './AdminTypes'
import { AdminApplicationService } from './ApplicationService'
import { AdminBackgroundUpdateService } from './BackgroundUpdateService'
import { AdminExternalServiceService } from './ExternalServiceService'
import { AdminFederationService } from './FederationService'
import { AdminMediaService } from './MediaService'
import { AdminNotificationService } from './NotificationService'
import { AdminQuotaService } from './QuotaService'
import { AdminRegistrationTokensService } from './RegistrationTokensService'
import { AdminReportService } from './ReportService'
import { AdminRetentionService } from './RetentionService'
import { AdminRoomService } from './RoomService'
import { AdminSecurityService } from './SecurityService'
import { AdminServerService } from './ServerService'
import { AdminTelemetryService } from './TelemetryService'
import { AdminUserService } from './UserService'

const logger = createLogger('AdminFacadeService')

class AdminFacadeService extends AdminFacadeUserRoomMethods {
  private adminVerifiedAt = 0
  private readonly ADMIN_VERIFY_INTERVAL = 2 * 60 * 1000
  private cachedAdminStatus = false

  /** Admin API 可用性探测（按错误分类；只许缩不许增的体积受管文件里，此处只保留一行字段）。 */
  readonly apiProbe = new AdminApiProbeService(() => this.getClient())

  readonly registrationTokens = new AdminRegistrationTokensService(() => this.sdkAdmin())
  readonly users = new AdminUserService(
    () => this.sdkAdmin(),
    () => this.getClient()
  )
  readonly rooms = new AdminRoomService(
    () => this.sdkAdmin(),
    () => this.getClient()
  )
  readonly security = new AdminSecurityService(() => this.sdkAdmin())
  readonly server = new AdminServerService(() => this.sdkAdmin())
  readonly media = new AdminMediaService(() => this.sdkAdmin())
  // biome-ignore lint/suspicious/noExplicitAny: SDK admin type differs from service wrapper type
  readonly notifications = new AdminNotificationService(() => this.sdkAdmin() as Promise<any>)
  readonly serverNotifications = new AdminServerNotificationService(() => this.sdkAdmin())
  readonly retention = new AdminRetentionService(
    () => this.sdkAdmin(),
    () => this.getClient()
  )
  readonly applications = new AdminApplicationService(
    async () =>
      (await this.sdkAdmin()) as import('matrix-js-sdk/admin').AdminManager &
        import('./ApplicationService').ApplicationServiceAdmin
  )
  readonly reports = new AdminReportService(
    () => this.sdkAdmin(),
    () => this.getClient()
  )
  readonly quota = new AdminQuotaService(
    () => this.sdkAdmin(),
    () => this.getClient()
  )
  readonly federation = new AdminFederationService(() => this.sdkAdmin())
  readonly moderation = new AdminModerationService(() => this.getClient())
  readonly backgroundUpdates = new AdminBackgroundUpdateService(() => this.getClient())
  readonly externalServices = new AdminExternalServiceService(() => this.getClient())
  readonly telemetry = new AdminTelemetryService(() => this.getClient())

  initialize(): void {
    logger.info('[Admin] 服务已初始化')
  }

  clearAdminApiCache(): void {
    this.adminVerifiedAt = 0
    this.cachedAdminStatus = false
  }

  private async verifyServerSidePermission(): Promise<boolean> {
    try {
      // 客户端尚未初始化时（启动早期竞态），跳过权限验证，
      // 避免 "客户端未初始化" 错误产生误导性 ERROR 日志。
      // 由 AdminStore.checkAdminStatus() 在 isLoggedIn 变为 true 后重新触发。
      let client: import('matrix-js-sdk').MatrixClient | null = null
      try {
        client = this.getClient()
      } catch {
        logger.debug('[Admin] 客户端尚未就绪，跳过权限验证（待连接后自动重试）')
        return false
      }

      const userId = client.getUserId()
      const accessToken = client.getAccessToken()

      if (!userId || !accessToken) {
        logger.warn('[Admin] 服务端权限验证: 缺少 userId 或 accessToken')
        return false
      }

      const now = Date.now()
      if (now - this.adminVerifiedAt < this.ADMIN_VERIFY_INTERVAL) {
        return this.cachedAdminStatus
      }

      // 浏览器 dev 模式（无 Tauri runtime）：走 AdminManager.getUser（v2）验证
      if (!hasTauriRuntime()) {
        try {
          const userInfo = await this.getClient().getAdminManager().getUser(userId)
          const isAdmin = Boolean(userInfo?.admin)
          this.cachedAdminStatus = isAdmin
          this.adminVerifiedAt = now
          if (!isAdmin) {
            logger.warn(`[Admin] 浏览器模式权限验证失败: userId=${userId}, isAdmin=false`)
          }
          return isAdmin
        } catch (err) {
          logger.error(`[Admin] 浏览器模式权限验证异常: ${err}`)
          return false
        }
      }

      const result = await invokeWithResult<{ is_admin: boolean; user_id: string }>(TauriCommand.CHECK_ADMIN_STATUS, {
        userId,
        accessToken,
        homeserverUrl: client.getHomeserverUrl()
      })

      if (result.isErr()) {
        logger.error(`[Admin] 服务端权限验证异常: ${result.error}`)
        return false
      }

      this.cachedAdminStatus = result.value.is_admin
      this.adminVerifiedAt = now

      if (!result.value.is_admin) {
        logger.warn(`[Admin] 服务端权限验证失败: userId=${result.value.user_id}, isAdmin=false`)
      }

      return result.value.is_admin
    } catch (err) {
      logger.error(`[Admin] 服务端权限验证异常: ${err}`)
      return false
    }
  }

  private async sdkAdmin(): Promise<import('matrix-js-sdk/admin').AdminManager> {
    const hasPermission = await this.verifyServerSidePermission()
    if (!hasPermission) {
      logger.debug('[Admin] 非管理员用户跳过 SDK AdminManager 访问（正常业务流，非异常）')
      throw new Error('ADMIN_PERMISSION_DENIED')
    }
    const client = this.getClient() as MatrixClient & {
      getAdminManager?: () => import('matrix-js-sdk/admin').AdminManager
    }
    const manager = client.getAdminManager?.()
    if (!manager) {
      throw new Error(this.t('matrix_error.admin.sdk_manager_unavailable'))
    }
    return manager
  }

  // ==================== Server Management ====================

  async getServerStats(): Promise<ServerStats> {
    return this.server.getServerStats()
  }

  async getServerStatus(): Promise<ServerStatus | null> {
    return this.server.getServerStatus()
  }

  async getServerHealth(): Promise<ServerHealth | null> {
    return this.server.getServerHealth()
  }

  async getServerVersion(): Promise<ServerVersion | null> {
    return this.server.getServerVersion()
  }

  async getServerConfig(): Promise<AdminServerConfigInfo | null> {
    return this.server.getServerConfig()
  }

  async updateServerConfig(config: Record<string, unknown>): Promise<void> {
    return this.server.updateServerConfig(config)
  }
}

export const adminService = new AdminFacadeService()
