import { info, error } from '@tauri-apps/plugin-log'
import { matrixClientService } from './MatrixClientService'

export interface Widget {
  id: string
  type: string
  url: string
  name?: string
  data?: Record<string, unknown>
}

/**
 * Matrix Widget Service
 * 管理房间内的小组件 (Widgets)，如嵌套的网页应用、投票插件等
 */
class MatrixWidgetService {
  /**
   * 获取房间内的所有 Widgets
   * @param roomId 房间 ID
   */
  getWidgets(roomId: string): Widget[] {
    const client = matrixClientService.getClient()
    if (!client) return []

    const room = client.getRoom(roomId)
    if (!room) return []

    const widgets: Widget[] = []

    // Matrix standard widget event type is 'im.vector.modular.widgets' or 'm.widget'
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
      // If type is not defined, it means the widget was deleted
      if (content && content.type && content.url) {
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
   * 向房间添加一个 Widget
   */
  async addWidget(roomId: string, widgetId: string, widget: Omit<Widget, 'id'>): Promise<boolean> {
    const client = matrixClientService.getClient()
    if (!client) return false

    try {
      await client.sendStateEvent(
        roomId,
        'im.vector.modular.widgets' as any,
        {
          type: widget.type,
          url: widget.url,
          name: widget.name,
          data: widget.data
        },
        widgetId
      )

      info(`[MatrixWidgetService] Added widget ${widgetId} to room ${roomId}`)
      return true
    } catch (err) {
      error(`[MatrixWidgetService] Failed to add widget: ${err}`)
      return false
    }
  }

  /**
   * 从房间移除 Widget
   */
  async removeWidget(roomId: string, widgetId: string): Promise<boolean> {
    const client = matrixClientService.getClient()
    if (!client) return false

    try {
      // Sending empty content deletes the state event
      await client.sendStateEvent(roomId, 'im.vector.modular.widgets' as any, {}, widgetId)
      info(`[MatrixWidgetService] Removed widget ${widgetId} from room ${roomId}`)
      return true
    } catch (err) {
      error(`[MatrixWidgetService] Failed to remove widget: ${err}`)
      return false
    }
  }
}

export const matrixWidgetService = new MatrixWidgetService()
