import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it } from 'vitest'
import { useAlwaysOnTopStore } from '../alwaysOnTop'

describe('useAlwaysOnTopStore', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it('initializes with empty alwaysOnTop record', () => {
    const store = useAlwaysOnTopStore()
    expect(store.alwaysOnTop).toEqual({})
  })

  it('returns undefined for unknown window key', () => {
    const store = useAlwaysOnTopStore()
    expect(store.getWindowTop('home')).toBeUndefined()
  })

  it('stores and retrieves window pinned state', () => {
    const store = useAlwaysOnTopStore()
    store.setWindowTop('home', true)
    expect(store.getWindowTop('home')).toBe(true)
  })

  it('updates an existing window pinned state', () => {
    const store = useAlwaysOnTopStore()
    store.setWindowTop('home', true)
    store.setWindowTop('home', false)
    expect(store.getWindowTop('home')).toBe(false)
  })

  it('keeps states for different windows isolated', () => {
    const store = useAlwaysOnTopStore()
    store.setWindowTop('home', true)
    store.setWindowTop('settings', false)
    expect(store.getWindowTop('home')).toBe(true)
    expect(store.getWindowTop('settings')).toBe(false)
    expect(store.alwaysOnTop).toEqual({ home: true, settings: false })
  })
})
