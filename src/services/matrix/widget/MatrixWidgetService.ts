import { error, info } from '@tauri-apps/plugin-log'
import { matrixClientService } from '../MatrixClientService'

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

interface SdkWidgetResponse {
  widget: SdkWidget
}

interface WidgetsManagerLike {
  createWidget(body: {
    room_id?: string
    widget_type: string
    url: string
    name: string
    data?: Record<string, unknown>
  }): Promise<SdkWidgetResponse>
  getWidgetById(widgetId: string): Promise<SdkWidgetResponse>
  updateWidget(
    widgetId: string,
    body: { url?: string; name?: string; data?: Record<string, unknown> }
  ): Promise<SdkWidgetResponse>
  deleteWidget(widgetId: string): Promise<void>
  listRoomWidgets(roomId: string): Promise<{ widgets: SdkWidget[] }>
  getJitsiConfig(roomId: string): Promise<JitsiConfigResponse>
  getWidgetConfig(widgetId: string): Promise<WidgetConfigResponse>
  getWidgetPermissions(widgetId: string): Promise<WidgetPermissionsResponse>
  setWidgetPermission(
    widgetId: string,
    body: { user_id: string; permissions: string[] }
  ): Promise<SetPermissionResponse>
  deleteWidgetPermission(widgetId: string, userId: string): Promise<void>
  createWidgetSession(
    widgetId: string,
    body?: { widget_id?: string; device_id?: string; expires_in_ms?: number }
  ): Promise<SessionApiData>
  listWidgetSessions(widgetId: string): Promise<Record<string, unknown>>
  getWidgetSession(sessionId: string): Promise<SessionApiData>
  terminateWidgetSession(sessionId: string): Promise<void>
}

