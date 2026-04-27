import { beforeEach, describe, expect, it } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { useUserMenuStore } from '../userMenu'

describe('useUserMenuStore', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it('initializes closed with no position and left trigger', () => {
    const store = useUserMenuStore()
    expect(store.isOpen).toBe(false)
    expect(store.position).toBeNull()
    expect(store.trigger).toBe('left')
    expect(store.isContextMenu).toBe(false)
  })

  it('openMenu sets position, trigger, and opens', () => {
    const store = useUserMenuStore()
    store.openMenu({ x: 10, y: 20 }, 'right')
    expect(store.isOpen).toBe(true)
    expect(store.position).toEqual({ x: 10, y: 20 })
    expect(store.trigger).toBe('right')
    expect(store.isContextMenu).toBe(true)
  })

  it('openMenu defaults trigger to left', () => {
    const store = useUserMenuStore()
    store.openMenu({ x: 1, y: 2 })
    expect(store.trigger).toBe('left')
    expect(store.isContextMenu).toBe(false)
  })

  it('closeMenu resets position and trigger', () => {
    const store = useUserMenuStore()
    store.openMenu({ x: 5, y: 6 }, 'touch')
    store.closeMenu()
    expect(store.isOpen).toBe(false)
    expect(store.position).toBeNull()
    expect(store.trigger).toBe('left')
  })

  it('toggleMenu opens when closed', () => {
    const store = useUserMenuStore()
    store.toggleMenu({ x: 1, y: 1 }, 'right')
    expect(store.isOpen).toBe(true)
    expect(store.trigger).toBe('right')
  })

  it('toggleMenu closes when open', () => {
    const store = useUserMenuStore()
    store.openMenu({ x: 1, y: 1 })
    store.toggleMenu({ x: 9, y: 9 }, 'right')
    expect(store.isOpen).toBe(false)
    expect(store.position).toBeNull()
  })
})
