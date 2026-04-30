import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it } from 'vitest'
import { useMobileStore } from '../mobile'

const makeRect = (overrides: Partial<DOMRect> = {}): DOMRect =>
  ({
    height: 0,
    width: 0,
    x: 0,
    y: 0,
    bottom: 0,
    left: 0,
    right: 0,
    top: 0,
    toJSON: () => ({}),
    ...overrides
  }) as DOMRect

describe('useMobileStore', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it('initializes with default safeArea (-1) and fullscreen=true', () => {
    const store = useMobileStore()
    expect(store.safeArea).toEqual({ bottom: -1, left: -1, right: -1, top: -1 })
    expect(store.isFullScreen).toBe(true)
  })

  it('updateSafeArea applies the new safe area', () => {
    const store = useMobileStore()
    store.updateSafeArea({ top: 44, bottom: 34, left: 0, right: 0 })
    expect(store.safeArea).toEqual({ top: 44, bottom: 34, left: 0, right: 0 })
  })

  it('updateSafeArea sets isFullScreen=false when bottom is 0', () => {
    const store = useMobileStore()
    store.updateSafeArea({ top: 44, bottom: 0, left: 0, right: 0 })
    expect(store.isFullScreen).toBe(false)
  })

  it('updateSafeArea sets isFullScreen=true when bottom is non-zero', () => {
    const store = useMobileStore()
    store.updateSafeArea({ top: 44, bottom: 0, left: 0, right: 0 })
    store.updateSafeArea({ top: 44, bottom: 34, left: 0, right: 0 })
    expect(store.isFullScreen).toBe(true)
  })

  it('updateTabBarPosition only updates current position when isInit=false', () => {
    const store = useMobileStore()
    const init = makeRect({ top: 600 })
    const next = makeRect({ top: 700 })
    store.updateTabBarPosition({ newPosition: init, isInit: true })
    store.updateTabBarPosition({ newPosition: next, isInit: false })
    expect(store.bottomTabBarPosition.top).toBe(700)
    expect(store.initBottomTabBarPosition.top).toBe(600)
  })

  it('updateTabBarPosition with isInit=true updates both positions', () => {
    const store = useMobileStore()
    const rect = makeRect({ top: 500 })
    store.updateTabBarPosition({ newPosition: rect, isInit: true })
    expect(store.bottomTabBarPosition.top).toBe(500)
    expect(store.initBottomTabBarPosition.top).toBe(500)
  })
})
