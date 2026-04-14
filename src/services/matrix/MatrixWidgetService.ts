/* eslint-disable @typescript-eslint/no-explicit-any */
import { matrixClientService } from './MatrixClientService'
import { BaseManager } from './BaseManager'

export interface Widget {
  id: string
  type: string
  url: string
  name: string
  data?: Record<string, unknown>
  creatorUserId?: string
  roomId?: string
}

export interface WidgetSession {
  session_id: string
  widget_id: string
  user_id: string
  device_id: string | null
  expires_at: number
  created_ts?: number
  last_active_ts?: number
  is_active?: boolean
}

export interface JitsiConfig {
  conf_id: string
  name: string
  domain: string
  app_id: string | null
  jwt: string | null
}

class MatrixWidgetService extends BaseManager {
  private widgetManager: any = null
  private initialized = false

  initialize(): void {
    if (this.initialized) return

    const client = matrixClientService.getClient()
    if (!client) {
      return
    }

    try {
      this.widgetManager = (client as any).getWidgetManager?.() ?? null
      if (this.widgetManager) {
        this.initialized = true
      } else {
        this.initialized = true
      }
    } catch (_err) {
      // error logged by handleError
    }
  }

  private get client() {
    const client = matrixClientService.getClient()
    if (!client) throw new Error('Matrix client not initialized')
    return client
  }

  async getWidgets(roomId: string, throwOnError = true): Promise<Widget[]> {
    if (this.widgetManager) {
      try {
        const widgets = await this.widgetManager.getRoomWidgets(roomId)
        return (widgets ?? []).map((w: any) => ({
          id: w.id,
          type: w.type,
          url: w.url,
          name: w.name,
          data: w.data,
          creatorUserId: w.creatorUserId,
          roomId: w.roomId ?? roomId
        }))
      } catch (error) {
        return this.handleError(error, 'getWidgets', [] as Widget[], throwOnError)
      }
    }

    return this.getWidgetsFallback(roomId)
  }

  private getWidgetsFallback(roomId: string): Widget[] {
    const room = this.client.getRoom(roomId)
    if (!room) return []

    const widgets: Widget[] = []
    const widgetEvents = room.currentState.getStateEvents('im.vector.modular.widgets') || []
    const mWidgetEvents = room.currentState.getStateEvents('m.widget') || []

    const allEvents = [...widgetEvents, ...mWidgetEvents]

    for (const event of allEvents) {
      const content = event.getContent() as {
        type?: string
        url?: string
        name?: string
        data?: Record<string, unknown>
      }
      if (content && content.type && content.url) {
        widgets.push({
          id: event.getStateKey() || '',
          type: content.type,
          url: content.url,
          name: content.name || '',
          data: content.data,
          roomId
        })
      }
    }

    return widgets
  }

  async getWidget(widgetId: string, throwOnError = true): Promise<Widget | null> {
    if (this.widgetManager) {
      try {
        const widget = await this.widgetManager.getWidget(widgetId)
        if (!widget) return null
        return {
          id: widget.id,
          type: widget.type,
          url: widget.url,
          name: widget.name,
          data: widget.data,
          creatorUserId: widget.creatorUserId,
          roomId: widget.roomId
        }
      } catch (error) {
        return this.handleError(error, 'getWidget', null, throwOnError)
      }
    }

    return null
  }

  async addWidget(roomId: string, widget: Omit<Widget, 'id' | 'roomId'>, throwOnError = false): Promise<Widget | null> {
    if (this.widgetManager) {
      try {
        const newWidget = await this.widgetManager.addWidget(roomId, {
          type: widget.type,
          url: widget.url,
          name: widget.name,
          data: widget.data
        })
        return {
          id: newWidget.id,
          type: newWidget.type,
          url: newWidget.url,
          name: newWidget.name,
          data: newWidget.data,
          creatorUserId: newWidget.creatorUserId,
          roomId: newWidget.roomId
        }
      } catch (error) {
        return this.handleError(error, 'addWidget', null, throwOnError)
      }
    }

    try {
      const widgetId = `widget_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`
      await this.client.sendStateEvent(
        roomId,
        'im.vector.modular.widgets',
        {
          type: widget.type,
          url: widget.url,
          name: widget.name,
          data: widget.data
        },
        widgetId
      )
      return {
        id: widgetId,
        type: widget.type,
        url: widget.url,
        name: widget.name,
        data: widget.data,
        roomId
      }
    } catch (error) {
      return this.handleError(error, 'addWidget', null, throwOnError)
    }
  }