class MatrixWidgetService {
  private getManager(): WidgetsManagerLike | null {
    const client = matrixClientService.getClient() as unknown as {
      getWidgetsManager?: () => WidgetsManagerLike
      widgetsManager?: WidgetsManagerLike
    } | null
    if (!client) return null
    if (typeof client.getWidgetsManager === 'function') {
      return client.getWidgetsManager()
    }
    return client.widgetsManager ?? null
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
        error(`[MatrixWidgetService] listRoomWidgets failed for ${roomId}: ${err}`)
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
      throw new Error('WidgetsManager 未初始化')
    }
    try {
      const response = await manager.createWidget({
        room_id: roomId,
        widget_type: body.widgetType,
        url: body.url,
        name: body.name,
        data: body.data
      })
      info(`[MatrixWidgetService] Created widget ${response.widget.widget_id} in room ${roomId}`)
      return this.toFacade(response.widget)
    } catch (err) {
      error(`[MatrixWidgetService] Failed to create widget: ${err}`)
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
      throw new Error('WidgetsManager 未初始化')
    }
    try {
      await manager.deleteWidget(widgetId)
      info(`[MatrixWidgetService] Deleted widget ${widgetId}`)
      return true
    } catch (err) {
      error(`[MatrixWidgetService] Failed to delete widget ${widgetId}: ${err}`)
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
      throw new Error('WidgetsManager 未初始化')
    }
    try {
      const response = await manager.getWidgetById(widgetId)
      return this.toFacade(response.widget)
    } catch (err) {
      error(`[MatrixWidgetService] getWidgetById ${widgetId} failed: ${err}`)
      if (throwOnError) throw err
      return null
    }
  }

  async updateWidget(widgetId: string, updates: Partial<Widget>, throwOnError = true): Promise<Widget | null> {
    const manager = this.getManager()
    if (!manager) {
      if (!throwOnError) return null
      throw new Error('WidgetsManager 未初始化')
    }
    try {
      const response = await manager.updateWidget(widgetId, {
        url: updates.url,
        name: updates.name,
        data: updates.data
      })
      return this.toFacade(response.widget)
    } catch (err) {
      error(`[MatrixWidgetService] Failed to update widget ${widgetId}: ${err}`)
      if (throwOnError) throw err
      return null
    }
  }

  async getWidgetConfig(widgetId: string, throwOnError = true): Promise<WidgetConfigResponse | null> {
    const manager = this.getManager()
    if (!manager) {
      if (!throwOnError) return null
      throw new Error('WidgetsManager 未初始化')
    }
    try {
      return await manager.getWidgetConfig(widgetId)
    } catch (err) {
      error(`[MatrixWidgetService] 获取Widget配置失败: ${widgetId} ${err}`)
      if (throwOnError) throw err
      return null
    }
  }

  async getJitsiConfig(roomId: string, throwOnError = true): Promise<JitsiConfigResponse | null> {
    const manager = this.getManager()
    if (!manager) {
      if (!throwOnError) return null
      throw new Error('WidgetsManager 未初始化')
    }
    try {
      return await manager.getJitsiConfig(roomId)
    } catch (err) {
      error(`[MatrixWidgetService] 获取Jitsi配置失败: ${roomId} ${err}`)
      if (throwOnError) throw err
      return null
    }
  }

  async getWidgetPermissions(widgetId: string, throwOnError = true): Promise<WidgetPermissionsResponse | null> {
    const manager = this.getManager()
    if (!manager) {
      if (!throwOnError) return null
      throw new Error('WidgetsManager 未初始化')
    }
    try {
      return await manager.getWidgetPermissions(widgetId)
    } catch (err) {
      error(`[MatrixWidgetService] 获取Widget权限失败: ${widgetId} ${err}`)
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
      throw new Error('WidgetsManager 未初始化')
    }
    try {
      return await manager.setWidgetPermission(widgetId, { user_id: userId, permissions })
    } catch (err) {
      error(`[MatrixWidgetService] 设置Widget权限失败: ${widgetId} ${err}`)
      if (throwOnError) throw err
      return null
    }
  }

  async deleteWidgetPermission(widgetId: string, userId: string, throwOnError = true): Promise<boolean> {
    const manager = this.getManager()
    if (!manager) {
      if (!throwOnError) return false
      throw new Error('WidgetsManager 未初始化')
    }
    try {
      await manager.deleteWidgetPermission(widgetId, userId)
      return true
    } catch (err) {
      error(`[MatrixWidgetService] 删除Widget权限失败: ${widgetId} ${err}`)
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
      throw new Error('WidgetsManager 未初始化')
    }
    try {
      return await manager.createWidgetSession(widgetId, {
        device_id: options?.deviceId,
        expires_in_ms: options?.expiresInMs
      })
    } catch (err) {
      error(`[MatrixWidgetService] 创建Widget会话失败: ${widgetId} ${err}`)
      if (throwOnError) throw err
      return null
    }
  }

  async getWidgetSessions(widgetId: string, throwOnError = true): Promise<Record<string, unknown> | []> {
    const manager = this.getManager()
    if (!manager) {
      if (!throwOnError) return []
      throw new Error('WidgetsManager 未初始化')
    }
    try {
      return await manager.listWidgetSessions(widgetId)
    } catch (err) {
      error(`[MatrixWidgetService] 获取Widget会话列表失败: ${widgetId} ${err}`)
      if (throwOnError) throw err
      return []
    }
  }

  async getWidgetSession(sessionId: string, throwOnError = true): Promise<SessionApiData | null> {
    const manager = this.getManager()
    if (!manager) {
      if (!throwOnError) return null
      throw new Error('WidgetsManager 未初始化')
    }
    try {
      return await manager.getWidgetSession(sessionId)
    } catch (err) {
      error(`[MatrixWidgetService] 获取Widget会话失败: ${sessionId} ${err}`)
      if (throwOnError) throw err
      return null
    }
  }

  async terminateWidgetSession(sessionId: string, throwOnError = true): Promise<boolean> {
    const manager = this.getManager()
    if (!manager) {
      if (!throwOnError) return false
      throw new Error('WidgetsManager 未初始化')
    }
    try {
      await manager.terminateWidgetSession(sessionId)
      return true
    } catch (err) {
      error(`[MatrixWidgetService] 终止Widget会话失败: ${sessionId} ${err}`)
      if (throwOnError) throw err
      return false
    }
  }
}

export const matrixWidgetService = new MatrixWidgetService()
