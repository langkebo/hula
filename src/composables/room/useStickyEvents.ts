/**
 * §8.2 粘性事件 composable (MSC4354)
 *
 * 封装房间粘性事件的加载、排序与折叠/展开状态管理。
 * 折叠态仅展示最近 1 条，展开态展示全部（最多 3 条用于横幅渲染）。
 * 服务层通过依赖注入传入，便于测试。
 */
import { computed, type MaybeRefOrGetter, ref, toValue } from 'vue'
import { createLogger } from '@/utils/Logger'

const logger = createLogger('useStickyEvents')

/** 粘性事件展示信息 */
export interface StickyEventInfo {
  eventId: string
  sender: string
  body: string
  timestamp: number
}

/** 粘性事件服务接口（依赖注入，默认由 RoomOperations 实现） */
export interface StickyEventsService {
  getStickyEvents(roomId: string): Promise<StickyEventInfo[]>
}

interface UseStickyEventsOptions {
  /** 房间 ID，支持 ref / getter / 字符串 */
  roomId: MaybeRefOrGetter<string | null | undefined>
  /** 粘性事件服务（注入用于测试） */
  service: StickyEventsService
}

/**
 * 粘性事件 composable
 *
 * - 加载房间粘性事件并按时间倒序排列（最新在前）
 * - 折叠态仅展示最近 1 条，展开态展示全部
 * - 服务异常时静默降级为空列表，不阻塞 UI
 */
export function useStickyEvents(options: UseStickyEventsOptions) {
  const stickyEvents = ref<StickyEventInfo[]>([])
  const loading = ref(false)
  const expanded = ref(false)

  const hasSticky = computed<boolean>(() => stickyEvents.value.length > 0)

  const latestSticky = computed<StickyEventInfo | null>(() =>
    stickyEvents.value.length > 0 ? stickyEvents.value[0] : null
  )

  /** 当前可见的粘性事件数量：折叠态 1 条，展开态全部 */
  const visibleCount = computed<number>(() =>
    expanded.value ? stickyEvents.value.length : Math.min(1, stickyEvents.value.length)
  )

  /** 当前可见的粘性事件列表 */
  const visibleEvents = computed<StickyEventInfo[]>(() => {
    const count = visibleCount.value
    return count > 0 ? stickyEvents.value.slice(0, count) : []
  })

  const resolveRoomId = (): string | null => {
    const id = toValue(options.roomId)
    return id ? String(id) : null
  }

  const load = async (): Promise<void> => {
    const roomId = resolveRoomId()
    if (!roomId) {
      stickyEvents.value = []
      return
    }

    loading.value = true
    try {
      const events = await options.service.getStickyEvents(roomId)
      const sorted = [...events].sort((a, b) => b.timestamp - a.timestamp)
      stickyEvents.value = sorted
    } catch (err) {
      logger.error('加载粘性事件失败', err)
      stickyEvents.value = []
    } finally {
      loading.value = false
    }
  }

  const toggleExpand = (): void => {
    expanded.value = !expanded.value
  }

  const expand = (): void => {
    expanded.value = true
  }

  const collapse = (): void => {
    expanded.value = false
  }

  return {
    stickyEvents,
    hasSticky,
    latestSticky,
    loading,
    expanded,
    visibleCount,
    visibleEvents,
    load,
    toggleExpand,
    expand,
    collapse
  }
}
