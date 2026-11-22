import { useI18nGlobal } from '@/services/i18n'
import { createLogger } from '@/utils/Logger'
import { unknownToObject } from '@/utils/typeGuard'
import { matrixClientService } from '../MatrixClientService'
import type { WidgetManager } from '../sdk-compat'
import { getWidgetsFromRoomState, toWidgetFacade } from './widgetRoomState'
import type {
  JitsiConfigResponse,
  SessionApiData,
  SetPermissionResponse,
  Widget,
  WidgetCapabilitiesResponse,
  WidgetConfigResponse,
  WidgetDataObject,
  WidgetPermissionsResponse,
  WidgetSessionOptions,
  WidgetSessionsOutcome
} from './widgetTypes'

export type * from './widgetTypes'

const logger = createLogger('MatrixWidgetService')

class MatrixWidgetService {
  private getManager(): WidgetManager | null {
    const client = matrixClientService.getClient() as {
      getWidgetManager?: () => WidgetManager
    } | null
    if (!client) return null
    return client.getWidgetManager?.() ?? null
  }

  /**
   * 列出房间内的 widgets；SDK 失败时回退到房间 state。
   */
  async getWidgets(roomId: string, throwOnError = true): Promise<Widget[]> {
    const manager = this.getManager()
    if (manager) {
      try {
        const response = await manager.getRoomWidgets(roomId)
        return (response?.widgets ?? []).map((w) => toWidgetFacade(w))
      } catch (err) {
        logger.error(`[MatrixWidgetService] getRoomWidgets failed for ${roomId}: ${err}`)
        if (throwOnError) throw err
        return getWidgetsFromRoomState(roomId)
      }
    }
    if (throwOnError) {
      return getWidgetsFromRoomState(roomId)
    }
    return getWidgetsFromRoomState(roomId)
  }

  async getRoomWidgets(roomId: string, throwOnError = true): Promise<Widget[]> {
    return this.getWidgets(roomId, throwOnError)
  }

  async createWidget(
    roomId: string,
    body: { widgetType: string; url: string; name: string; data?: WidgetDataObject | undefined },
    throwOnError = true
  ): Promise<Widget | null> {
    const manager = this.getManager()
    if (!manager) {
      if (!throwOnError) return null
      throw new Error(useI18nGlobal().t('matrix_error.widget.manager_not_initialized'))
    }
    try {
      const response = await manager.createWidget({
        room_id: roomId,
        widget_type: body.widgetType,
        url: body.url,
        name: body.name,
        ...(body.data !== undefined ? { data: body.data } : {})
      })
      // 后端返回**扁平** WidgetApiResponse（`widget_id` 在顶层）。旧代码读 `response.widget`
      // ⇒ 运行时 `undefined`（SDK 侧同步修正，见 backend-delta-sdk-audit §14）。
      logger.info(`[MatrixWidgetService] Created widget ${response.widget_id} in room ${roomId}`)
      return toWidgetFacade(response)
    } catch (err) {
      logger.error(`[MatrixWidgetService] Failed to create widget: ${err}`)
      if (throwOnError) throw err
      return null
    }
  }

  /**
   * 兼容旧接口签名：(roomId, widgetId, {type,url,name,data}) → 映射到新的 createWidget。
   * widgetId 当前由后端自行生成，此处仅用作缺省 name。
   */
  async addWidget(roomId: string, widgetId: string, widget: Omit<Widget, 'id'>, throwOnError = true): Promise<boolean> {
    const result = await this.createWidget(
      roomId,
      {
        widgetType: widget.type,
        url: widget.url,
        name: widget.name ?? widgetId,
        data: widget.data
      },
      throwOnError
    )
    return result !== null
  }

  async deleteWidget(widgetId: string, throwOnError = true): Promise<boolean> {
    const manager = this.getManager()
    if (!manager) {
      if (!throwOnError) return false
      throw new Error(useI18nGlobal().t('matrix_error.widget.manager_not_initialized'))
    }
    try {
      await manager.deleteWidget(widgetId)
      logger.info(`[MatrixWidgetService] Deleted widget ${widgetId}`)
      return true
    } catch (err) {
      logger.error(`[MatrixWidgetService] Failed to delete widget ${widgetId}: ${err}`)
      if (throwOnError) throw err
      return false
    }
  }

