import { useI18nGlobal } from '@/services/i18n'
import { createLogger } from '@/utils/Logger'
import { matrixClientService } from '../MatrixClientService'
import type { WidgetMessageResponse, WidgetsManager } from '../sdk-compat'

const logger = createLogger('MatrixWidgetService')

export interface Widget {
  id: string
  type: string
  url: string
  name?: string
  data?: Record<string, unknown>
}

interface WidgetSessionOptions {
  deviceId?: string
  expiresInMs?: number
}

export interface WidgetConfigResponse extends Record<string, unknown> {}
export interface JitsiConfigResponse extends Record<string, unknown> {}
export interface WidgetPermissionsResponse extends Record<string, unknown> {}
export interface SetPermissionResponse extends Record<string, unknown> {}
export interface SessionApiData extends Record<string, unknown> {}
interface SdkWidget {
  widget_id: string
  room_id?: string | null
  type: string
  url: string
  name: string
  data?: Record<string, unknown>
}

export interface WidgetCapabilitiesResponse {
  capabilities: string[]
  widget_id: string
  room_id: string
}

export interface SendWidgetMessageRequest {
  type: string
  content: Record<string, unknown>
}

class MatrixWidgetService {
  private getManager(): WidgetsManager | null {
    const client = matrixClientService.getClient() as unknown as {
      getWidgetsManager?: () => WidgetsManager
    } | null
    if (!client) return null
    return client.getWidgetsManager?.() ?? null
  }

  private toFacade(widget: SdkWidget): Widget {
    return {
      id: widget.widget_id,
      type: widget.type,
      url: widget.url,
      name: widget.name,
      data: widget.data
    }
  }

  private getWidgetsFromRoomState(roomId: string): Widget[] {
    const client = matrixClientService.getClient()
    if (!client) return []

    const room = client.getRoom(roomId)
    if (!room) return []

    const widgets: Widget[] = []

    const widgetEvents = room.currentState.getStateEvents('im.vector.modular.widgets') || []
    const mWidgetEvents = room.currentState.getStateEvents('m.widget') || []

    for (const event of [...widgetEvents, ...mWidgetEvents]) {
      const content = event.getContent() as {
        type?: string
        url?: string
        name?: string
        data?: Record<string, unknown>
      }
      if (content?.type && content.url) {
        widgets.push({
          id: event.getStateKey() || '',
          type: content.type,
          url: content.url,
          name: content.name,
          data: content.data
        })
      }
    }

    return widgets
  }

  /**
   * 列出房间内的 widgets；SDK 失败时回退到房间 state。
   */
  async getWidgets(roomId: string, throwOnError = true): Promise<Widget[]> {
    const manager = this.getManager()
    if (manager) {
      try {
        const response = await manager.listRoomWidgets(roomId)
        return (response?.widgets ?? []).map((w) => this.toFacade(w))
      } catch (err) {
        logger.error(`[MatrixWidgetService] listRoomWidgets failed for ${roomId}: ${err}`)
        if (throwOnError) throw err
        return this.getWidgetsFromRoomState(roomId)
      }
    }
    if (throwOnError) {
      return this.getWidgetsFromRoomState(roomId)
    }
    return this.getWidgetsFromRoomState(roomId)
  }

  async getRoomWidgets(roomId: string, throwOnError = true): Promise<Widget[]> {
    return this.getWidgets(roomId, throwOnError)
  }

  async createWidget(
    roomId: string,
    body: { widgetType: string; url: string; name: string; data?: Record<string, unknown> },
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
        data: body.data
      })
      logger.info(`[MatrixWidgetService] Created widget ${response.widget.widget_id} in room ${roomId}`)
      return this.toFacade(response.widget)
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

  /**
   * 兼容旧 (roomId, widgetId) 签名；新 SDK 只需 widgetId。
   */
  async removeWidget(_roomId: string, widgetId: string, throwOnError = true): Promise<boolean> {
    return this.deleteWidget(widgetId, throwOnError)
  }

  async getWidgetById(widgetId: string, throwOnError = true): Promise<Widget | null> {
    const manager = this.getManager()
    if (!manager) {
      if (!throwOnError) return null
      throw new Error(useI18nGlobal().t('matrix_error.widget.manager_not_initialized'))
    }
    try {
      const response = await manager.getWidgetById(widgetId)
      return this.toFacade(response.widget)
    } catch (err) {
      logger.error(`[MatrixWidgetService] getWidgetById ${widgetId} failed: ${err}`)
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
        url: updates.url,
        name: updates.name,
        data: updates.data
      })
      return this.toFacade(response.widget)
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
      return (await manager.getWidgetConfig(widgetId)) as unknown as WidgetConfigResponse
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
      return (await manager.getJitsiConfig(roomId)) as unknown as JitsiConfigResponse
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
      return (await manager.getWidgetPermissions(widgetId)) as unknown as WidgetPermissionsResponse
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
      return (await manager.setWidgetPermission(widgetId, {
        user_id: userId,
        permissions
      })) as unknown as SetPermissionResponse
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
      await manager.deleteWidgetPermission(widgetId, userId)
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
      return (await manager.createWidgetSession(widgetId, {
        device_id: options?.deviceId,
        expires_in_ms: options?.expiresInMs
      })) as unknown as SessionApiData
    } catch (err) {
      logger.error(`[MatrixWidgetService] 创建Widget会话失败: ${widgetId} ${err}`)
      if (throwOnError) throw err
      return null
    }
  }

  async getWidgetSessions(widgetId: string, throwOnError = true): Promise<Record<string, unknown> | []> {
    const manager = this.getManager()
    if (!manager) {
      if (!throwOnError) return []
      throw new Error(useI18nGlobal().t('matrix_error.widget.manager_not_initialized'))
    }
    try {
      return (await manager.listWidgetSessions(widgetId)) as unknown as Record<string, unknown>
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
      return (await manager.getWidgetSession(sessionId)) as unknown as SessionApiData
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
      await manager.terminateWidgetSession(sessionId)
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
      return await manager.updateWidgetCapabilities(roomId, widgetId, { capabilities })
    } catch (err) {
      logger.error(`[MatrixWidgetService] 设置Widget能力失败: ${widgetId} ${err}`)
      if (throwOnError) throw err
      return null
    }
  }

  async sendWidgetMessage(
    roomId: string,
    widgetId: string,
    message: SendWidgetMessageRequest,
    throwOnError = true
  ): Promise<WidgetMessageResponse | null> {
    const manager = this.getManager()
    if (!manager) {
      if (!throwOnError) return null
      throw new Error(useI18nGlobal().t('matrix_error.widget.manager_not_initialized'))
    }
    try {
      return await manager.sendWidgetMessage(roomId, widgetId, message)
    } catch (err) {
      logger.error(`[MatrixWidgetService] 发送Widget消息失败: ${widgetId} ${err}`)
      if (throwOnError) throw err
      return null
    }
  }
}

export const matrixWidgetService = new MatrixWidgetService()
