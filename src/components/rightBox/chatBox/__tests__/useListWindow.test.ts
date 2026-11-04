import { describe, expect, it } from 'vitest'
import { effectScope, nextTick, ref } from 'vue'
import { LIST_WINDOW_SIZE, useListWindow } from '../useListWindow'

/** `watch` 需要 scope 才能收集，测试里用 effectScope 承载，避免跨用例互相触发 */
function createWindow<T>(items: T[]) {
  const scope = effectScope()
  const list = ref(items)
  const resetKey = ref('room-a')
  const reachedBottom: number[] = []

  const api = scope.run(() =>
    useListWindow({
      items: list,
      resetKey: () => resetKey.value,
      onReachBottom: () => reachedBottom.push(Date.now())
    })
  )!

  return { ...api, list, resetKey, reachedBottom, stop: () => scope.stop() }
}

/** 构造一个「已在底部」的滚动事件 */
function scrollEvent(scrollTop: number, clientHeight: number, scrollHeight: number) {
  return { target: { scrollTop, clientHeight, scrollHeight } as HTMLElement } as unknown as Event
}

describe('useListWindow', () => {
  it('数据不超过窗口时不裁剪', () => {
    const { visibleItems, stop } = createWindow([1, 2, 3])
    expect(visibleItems.value).toEqual([1, 2, 3])
    stop()
  })

  it('超过窗口时只渲染前 LIST_WINDOW_SIZE 项', () => {
    const items = Array.from({ length: LIST_WINDOW_SIZE * 2 + 50 }, (_, i) => i)
    const { visibleItems, stop } = createWindow(items)
    expect(visibleItems.value).toHaveLength(LIST_WINDOW_SIZE)
    stop()
  })

  it('滚到底部时追加一屏，并触发 onReachBottom', () => {
    const items = Array.from({ length: LIST_WINDOW_SIZE * 2 + 50 }, (_, i) => i)
    const { visibleItems, handleScroll, reachedBottom, stop } = createWindow(items)

    handleScroll(scrollEvent(900, 100, 1000))
    expect(visibleItems.value).toHaveLength(LIST_WINDOW_SIZE * 2)
    expect(reachedBottom).toHaveLength(1)
    stop()
  })

  it('未到底部时不追加', () => {
    const items = Array.from({ length: LIST_WINDOW_SIZE * 2 + 50 }, (_, i) => i)
    const { visibleItems, handleScroll, reachedBottom, stop } = createWindow(items)

    handleScroll(scrollEvent(100, 100, 1000))
    expect(visibleItems.value).toHaveLength(LIST_WINDOW_SIZE)
    expect(reachedBottom).toHaveLength(0)
    stop()
  })

  it('resetKey 变化后窗口回到初始值', async () => {
    const items = Array.from({ length: LIST_WINDOW_SIZE * 2 + 50 }, (_, i) => i)
    const { visibleItems, handleScroll, resetKey, stop } = createWindow(items)

    handleScroll(scrollEvent(900, 100, 1000))
    expect(visibleItems.value).toHaveLength(LIST_WINDOW_SIZE * 2)

    resetKey.value = 'room-b'
    await nextTick()
    expect(visibleItems.value).toHaveLength(LIST_WINDOW_SIZE)
    stop()
  })

  it('到底但已全部渲染时不会无限增长', () => {
    const { visibleItems, handleScroll, stop } = createWindow([1, 2])
    handleScroll(scrollEvent(900, 100, 1000))
    expect(visibleItems.value).toEqual([1, 2])
    stop()
  })
})
