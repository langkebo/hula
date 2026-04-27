import { beforeEach, describe, expect, it } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { useGuideStore } from '../guide'

describe('useGuideStore', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it('initializes with isGuideCompleted false', () => {
    const store = useGuideStore()
    expect(store.isGuideCompleted).toBe(false)
  })

  it('markGuideCompleted sets the flag to true', () => {
    const store = useGuideStore()
    store.markGuideCompleted()
    expect(store.isGuideCompleted).toBe(true)
  })

  it('resetGuideStatus restores the flag to false', () => {
    const store = useGuideStore()
    store.markGuideCompleted()
    store.resetGuideStatus()
    expect(store.isGuideCompleted).toBe(false)
  })

  it('mark + reset is idempotent', () => {
    const store = useGuideStore()
    store.markGuideCompleted()
    store.markGuideCompleted()
    expect(store.isGuideCompleted).toBe(true)
    store.resetGuideStatus()
    store.resetGuideStatus()
    expect(store.isGuideCompleted).toBe(false)
  })
})
