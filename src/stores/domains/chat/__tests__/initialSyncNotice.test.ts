import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it } from 'vitest'
import { useInitialSyncStore } from '../initialSync'
import { useNoticeStore } from '../notice'

describe('useInitialSyncStore', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it('starts with empty synced users', () => {
    const store = useInitialSyncStore()
    expect(store.syncedUsers).toEqual([])
  })

  it('isSynced returns false for unknown uid', () => {
    const store = useInitialSyncStore()
    expect(store.isSynced('@alice:example.com')).toBe(false)
  })

  it('isSynced returns false for empty uid', () => {
    const store = useInitialSyncStore()
    expect(store.isSynced('')).toBe(false)
  })

  it('markSynced adds uid and isSynced reflects it', () => {
    const store = useInitialSyncStore()
    store.markSynced('@alice:example.com')
    expect(store.isSynced('@alice:example.com')).toBe(true)
  })

  it('markSynced is idempotent', () => {
    const store = useInitialSyncStore()
    store.markSynced('@alice:example.com')
    store.markSynced('@alice:example.com')
    expect(store.syncedUsers).toEqual(['@alice:example.com'])
  })

  it('markSynced ignores empty uid', () => {
    const store = useInitialSyncStore()
    store.markSynced('')
    expect(store.syncedUsers).toEqual([])
  })

  it('tracks multiple uids in insertion order', () => {
    const store = useInitialSyncStore()
    store.markSynced('@a:x')
    store.markSynced('@b:x')
    expect(store.syncedUsers).toEqual(['@a:x', '@b:x'])
  })
})

describe('useNoticeStore', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it('initializes with systemNotice=false', () => {
    const store = useNoticeStore()
    expect(store.systemNotice).toBe(false)
  })

  it('allows toggling systemNotice', () => {
    const store = useNoticeStore()
    store.systemNotice = true
    expect(store.systemNotice).toBe(true)
    store.systemNotice = false
    expect(store.systemNotice).toBe(false)
  })
})