  async removeWidget(roomId: string, widgetId: string, throwOnError = false): Promise<boolean> {
    if (this.widgetManager) {
      try {
        await this.widgetManager.removeWidget(roomId, widgetId)
        return true
      } catch (error) {
        return this.handleError(error, 'removeWidget', false, throwOnError)
      }
    }

    try {
      await this.client.sendStateEvent(roomId, 'im.vector.modular.widgets', {}, widgetId)
      return true
    } catch (error) {
      return this.handleError(error, 'removeWidget', false, throwOnError)
    }
  }

  async updateWidget(roomId: string, widgetId: string, updates: Partial<Widget>, throwOnError = false): Promise<Widget | null> {
    if (this.widgetManager) {
      try {
        const updated = await this.widgetManager.updateWidget(roomId, widgetId, updates)
        return {
          id: updated.id,
          type: updated.type,
          url: updated.url,
          name: updated.name,
          data: updated.data,
          creatorUserId: updated.creatorUserId,
          roomId: updated.roomId
        }
      } catch (error) {
        return this.handleError(error, 'updateWidget', null, throwOnError)
      }
    }

    return null
  }

  async getWidgetConfig(widgetId: string): Promise<any> {
    if (this.widgetManager) {
      try {
        return await this.widgetManager.getWidgetConfig(widgetId)
      } catch (_err) {
        // error logged by handleError
        return null
      }
    }
    return null
  }

  async getJitsiConfig(roomId: string): Promise<JitsiConfig | null> {
    if (this.widgetManager) {
      try {
        return await this.widgetManager.getJitsiConfig(roomId)
      } catch (_err) {
        // error logged by handleError
        return null
      }
    }
    return null
  }

  async checkWidgetPermission(roomId: string, widgetId: string, permissions: string[]): Promise<boolean> {
    if (this.widgetManager) {
      try {
        return await this.widgetManager.checkWidgetPermission(roomId, widgetId, permissions)
      } catch (_err) {
        // error logged by handleError
        return false
      }
    }
    return false
  }

  async grantWidgetPermission(roomId: string, widgetId: string, permissions: string[]): Promise<boolean> {
    if (this.widgetManager) {
      try {
        await this.widgetManager.grantWidgetPermission(roomId, widgetId, permissions)
        return true
      } catch (_err) {
        // error logged by handleError
        return false
      }
    }
    return false
  }

  async denyWidgetPermission(roomId: string, widgetId: string, permissions: string[]): Promise<boolean> {
    if (this.widgetManager) {
      try {
        await this.widgetManager.denyWidgetPermission(roomId, widgetId, permissions)
        return true
      } catch (_err) {
        // error logged by handleError
        return false
      }
    }
    return false
  }

  async getWidgetPermissions(widgetId: string): Promise<any> {
    if (this.widgetManager) {
      try {
        return await this.widgetManager.getWidgetPermissions(widgetId)
      } catch (_err) {
        // error logged by handleError
        return null
      }
    }
    return null
  }

  async setWidgetPermission(widgetId: string, userId: string, permissions: string[]): Promise<boolean> {
    if (this.widgetManager) {
      try {
        const result = await this.widgetManager.setWidgetPermission(widgetId, userId, permissions)
        return result?.success ?? false
      } catch (_err) {
        // error logged by handleError
        return false
      }
    }
    return false
  }

