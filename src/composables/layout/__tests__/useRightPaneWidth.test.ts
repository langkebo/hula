import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ref } from 'vue'
import type { RightViewType } from '@/layout/right/types'
import { useRightPaneWidth } from '../useRightPaneWidth'

// localStorage mock
const storage = new Map<string, string>()
const localStorageMock = {
  getItem: vi.fn((key: string) => storage.get(key) ?? null),
  setItem: vi.fn((key: string, value: string) => {
    storage.set(key, value)
  }),
  removeItem: vi.fn((key: string) => {
    storage.delete(key)
  }),
  clear: vi.fn(() => {
    storage.clear()
  })
}
Object.defineProperty(window, 'localStorage', { value: localStorageMock, writable: true })

// pointer event mock
const createPointerEvent = (clientX: number) =>
  ({
    clientX,
    preventDefault: vi.fn()
  }) as unknown as PointerEvent

describe('useRightPaneWidth', () => {
  beforeEach(() => {
    storage.clear()
    vi.clearAllMocks()
  })

  it('returns default width for view', () => {
    const rightView = ref<RightViewType>('empty')
    const { width, defaultWidth } = useRightPaneWidth({ rightView })
    expect(defaultWidth.value).toBe(360)
    expect(width.value).toBe(360)
  })

  it('returns different default widths per view', () => {
    const rightView = ref<RightViewType>('empty')
    const { defaultWidth } = useRightPaneWidth({ rightView })

    const cases: Array<{ view: RightViewType; expected: number }> = [
      { view: 'empty', expected: 360 },
      { view: 'details', expected: 380 },
      { view: 'search', expected: 440 },
      { view: 'addFriend', expected: 420 },
      { view: 'createRoom', expected: 460 },
      { view: 'joinRoom', expected: 420 },
      { view: 'createSpace', expected: 460 },
      { view: 'applyList', expected: 400 },
      { view: 'spaceChildren', expected: 440 },
      { view: 'chat', expected: 620 }
    ]
    for (const { view, expected } of cases) {
      rightView.value = view
      expect(defaultWidth.value).toBe(expected)
    }
  })

  it('loads persisted width from localStorage', () => {
    storage.set('tjg.rightPaneWidth', JSON.stringify({ chat: 700 }))
    const rightView = ref<RightViewType>('chat')
    const { width } = useRightPaneWidth({ rightView })
    expect(width.value).toBe(700)
  })

  it('clamps persisted width to min/max range', () => {
    storage.set('tjg.rightPaneWidth', JSON.stringify({ chat: 9999 }))
    const rightView = ref<RightViewType>('chat')
    const { width } = useRightPaneWidth({ rightView })
    expect(width.value).toBe(800) // max
  })

  it('clamps persisted width to min', () => {
    storage.set('tjg.rightPaneWidth', JSON.stringify({ chat: 100 }))
    const rightView = ref<RightViewType>('chat')
    const { width } = useRightPaneWidth({ rightView })
    expect(width.value).toBe(360) // min
  })

  it('updates width when view changes', () => {
    const rightView = ref<RightViewType>('empty')
    const { width } = useRightPaneWidth({ rightView })
    expect(width.value).toBe(360)

    rightView.value = 'chat'
    expect(width.value).toBe(620)
  })

  it('disables transition while dragging', () => {
    const rightView = ref<RightViewType>('empty')
    const { isDragging, transitionEnabled, startDrag } = useRightPaneWidth({ rightView })

    expect(transitionEnabled.value).toBe(true)
    expect(isDragging.value).toBe(false)

    // 模拟 pointerdown 开始拖拽
    const addEventListenerSpy = vi.spyOn(document, 'addEventListener')
    startDrag(createPointerEvent(500))

    expect(isDragging.value).toBe(true)
    expect(transitionEnabled.value).toBe(false)
    expect(addEventListenerSpy).toHaveBeenCalledWith('pointermove', expect.any(Function))
    expect(addEventListenerSpy).toHaveBeenCalledWith('pointerup', expect.any(Function))
  })

  it('adjusts width during drag and clamps to range', () => {
    const rightView = ref<RightViewType>('chat') // default 620
    const { width, startDrag } = useRightPaneWidth({ rightView })

    // 模拟拖拽：startX=600，向左移动到 clientX=500（delta=100，宽度+100）
    startDrag(createPointerEvent(600))

    // 触发 pointermove
    const moveHandler = vi
      .spyOn(document, 'addEventListener')
      .mock.calls.find(([event]) => event === 'pointermove')?.[1] as (e: PointerEvent) => void
    expect(moveHandler).toBeDefined()

    moveHandler(createPointerEvent(500))
    expect(width.value).toBe(720) // 620 + 100

    // 超过 max 钳制
    moveHandler(createPointerEvent(0)) // delta=600, 620+600=1220 -> 800
    expect(width.value).toBe(800)

    // 低于 min 钳制
    moveHandler(createPointerEvent(2000)) // delta=-1400, 620-1400=-780 -> 360
    expect(width.value).toBe(360)
  })

  it('persists width to localStorage on drag end', () => {
    const rightView = ref<RightViewType>('chat')
    const { startDrag } = useRightPaneWidth({ rightView })

    startDrag(createPointerEvent(600))

    const moveHandler = vi
      .spyOn(document, 'addEventListener')
      .mock.calls.find(([event]) => event === 'pointermove')?.[1] as (e: PointerEvent) => void
    moveHandler(createPointerEvent(500)) // 宽度变为 720

    const upHandler = vi
      .spyOn(document, 'addEventListener')
      .mock.calls.find(([event]) => event === 'pointerup')?.[1] as () => void
    upHandler()

    expect(localStorageMock.setItem).toHaveBeenCalledWith('tjg.rightPaneWidth', JSON.stringify({ chat: 720 }))
  })

  it('re-enables transition after drag ends', () => {
    const rightView = ref<RightViewType>('empty')
    const { isDragging, transitionEnabled, startDrag } = useRightPaneWidth({ rightView })

    startDrag(createPointerEvent(500))
    expect(isDragging.value).toBe(true)
    expect(transitionEnabled.value).toBe(false)

    const upHandler = vi
      .spyOn(document, 'addEventListener')
      .mock.calls.find(([event]) => event === 'pointerup')?.[1] as () => void
    upHandler()

    expect(isDragging.value).toBe(false)
    expect(transitionEnabled.value).toBe(true)
  })

  it('resetWidth restores default width and clears persisted value', () => {
    storage.set('tjg.rightPaneWidth', JSON.stringify({ chat: 700 }))
    const rightView = ref<RightViewType>('chat')
    const { width, resetWidth } = useRightPaneWidth({ rightView })

    expect(width.value).toBe(700)

    resetWidth()
    expect(width.value).toBe(620) // default
    expect(storage.get('tjg.rightPaneWidth')).toBeUndefined()
  })

  it('uses custom storage key when provided', () => {
    const rightView = ref<RightViewType>('empty')
    useRightPaneWidth({ rightView, storageKey: 'custom.key' })

    expect(localStorageMock.getItem).toHaveBeenCalledWith('custom.key')
  })

  it('handles corrupted localStorage gracefully', () => {
    storage.set('tjg.rightPaneWidth', 'not-json')
    const rightView = ref<RightViewType>('empty')
    const { width } = useRightPaneWidth({ rightView })
    expect(width.value).toBe(360) // 回退到默认
  })

  it('removes storage key when all persisted widths are cleared', () => {
    storage.set('tjg.rightPaneWidth', JSON.stringify({ chat: 700, empty: 400 }))
    const rightView = ref<RightViewType>('chat')
    const { resetWidth } = useRightPaneWidth({ rightView })

    // 清除 chat 后还有 empty
    resetWidth()
    expect(storage.get('tjg.rightPaneWidth')).toBe(JSON.stringify({ empty: 400 }))

    // 切换到 empty 并清除
    rightView.value = 'empty'
    resetWidth()
    expect(storage.get('tjg.rightPaneWidth')).toBeUndefined()
  })
})