  /** `deleteWidget` 的别名，保留给既有调用方。 */
  async removeWidget(widgetId: string, throwOnError = true): Promise<boolean> {
    return this.deleteWidget(widgetId, throwOnError)
  }

  async getWidgetById(widgetId: string, throwOnError = true): Promise<Widget | null> {
    const manager = this.getManager()
    if (!manager) {
      if (!throwOnError) return null
      throw new Error(useI18nGlobal().t('matrix_error.widget.manager_not_initialized'))
    }
    try {
      const response = await manager.getWidget(widgetId)
      return toWidgetFacade(response)
    } catch (err) {
      logger.error(`[MatrixWidgetService] getWidget ${widgetId} failed: ${err}`)
      if (throwOnError) throw err
      return null
    }
  }

  async updateWidget(widgetId: string, updates: Partial<Widget>, throwOnError = true): Promise<Widget | null> {
    const manager = this.getManager()
    if (!manager) {
      if (!throwOnError) return null
      throw new Error(useI18nGlobal().t('matrix_error.widget.manager_not_initialized'))
    }
    try {
      const response = await manager.updateWidget(widgetId, {
        ...(updates.url !== undefined ? { url: updates.url } : {}),
        ...(updates.name !== undefined ? { name: updates.name } : {}),
        ...(updates.data !== undefined ? { data: updates.data } : {})
      })
      return toWidgetFacade(response)
    } catch (err) {
      logger.error(`[MatrixWidgetService] Failed to update widget ${widgetId}: ${err}`)
      if (throwOnError) throw err
      return null
    }
  }

  async getWidgetConfig(widgetId: string, throwOnError = true): Promise<WidgetConfigResponse | null> {
    const manager = this.getManager()
    if (!manager) {
      if (!throwOnError) return null
      throw new Error(useI18nGlobal().t('matrix_error.widget.manager_not_initialized'))
    }
    try {
      return unknownToObject<WidgetConfigResponse>(await manager.getWidgetConfig(widgetId))
    } catch (err) {
      logger.error(`[MatrixWidgetService] 获取Widget配置失败: ${widgetId} ${err}`)
      if (throwOnError) throw err
      return null
    }
  }

  async getJitsiConfig(roomId: string, throwOnError = true): Promise<JitsiConfigResponse | null> {
    const manager = this.getManager()
    if (!manager) {
      if (!throwOnError) return null
      throw new Error(useI18nGlobal().t('matrix_error.widget.manager_not_initialized'))
    }
    try {
      return unknownToObject<JitsiConfigResponse>(await manager.getJitsiConfig(roomId))
    } catch (err) {
      logger.error(`[MatrixWidgetService] 获取Jitsi配置失败: ${roomId} ${err}`)
      if (throwOnError) throw err
      return null
    }
  }

  async getWidgetPermissions(widgetId: string, throwOnError = true): Promise<WidgetPermissionsResponse | null> {
    const manager = this.getManager()
    if (!manager) {
      if (!throwOnError) return null
      throw new Error(useI18nGlobal().t('matrix_error.widget.manager_not_initialized'))
    }
    try {
      return unknownToObject<WidgetPermissionsResponse>(await manager.getWidgetPermissions(widgetId))
    } catch (err) {
      logger.error(`[MatrixWidgetService] 获取Widget权限失败: ${widgetId} ${err}`)
      if (throwOnError) throw err
      return null
    }
  }

  async setWidgetPermission(
    widgetId: string,
    userId: string,
    permissions: string[],
    throwOnError = true
  ): Promise<SetPermissionResponse | null> {
    const manager = this.getManager()
    if (!manager) {
      if (!throwOnError) return null
      throw new Error(useI18nGlobal().t('matrix_error.widget.manager_not_initialized'))
    }
    try {
      return (await manager.setWidgetPermissions(widgetId, {
        user_id: userId,
        permissions
      })) as SetPermissionResponse
    } catch (err) {
      logger.error(`[MatrixWidgetService] 设置Widget权限失败: ${widgetId} ${err}`)
      if (throwOnError) throw err
      return null
    }
  }

  async deleteWidgetPermission(widgetId: string, userId: string, throwOnError = true): Promise<boolean> {
    const manager = this.getManager()
    if (!manager) {
      if (!throwOnError) return false
      throw new Error(useI18nGlobal().t('matrix_error.widget.manager_not_initialized'))
    }
    try {
      await manager.removeWidgetPermission(widgetId, userId)
      return true
    } catch (err) {
      logger.error(`[MatrixWidgetService] 删除Widget权限失败: ${widgetId} ${err}`)
      if (throwOnError) throw err
      return false
    }
  }

