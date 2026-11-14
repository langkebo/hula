import { computed, type MaybeRefOrGetter, ref, toValue } from 'vue'
import { useMitt } from '@/composables/common/useMitt'
import { MittEnum } from '@/enums'
import { matrixCapabilityService } from '@/services/matrix/MatrixCapabilityService'
import { matrixRoomActionFacade } from '@/services/matrix/room/RoomFacade'
import type { StickyEventInfo, StickyEventRecord } from '@/types/stickyEvent'
import { createLogger } from '@/utils/Logger'
import { resolveMessageInfo } from './resolveMessageInfo'

const logger = createLogger('useStickyEvents')

/** 默认粘性事件类型：普通消息 */
export const DEFAULT_STICKY_EVENT_TYPE = 'm.room.message'

interface UseStickyEventsOptions {
  /** 房间 ID，支持 ref / getter / 字符串 */
  roomId: MaybeRefOrGetter<string | null | undefined>
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

/**
 * 解析 MSC4354 `GET /sticky_events` 响应。
 * 服务端返回 `{ events: [{ event_id, event_type, user_id, sticky_duration_ms, sticky_expiry_ts }] }`，
 * `sticky_expiry_ts` 为毫秒；已过期条目在此过滤。
 */
export function parseStickyEventRecords(data: unknown, now: number = Date.now()): StickyEventRecord[] {
  if (!isRecord(data) || !Array.isArray(data.events)) return []
  return data.events
    .filter(isRecord)
    .map((item) => ({
      eventId: typeof item.event_id === 'string' ? item.event_id : '',
      eventType: typeof item.event_type === 'string' ? item.event_type : DEFAULT_STICKY_EVENT_TYPE,
      userId: typeof item.user_id === 'string' ? item.user_id : '',
      durationMs: typeof item.sticky_duration_ms === 'number' ? item.sticky_duration_ms : null,
      expiresAt: typeof item.sticky_expiry_ts === 'number' ? item.sticky_expiry_ts : 0
    }))
    .filter((record) => record.eventId !== '' && (record.expiresAt === 0 || record.expiresAt > now))
}

/**
 * 粘性事件（MSC4354）composable。
 *
 * - 数据源为服务端 sticky events，不再借用置顶消息
 * - 写入为「整表」语义：把当前表与新条目合并后一次性提交
 * - 能力门控：`sticky-events` 未声明时 `canSetSticky` 为 false，调用方不渲染入口
 */
export function useStickyEvents(options: UseStickyEventsOptions) {
  const events = ref<StickyEventInfo[]>([])
  const loading = ref(false)
  const hasLoaded = ref(false)

  const resolveRoomId = (): string | null => {
    const id = toValue(options.roomId)
    return id ? String(id) : null
  }

  /** 服务端是否声明支持 MSC4354 粘性事件 */
  const canSetSticky = computed<boolean>(() => matrixCapabilityService.hasCapability('sticky-events'))

  /** 拉取并解析当前房间的粘性事件 */
  const load = async (): Promise<void> => {
    const roomId = resolveRoomId()
    if (!roomId) {
      events.value = []
      return
    }

    loading.value = true
    try {
      const data = await matrixRoomActionFacade.getStickyEvents(roomId)
      const records = parseStickyEventRecords(data)
      const resolved = await Promise.all(
        records.map(async (record): Promise<StickyEventInfo | null> => {
          const info = await resolveMessageInfo(roomId, record.eventId)
          if (!info) return null
          return { ...record, sender: info.sender, body: info.body, timestamp: info.timestamp }
        })
      )
      events.value = resolved
        .filter((item): item is StickyEventInfo => item !== null)
        .sort((a, b) => b.timestamp - a.timestamp)
      hasLoaded.value = true
    } catch (err) {
      logger.error('加载粘性事件失败', err)
    } finally {
      loading.value = false
    }
  }

  /** 把某条消息设为粘性事件（整表提交，按 event_type 覆盖） */
  const setStickyEvent = async (eventId: string, eventType: string = DEFAULT_STICKY_EVENT_TYPE): Promise<boolean> => {
    const roomId = resolveRoomId()
    if (!roomId || !eventId) return false

    const table = new Map<string, Record<string, unknown>>()
    for (const item of events.value) {
      table.set(item.eventType, {
        event_type: item.eventType,
        event_id: item.eventId,
        ...(item.durationMs ? { sticky_duration_ms: item.durationMs } : {})
      })
    }
    table.set(eventType, { event_type: eventType, event_id: eventId })

    try {
      await matrixRoomActionFacade.setStickyEvents(roomId, { events: [...table.values()] })
      useMitt.emit(MittEnum.STICKY_EVENTS_CHANGED, { roomId })
      await load()
      return true
    } catch (err) {
      logger.error('设置粘性事件失败', err)
      return false
    }
  }

  /** 清除某个 event_type 的粘性事件 */
  const clearStickyEvent = async (eventType: string): Promise<boolean> => {
    const roomId = resolveRoomId()
    if (!roomId || !eventType) return false

    try {
      await matrixRoomActionFacade.clearStickyEvent(roomId, eventType)
      useMitt.emit(MittEnum.STICKY_EVENTS_CHANGED, { roomId })
      await load()
      return true
    } catch (err) {
      logger.error('清除粘性事件失败', err)
      return false
    }
  }

  return {
    events,
    loading,
    hasLoaded,
    canSetSticky,
    load,
    setStickyEvent,
    clearStickyEvent
  }
}
