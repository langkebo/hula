import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useRightViewDraftStore } from '../rightViewDraft'

describe('useRightViewDraftStore', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
  })

  describe('initial state', () => {
    it('initializes addFriend draft with empty defaults', () => {
      const store = useRightViewDraftStore()
      expect(store.addFriend).toEqual({
        searchValue: '',
        searchMode: 'fuzzy',
        requestMessage: ''
      })
    })

    it('initializes createRoom draft with encrypted=true and private_room defaults', () => {
      const store = useRightViewDraftStore()
      expect(store.createRoom).toMatchObject({
        name: '',
        topic: '',
        avatarUrl: '',
        roomType: 'private_room',
        isEncrypted: true,
        joinRule: 'invite'
      })
    })

    it('initializes joinRoom and createSpace drafts as empty', () => {
      const store = useRightViewDraftStore()
      expect(store.joinRoom).toEqual({ roomIdOrAlias: '', reason: '' })
      expect(store.createSpace).toEqual({ name: '', topic: '', avatarUrl: '' })
    })

    it('initializes restoredHint as null', () => {
      const store = useRightViewDraftStore()
      expect(store.restoredHint).toBeNull()
    })
  })

  describe('saveAddFriend', () => {
    it('merges patch into existing addFriend draft', () => {
      const store = useRightViewDraftStore()
      store.saveAddFriend({ searchValue: 'alice' })
      expect(store.addFriend.searchValue).toBe('alice')
      // 未传字段保留原值
      expect(store.addFriend.searchMode).toBe('fuzzy')
    })

    it('supports partial updates without losing other fields', () => {
      const store = useRightViewDraftStore()
      store.saveAddFriend({ searchValue: 'bob', requestMessage: 'hi' })
      store.saveAddFriend({ searchMode: 'exact' })
      expect(store.addFriend).toEqual({
        searchValue: 'bob',
        searchMode: 'exact',
        requestMessage: 'hi'
      })
    })
  })

  describe('saveCreateRoom', () => {
    it('merges patch into createRoom draft', () => {
      const store = useRightViewDraftStore()
      store.saveCreateRoom({ name: 'Room A', isEncrypted: false })
      expect(store.createRoom.name).toBe('Room A')
      expect(store.createRoom.isEncrypted).toBe(false)
      expect(store.createRoom.topic).toBe('')
    })
  })

  describe('saveJoinRoom', () => {
    it('merges patch into joinRoom draft', () => {
      const store = useRightViewDraftStore()
      store.saveJoinRoom({ roomIdOrAlias: '#room:example.com' })
      expect(store.joinRoom.roomIdOrAlias).toBe('#room:example.com')
    })
  })

  describe('saveCreateSpace', () => {
    it('merges patch into createSpace draft', () => {
      const store = useRightViewDraftStore()
      store.saveCreateSpace({ name: 'Space A', topic: 'description' })
      expect(store.createSpace.name).toBe('Space A')
      expect(store.createSpace.topic).toBe('description')
    })
  })

  describe('clearAddFriend / clearCreateRoom / clearJoinRoom / clearCreateSpace', () => {
    it('clearAddFriend resets to empty defaults', () => {
      const store = useRightViewDraftStore()
      store.saveAddFriend({ searchValue: 'alice', requestMessage: 'hi' })
      store.clearAddFriend()
      expect(store.addFriend).toEqual({
        searchValue: '',
        searchMode: 'fuzzy',
        requestMessage: ''
      })
    })

    it('clearCreateRoom resets to empty defaults', () => {
      const store = useRightViewDraftStore()
      store.saveCreateRoom({ name: 'Room', isEncrypted: false })
      store.clearCreateRoom()
      expect(store.createRoom.name).toBe('')
      expect(store.createRoom.isEncrypted).toBe(true)
    })

    it('clearJoinRoom resets to empty defaults', () => {
      const store = useRightViewDraftStore()
      store.saveJoinRoom({ roomIdOrAlias: '#room:example.com' })
      store.clearJoinRoom()
      expect(store.joinRoom.roomIdOrAlias).toBe('')
    })

    it('clearCreateSpace resets to empty defaults', () => {
      const store = useRightViewDraftStore()
      store.saveCreateSpace({ name: 'Space' })
      store.clearCreateSpace()
      expect(store.createSpace.name).toBe('')
    })
  })

  describe('clearAll', () => {
    it('clears all four drafts and restoredHint', () => {
      const store = useRightViewDraftStore()
      store.saveAddFriend({ searchValue: 'a' })
      store.saveCreateRoom({ name: 'b' })
      store.saveJoinRoom({ roomIdOrAlias: 'c' })
      store.saveCreateSpace({ name: 'd' })
      store.setRestoredHint('addFriend')

      store.clearAll()

      expect(store.addFriend.searchValue).toBe('')
      expect(store.createRoom.name).toBe('')
      expect(store.joinRoom.roomIdOrAlias).toBe('')
      expect(store.createSpace.name).toBe('')
      expect(store.restoredHint).toBeNull()
    })
  })

  describe('setRestoredHint', () => {
    it('sets restoredHint to the given key', () => {
      const store = useRightViewDraftStore()
      store.setRestoredHint('createRoom')
      expect(store.restoredHint).toBe('createRoom')
    })

    it('clears restoredHint when passed null', () => {
      const store = useRightViewDraftStore()
      store.setRestoredHint('addFriend')
      store.setRestoredHint(null)
      expect(store.restoredHint).toBeNull()
    })
  })

  describe('session-level persistence (非 localStorage)', () => {
    // 需求文档 7.3 节：会话级别，刷新清空
    it('does not persist to localStorage (session-level only)', () => {
      const store = useRightViewDraftStore()
      store.saveAddFriend({ searchValue: 'persistent?' })
      // Pinia 默认不持久化，除非配置 persist: true
      // rightViewDraft store 未配置 persist，所以 localStorage 不应有数据
      expect(localStorage.getItem('rightViewDraft')).toBeNull()
    })
  })
})
