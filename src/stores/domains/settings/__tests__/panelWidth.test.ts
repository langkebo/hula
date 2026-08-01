import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it } from 'vitest'
import { useSettingStore } from '../setting'

describe('panelWidth persistence', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    localStorage.clear()
  })

  it('has default panelWidth values', () => {
    const store = useSettingStore()
    expect(store.panelWidth).toEqual({ left: 280, right: 320 })
  })

  it('setPanelWidth updates left panel width with clamp', () => {
    const store = useSettingStore()
    store.setPanelWidth('left', 400)
    expect(store.panelWidth.left).toBe(400)
  })

  it('setPanelWidth clamps to min 200', () => {
    const store = useSettingStore()
    store.setPanelWidth('left', 50)
    expect(store.panelWidth.left).toBe(200)
  })

  it('setPanelWidth clamps to max 600', () => {
    const store = useSettingStore()
    store.setPanelWidth('right', 9999)
    expect(store.panelWidth.right).toBe(600)
  })
})
