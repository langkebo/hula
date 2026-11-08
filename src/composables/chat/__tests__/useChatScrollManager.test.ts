import { mount, type VueWrapper } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { computed, defineComponent, h, ref } from 'vue'
import { useChatScrollManager } from '../useChatScrollManager'

interface ContainerMetrics {
  scrollHeight?: number
  clientHeight?: number
}

let rafQueue: Array<{ id: number; callback: FrameRequestCallback }> = []
let rafSequence = 0
let activeWrapper: VueWrapper | null = null

/** 执行当前已排队的帧回调（快照语义：回调内部再排队的留到下一次 flush） */
function flushRaf(): void {
  const snapshot = rafQueue
  rafQueue = []
  for (const { callback } of snapshot) {
    callback(performance.now())
  }
}

function createContainer({ scrollHeight = 1000, clientHeight = 400 }: ContainerMetrics = {}): HTMLElement {
  const element = document.createElement('div')
  let currentScrollTop = 0

  Object.defineProperty(element, 'scrollHeight', { configurable: true, get: () => scrollHeight })
  Object.defineProperty(element, 'clientHeight', { configurable: true, get: () => clientHeight })
  Object.defineProperty(element, 'scrollTop', {
    configurable: true,
    get: () => currentScrollTop,
    set: (value: number) => {
      currentScrollTop = value
    }
  })

  return element
}

function setupManager(metrics: ContainerMetrics = {}) {
  const container = createContainer(metrics)
  const onScrollToBottom = vi.fn()
  const clearNewMsgCount = vi.fn()
  let manager!: ReturnType<typeof useChatScrollManager>

  activeWrapper = mount(
    defineComponent({
      setup() {
        manager = useChatScrollManager({
          scrollContainer: ref<HTMLElement | null>(container),
          onLoadMore: vi.fn().mockResolvedValue(undefined),
          isLastPage: computed(() => false),
          isLoading: computed(() => false),
          currentRoomId: computed(() => '!room:example.org'),
          clearNewMsgCount,
          onScrollToBottom
        })
        return () => h('div')
      }
    })
  )

  return { container, manager, onScrollToBottom, clearNewMsgCount }
}

function scrollEvent(container: HTMLElement): Event {
  return { target: container } as unknown as Event
}

describe('useChatScrollManager 帧合并与节流', () => {
  beforeEach(() => {
    rafQueue = []
    rafSequence = 0
    vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => {
      rafSequence += 1
      rafQueue.push({ id: rafSequence, callback })
      return rafSequence
    })
    vi.stubGlobal('cancelAnimationFrame', (id: number) => {
      rafQueue = rafQueue.filter((item) => item.id !== id)
    })
  })

  afterEach(() => {
    activeWrapper?.unmount()
    activeWrapper = null
    vi.unstubAllGlobals()
  })

  it('同一帧内多次贴底只写一次 scrollTop，且只回调一次 onScrollToBottom', () => {
    const { container, manager, onScrollToBottom } = setupManager({ scrollHeight: 1200, clientHeight: 400 })

    manager.scrollToBottom()
    manager.scrollToBottom()
    manager.scrollToBottom()

    // 帧回调尚未执行：不应提前写 DOM
    expect(container.scrollTop).toBe(0)

    flushRaf()

    expect(container.scrollTop).toBe(1200)
    expect(onScrollToBottom).toHaveBeenCalledTimes(1)
  })

  it('滚动事件高频触发时 scrollTop 每帧只更新一次，isAtBottom 即时生效', () => {
    const { container, manager } = setupManager({ scrollHeight: 1000, clientHeight: 400 })
    const event = scrollEvent(container)

    container.scrollTop = 200
    manager.handleScroll(event)
    container.scrollTop = 300
    manager.handleScroll(event)
    container.scrollTop = 350
    manager.handleScroll(event)

    // ref 未到帧不更新；isAtBottom 必须即时反映最新位置（否则新消息会误判在底部而自动贴底）
    expect(manager.scrollTop.value).toBe(0)
    expect(manager.isAtBottom.value).toBe(false)

    flushRaf()

    expect(manager.scrollTop.value).toBe(350)
    expect(manager.isAtBottom.value).toBe(false)
  })

  it('滚回底部时 isAtBottom 立即恢复为 true', () => {
    const { container, manager } = setupManager({ scrollHeight: 1000, clientHeight: 400 })
    const event = scrollEvent(container)

    container.scrollTop = 600
    manager.handleScroll(event)
    expect(manager.isAtBottom.value).toBe(true)

    container.scrollTop = 100
    manager.handleScroll(event)
    expect(manager.isAtBottom.value).toBe(false)
  })

  it('cleanup 取消未执行的帧回调，不再写 DOM', () => {
    const { container, manager } = setupManager({ scrollHeight: 1200, clientHeight: 400 })

    manager.scrollToBottom()
    expect(rafQueue.length).toBeGreaterThan(0)

    manager.cleanup()
    flushRaf()

    expect(container.scrollTop).toBe(0)
  })
})
