// @vitest-environment jsdom
/**
 * Tests for useUserStatusStore, specifically the colorthief v3 API migration
 * in the module-private ensureStateColor function.
 *
 * ensureStateColor is called through:
 *   1. currentState computed getter
 *   2. watch(stateList, ..., { immediate: true })
 *
 * Focus areas:
 *   - Guard clause: (!state || state.bgColor || !state.url) → return early
 *   - Null check: getColor(img) returns null → return
 *   - Happy path: getColor(img) returns Color → .array() → assign bgColor
 */
import { createPinia, setActivePinia } from 'pinia'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

// co-routine helper
const flushMicrotasks = () => new Promise<void>((resolve) => setTimeout(resolve, 0))

// ---- Mocks (hoisted) ----

const { getColorMock } = vi.hoisted(() => {
  const getColorMock = vi.fn()
  return { getColorMock }
})

vi.mock('colorthief', () => ({
  getColor: getColorMock,
  getPalette: vi.fn(),
  getColorSync: vi.fn(),
  getPaletteSync: vi.fn(),
  getSwatches: vi.fn(),
  getSwatchesSync: vi.fn()
}))

vi.mock('@/services/matrix/user/MatrixAccountService', () => ({
  matrixAccountService: {
    setPresence: vi.fn().mockResolvedValue(undefined)
  }
}))

const mockUserStore = {
  userInfo: null as { uid: string; userStateId?: string } | null
}

vi.mock('@/stores/domains/user/user', () => ({
  useUserStore: () => mockUserStore
}))

vi.mock('@/stores/domains/chat/group', () => ({
  useGroupStore: () => ({
    updateUserItem: vi.fn()
  })
}))

vi.mock('vue-i18n', () => ({
  useI18n: () => ({
    t: (key: string) => key
  }),
  createI18n: vi.fn()
}))

// ---- Synchronous Image mock ----
let onloadCb: (() => void) | null = null

function fireOnload() {
  if (onloadCb) {
    const cb = onloadCb
    onloadCb = null
    cb()
  }
}

// Import the store under test after mocks are registered
import { useUserStatusStore } from '../userStatus'

describe('useUserStatusStore', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    getColorMock.mockResolvedValue(null)
    onloadCb = null

    vi.stubGlobal(
      'Image',
      vi.fn(function (this: any) {
        const img: any = { src: '' }
        Object.defineProperty(img, 'onload', {
          get: () => onloadCb,
          set: (cb: () => void) => {
            onloadCb = cb
          }
        })
        return img
      }) as any
    )

    mockUserStore.userInfo = null
    setActivePinia(createPinia())
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('initializes with empty stateList', () => {
    const store = useUserStatusStore()
    expect(store.stateList).toEqual([])
    expect(store.currentState).toBeUndefined()
  })

  describe('ensureStateColor — guard clause (colorthief v3 never called)', () => {
    it('does not call getColor when state already has bgColor', () => {
      const store = useUserStatusStore()
      store.stateList = [{ id: '1', url: 'http://x.com/icon.png', bgColor: 'rgba(255,0,0,0.4)' }] as any[]

      // Access currentState to trigger ensureStateColor
      void store.currentState

      // ensureStateColor should return early since bgColor is set
      fireOnload()
      expect(getColorMock).not.toHaveBeenCalled()
    })

    it('does not call getColor when state.url is empty', () => {
      const store = useUserStatusStore()
      store.stateList = [{ id: '1', url: '' }] as any[]

      void store.currentState

      // ensureStateColor should return early since !state.url
      fireOnload()
      expect(getColorMock).not.toHaveBeenCalled()
    })
  })

  describe('ensureStateColor — null color branch (colorthief v3 returns null)', () => {
    it('does not set bgColor when getColor resolves to null', async () => {
      getColorMock.mockResolvedValue(null)

      const store = useUserStatusStore()
      const state: any = { id: '1', url: 'http://example.com/icon.png' }
      store.stateList = [state]

      // Access currentState to trigger ensureStateColor via the computed getter
      void store.currentState

      // Fire image onload, then wait for async getColor to settle
      fireOnload()
      await flushMicrotasks()

      // null return from getColor should NOT set bgColor
      expect(state.bgColor).toBeUndefined()
      expect(getColorMock).toHaveBeenCalledTimes(1)
    })
  })

  describe('ensureStateColor — happy path (colorthief v3 Color.array())', () => {
    it('sets bgColor via Color.array() when getColor returns a valid Color', async () => {
      getColorMock.mockResolvedValue({
        array: () => [100, 150, 200]
      })

      const store = useUserStatusStore()
      const state: any = { id: '1', url: 'http://example.com/status-icon.png' }
      store.stateList = [state]

      // Access currentState to trigger the computed getter
      void store.currentState

      // Fire image onload
      fireOnload()
      await flushMicrotasks()

      // Should destructure from Color.array() and format rgba
      expect(state.bgColor).toBe('rgba(100, 150, 200, 0.4)')
      expect(getColorMock).toHaveBeenCalledTimes(1)
    })

    it('also sets bgColor when triggered via the watch on stateList', async () => {
      getColorMock.mockResolvedValue({
        array: () => [50, 60, 70]
      })

      const store = useUserStatusStore()
      const state: any = { id: '1', url: 'http://example.com/watch-icon.png' }
      store.stateList = [state]

      // The watch on stateList fires synchronously when stateList changes,
      // calling ensureStateColor directly for each item.
      fireOnload()
      await flushMicrotasks()

      expect(state.bgColor).toBe('rgba(50, 60, 70, 0.4)')
    })
  })

  describe('currentState computed', () => {
    it('finds state matching the current stateId', () => {
      const store = useUserStatusStore()
      store.stateList = [{ id: '1', url: 'http://x.com/online.png' }] as any[]
      store.stateId = '1'

      const result = store.currentState
      expect(result).toBeDefined()
      expect(result!.id).toBe('1')
    })

    it('falls back to default state id "1" when stateId does not match', () => {
      const store = useUserStatusStore()
      store.stateList = [{ id: '1', url: 'http://x.com/online.png' }] as any[]
      store.stateId = '5'

      // stateId is '5', no item with id='5'. Should fall back to id='1'
      const result = store.currentState
      expect(result).toBeDefined()
      expect(result!.id).toBe('1')
    })
  })

  describe('changeCurrentUserState', () => {
    it('updates stateId and calls matrixAccountService.setPresence', async () => {
      const store = useUserStatusStore()

      await store.changeCurrentUserState({ id: '3', title: 'Busy', url: 'icon.png' } as any)

      expect(store.stateId).toBe('3')

      const { matrixAccountService } = await import('@/services/matrix/user/MatrixAccountService')
      expect(matrixAccountService.setPresence).toHaveBeenCalled()
    })

    it('updates userStore.userInfo when user is logged in', async () => {
      mockUserStore.userInfo = { uid: 'u-1' }
      const store = useUserStatusStore()

      await store.changeCurrentUserState({ id: '5', title: 'Away', url: 'icon.png' } as any)

      expect(mockUserStore.userInfo!.userStateId).toBe('5')
    })
  })
})
