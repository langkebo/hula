import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it } from 'vitest'
import { useInitialSyncStore } from '../initialSync'

describe('useInitialSyncStore', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it('initializes with empty syncedUsers', () => {
    const store = useInitialSyncStore()
    expect(store.syncedUsers).toEqual([])
  })

  describe('isSynced', () => {
    it('returns false for empty uid', () => {
      const store = useInitialSyncStore()
      expect(store.isSynced('')).toBe(false)
    })

    it('returns false for uid not in syncedUsers', () => {
      const store = useInitialSyncStore()
      expect(store.isSynced('@alice:matrix.test')).toBe(false)
    })

    it('returns true after uid is marked synced', () => {
      const store = useInitialSyncStore()
      store.markSynced('@alice:matrix.test')
      expect(store.isSynced('@alice:matrix.test')).toBe(true)
    })

    it('returns false for other uids after one is marked', () => {
      const store = useInitialSyncStore()
      store.markSynced('@alice:matrix.test')
      expect(store.isSynced('@bob:matrix.test')).toBe(false)
    })
  })

  describe('markSynced', () => {
    it('does nothing for empty uid', () => {
      const store = useInitialSyncStore()
      store.markSynced('')
      expect(store.syncedUsers).toEqual([])
    })

    it('adds uid to syncedUsers', () => {
      const store = useInitialSyncStore()
      store.markSynced('@alice:matrix.test')
      expect(store.syncedUsers).toEqual(['@alice:matrix.test'])
    })

    it('does not duplicate uid on repeated calls', () => {
      const store = useInitialSyncStore()
      store.markSynced('@alice:matrix.test')
      store.markSynced('@alice:matrix.test')
      store.markSynced('@alice:matrix.test')
      expect(store.syncedUsers).toEqual(['@alice:matrix.test'])
    })

    it('preserves order of multiple uids', () => {
      const store = useInitialSyncStore()
      store.markSynced('@alice:matrix.test')
      store.markSynced('@bob:matrix.test')
      store.markSynced('@carol:matrix.test')
      expect(store.syncedUsers).toEqual(['@alice:matrix.test', '@bob:matrix.test', '@carol:matrix.test'])
    })

    it('marking an already-synced uid does not reorder the list', () => {
      const store = useInitialSyncStore()
      store.markSynced('@alice:matrix.test')
      store.markSynced('@bob:matrix.test')
      store.markSynced('@alice:matrix.test')
      expect(store.syncedUsers).toEqual(['@alice:matrix.test', '@bob:matrix.test'])
    })
  })
})