  async createWidgetSession(
    widgetId: string,
    options?: WidgetSessionOptions,
    throwOnError = true
  ): Promise<SessionApiData | null> {
    const manager = this.getManager()
    if (!manager) {
      if (!throwOnError) return null
      throw new Error(useI18nGlobal().t('matrix_error.widget.manager_not_initialized'))
    }
    try {
      return unknownToObject<SessionApiData>(
        await manager.createWidgetSession(widgetId, {
          ...(options?.deviceId !== undefined ? { device_id: options.deviceId } : {}),
          ...(options?.expiresInMs !== undefined ? { expires_in_ms: options.expiresInMs } : {})
        })
      )
    } catch (err) {
      logger.error(`[MatrixWidgetService] 创建Widget会话失败: ${widgetId} ${err}`)
      if (throwOnError) throw err
      return null
    }
  }

  async getWidgetSessions(widgetId: string, throwOnError = true): Promise<WidgetSessionsOutcome | []> {
    const manager = this.getManager()
    if (!manager) {
      if (!throwOnError) return []
      throw new Error(useI18nGlobal().t('matrix_error.widget.manager_not_initialized'))
    }
    try {
      return unknownToObject<WidgetSessionsOutcome>(await manager.getWidgetSessions(widgetId)) ?? {}
    } catch (err) {
      logger.error(`[MatrixWidgetService] 获取Widget会话列表失败: ${widgetId} ${err}`)
      if (throwOnError) throw err
      return []
    }
  }

  async getWidgetSession(sessionId: string, throwOnError = true): Promise<SessionApiData | null> {
    const manager = this.getManager()
    if (!manager) {
      if (!throwOnError) return null
      throw new Error(useI18nGlobal().t('matrix_error.widget.manager_not_initialized'))
    }
    try {
      return unknownToObject<SessionApiData>(await manager.getWidgetSession(sessionId))
    } catch (err) {
      logger.error(`[MatrixWidgetService] 获取Widget会话失败: ${sessionId} ${err}`)
      if (throwOnError) throw err
      return null
    }
  }

  async terminateWidgetSession(sessionId: string, throwOnError = true): Promise<boolean> {
    const manager = this.getManager()
    if (!manager) {
      if (!throwOnError) return false
      throw new Error(useI18nGlobal().t('matrix_error.widget.manager_not_initialized'))
    }
    try {
      await manager.deleteWidgetSession(sessionId)
      return true
    } catch (err) {
      logger.error(`[MatrixWidgetService] 终止Widget会话失败: ${sessionId} ${err}`)
      if (throwOnError) throw err
      return false
    }
  }

  // ============================================
  // v3 Widget Capabilities & Messaging (契约 widget.md)
  // ============================================

  async getWidgetCapabilities(
    roomId: string,
    widgetId: string,
    throwOnError = true
  ): Promise<WidgetCapabilitiesResponse | null> {
    const manager = this.getManager()
    if (!manager) {
      if (!throwOnError) return null
      throw new Error(useI18nGlobal().t('matrix_error.widget.manager_not_initialized'))
    }
    try {
      return await manager.getWidgetCapabilities(roomId, widgetId)
    } catch (err) {
      logger.error(`[MatrixWidgetService] 获取Widget能力失败: ${widgetId} ${err}`)
      if (throwOnError) throw err
      return null
    }
  }

  async setWidgetCapabilities(
    roomId: string,
    widgetId: string,
    capabilities: string[],
    throwOnError = true
  ): Promise<WidgetCapabilitiesResponse | null> {
    const manager = this.getManager()
    if (!manager) {
      if (!throwOnError) return null
      throw new Error(useI18nGlobal().t('matrix_error.widget.manager_not_initialized'))
    }
    try {
      return await manager.setWidgetCapabilities(roomId, widgetId, capabilities)
    } catch (err) {
      logger.error(`[MatrixWidgetService] 设置Widget能力失败: ${widgetId} ${err}`)
      if (throwOnError) throw err
      return null
    }
  }
}

export const matrixWidgetService = new MatrixWidgetService()