  async createWidgetSession(
    widgetId: string,
    options?: { deviceId?: string; expiresInMs?: number }
  ): Promise<WidgetSession | null> {
    if (this.widgetManager) {
      try {
        const session = await this.widgetManager.createWidgetSession(widgetId, options)
        if (!session) return null
        return {
          session_id: session.session_id,
          widget_id: session.widget_id,
          user_id: session.user_id,
          device_id: session.device_id,
          expires_at: session.expires_at,
          created_ts: session.created_ts,
          last_active_ts: session.last_active_ts,
          is_active: session.is_active
        }
      } catch (_err) {
        // error logged by handleError
        return null
      }
    }
    return null
  }

  async getWidgetSessions(widgetId: string): Promise<WidgetSession[]> {
    if (this.widgetManager) {
      try {
        const sessions = await this.widgetManager.getWidgetSessions(widgetId)
        return (sessions ?? []).map((s: any) => ({
          session_id: s.session_id,
          widget_id: s.widget_id,
          user_id: s.user_id,
          device_id: s.device_id,
          expires_at: s.expires_at,
          created_ts: s.created_ts,
          last_active_ts: s.last_active_ts,
          is_active: s.is_active
        }))
      } catch (_err) {
        // error logged by handleError
        return []
      }
    }
    return []
  }

  async terminateWidgetSession(sessionId: string): Promise<boolean> {
    if (this.widgetManager) {
      try {
        return await this.widgetManager.terminateWidgetSession(sessionId)
      } catch (_err) {
        // error logged by handleError
        return false
      }
    }
    return false
  }

  getCachedWidgets(roomId: string): Widget[] {
    if (this.widgetManager) {
      try {
        const widgets = this.widgetManager.getCachedWidgets(roomId)
        return (widgets ?? []).map((w: any) => ({
          id: w.id,
          type: w.type,
          url: w.url,
          name: w.name,
          data: w.data,
          creatorUserId: w.creatorUserId,
          roomId: w.roomId ?? roomId
        }))
      } catch {
        return []
      }
    }
    return []
  }

  clearRoomWidgets(roomId: string): void {
    if (this.widgetManager) {
      try {
        this.widgetManager.clearRoomWidgets(roomId)
      } catch (_err) {
        // error logged by handleError
      }
    }
  }

  async getWidgetCapabilities(
    roomId: string,
    widgetId: string,
    throwOnError = true
  ): Promise<Record<string, unknown> | null> {
    if (!this.widgetManager) return null
    try {
      return await this.widgetManager.getWidgetCapabilities(roomId, widgetId)
    } catch (error) {
      return this.handleError(error, 'getWidgetCapabilities', null, throwOnError)
    }
  }

  async setWidgetCapabilities(
    roomId: string,
    widgetId: string,
    capabilities: string[],
    throwOnError = false
  ): Promise<Record<string, unknown> | null> {
    if (!this.widgetManager) return null
    try {
      return await this.widgetManager.setWidgetCapabilities(roomId, widgetId, capabilities)
    } catch (error) {
      return this.handleError(error, 'setWidgetCapabilities', null, throwOnError)
    }
  }

  async sendWidgetMessage(
    roomId: string,
    widgetId: string,
    message: Record<string, unknown>,
    throwOnError = false
  ): Promise<Record<string, unknown> | null> {
    if (!this.widgetManager) return null
    try {
      return await this.widgetManager.sendWidgetMessage(roomId, widgetId, message)
    } catch (error) {
      return this.handleError(error, 'sendWidgetMessage', null, throwOnError)
    }
  }

  async navigateWidget(roomId: string, widgetId: string, url: string, throwOnError = false): Promise<boolean> {
    if (!this.widgetManager) return false
    try {
      await this.widgetManager.navigateWidget(roomId, widgetId, url)
      return true
    } catch (error) {
      return this.handleError(error, 'navigateWidget', false, throwOnError)
    }
  }
}

export const matrixWidgetService = new MatrixWidgetService()
export default matrixWidgetService
