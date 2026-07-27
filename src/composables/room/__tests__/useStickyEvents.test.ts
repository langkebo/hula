import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ref } from 'vue'
import { type StickyEventInfo, type StickyEventsService, useStickyEvents } from '@/composables/room/useStickyEvents'

describe('useStickyEvents — 粘性事件 composable (§8.2)', () => {
  const getStickyEventsMock = vi.fn<(roomId: string) => Promise<StickyEventInfo[]>>()
  let service: StickyEventsService

  beforeEach(() => {
    vi.clearAllMocks()
    service = { getStickyEvents: getStickyEventsMock }
  })

  function makeEvents(count: number): StickyEventInfo[] {
    return Array.from({ length: count }, (_, i) => ({
      eventId: `$evt${i}:server`,
      sender: `@user${i}:server`,
      body: `粘性事件内容 ${i}`,
      timestamp: 1000 + i
    }))
  }

  describe('加载粘性事件', () => {
    it('房间无粘性事件时 hasSticky 为 false', async () => {
      getStickyEventsMock.mockResolvedValue([])
      const { hasSticky, load } = useStickyEvents({ roomId: '!room:server', service })
      await load()
      expect(hasSticky.value).toBe(false)
    })

    it('房间有粘性事件时 hasSticky 为 true', async () => {
      getStickyEventsMock.mockResolvedValue(makeEvents(2))
      const { hasSticky, load } = useStickyEvents({ roomId: '!room:server', service })
      await load()
      expect(hasSticky.value).toBe(true)
    })

    it('加载完成后 stickyEvents 按时间倒序排列（最新在前）', async () => {
      getStickyEventsMock.mockResolvedValue(makeEvents(3))
      const { stickyEvents, load } = useStickyEvents({ roomId: '!room:server', service })
      await load()
      expect(stickyEvents.value).toHaveLength(3)
      expect(stickyEvents.value[0].timestamp).toBe(1002)
      expect(stickyEvents.value[2].timestamp).toBe(1000)
    })

    it('roomId 为空时不发起请求且 hasSticky 为 false', async () => {
      const { hasSticky, load } = useStickyEvents({ roomId: null, service })
      await load()
      expect(getStickyEventsMock).not.toHaveBeenCalled()
      expect(hasSticky.value).toBe(false)
    })

    it('服务异常时不抛出，stickyEvents 为空', async () => {
      getStickyEventsMock.mockRejectedValue(new Error('网络错误'))
      const { stickyEvents, load } = useStickyEvents({ roomId: '!room:server', service })
      await expect(load()).resolves.toBeUndefined()
      expect(stickyEvents.value).toEqual([])
    })

    it('响应式 roomId 切换时重新加载', async () => {
      getStickyEventsMock.mockResolvedValue(makeEvents(1))
      const roomId = ref<string | null>('!room1:server')
      const { load, stickyEvents } = useStickyEvents({ roomId, service })
      await load()
      expect(getStickyEventsMock).toHaveBeenLastCalledWith('!room1:server')

      roomId.value = '!room2:server'
      await load()
      expect(getStickyEventsMock).toHaveBeenLastCalledWith('!room2:server')
      expect(stickyEvents.value).toHaveLength(1)
    })
  })

  describe('折叠/展开状态', () => {
    it('初始为折叠态 expanded=false', () => {
      const { expanded } = useStickyEvents({ roomId: '!room:server', service })
      expect(expanded.value).toBe(false)
    })

    it('toggleExpand 切换展开状态', () => {
      const { expanded, toggleExpand } = useStickyEvents({ roomId: '!room:server', service })
      expect(expanded.value).toBe(false)
      toggleExpand()
      expect(expanded.value).toBe(true)
      toggleExpand()
      expect(expanded.value).toBe(false)
    })

    it('expand / collapse 显式设置状态', () => {
      const { expanded, expand, collapse } = useStickyEvents({ roomId: '!room:server', service })
      expand()
      expect(expanded.value).toBe(true)
      collapse()
      expect(expanded.value).toBe(false)
    })

    it('折叠态 visibleCount 为 1（仅显示最近一条）', async () => {
      getStickyEventsMock.mockResolvedValue(makeEvents(3))
      const { visibleCount, load } = useStickyEvents({ roomId: '!room:server', service })
      await load()
      expect(visibleCount.value).toBe(1)
    })

    it('展开态 visibleCount 为全部粘性事件数', async () => {
      getStickyEventsMock.mockResolvedValue(makeEvents(3))
      const { visibleCount, expand, load } = useStickyEvents({ roomId: '!room:server', service })
      await load()
      expand()
      expect(visibleCount.value).toBe(3)
    })

    it('最多展示 3 条（折叠态）', async () => {
      getStickyEventsMock.mockResolvedValue(makeEvents(5))
      const { visibleCount, load } = useStickyEvents({ roomId: '!room:server', service })
      await load()
      expect(visibleCount.value).toBe(1)
    })
  })

  describe('最近粘性事件', () => {
    it('latestSticky 返回时间戳最大的一条', async () => {
      getStickyEventsMock.mockResolvedValue(makeEvents(3))
      const { latestSticky, load } = useStickyEvents({ roomId: '!room:server', service })
      await load()
      expect(latestSticky.value).not.toBeNull()
      expect(latestSticky.value?.eventId).toBe('$evt2:server')
    })

    it('无粘性事件时 latestSticky 为 null', async () => {
      getStickyEventsMock.mockResolvedValue([])
      const { latestSticky, load } = useStickyEvents({ roomId: '!room:server', service })
      await load()
      expect(latestSticky.value).toBeNull()
    })
  })
})
