import { unknownToObject } from '@/utils/typeGuard'
import { matrixClientService } from '../MatrixClientService'
import type { SdkWidget, Widget, WidgetDataObject } from './widgetTypes'

/** SDK widget → 前端 facade（单条用 `type`、列表用 `widget_type`，两者都可能缺失）。 */
export function toWidgetFacade(widget: SdkWidget): Widget {
  return {
    id: widget.widget_id,
    type: widget.type ?? widget.widget_type ?? 'unknown',
    url: widget.url,
    name: widget.name,
    data: unknownToObject<WidgetDataObject>(widget.data) ?? undefined
  }
}

/** 兜底：直接从房间 state 读取 widget（SDK widget manager 不可用或调用失败时）。 */
export function getWidgetsFromRoomState(roomId: string): Widget[] {
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
      data?: WidgetDataObject
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
