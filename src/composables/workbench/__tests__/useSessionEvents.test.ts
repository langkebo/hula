import { flushPromises, mount } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, nextTick, ref } from 'vue'
import { MittEnum } from '@/enums'

const mittHandlers = new Map<string, Set<(payload?: unknown) => unknown>>()
const useMittEmitMock = vi.fn()
const useMittOnMock = vi.fn((event: MittEnum | string, handler: (payload?: unknown) => unknown) => {
  const key = String(event)
  const handlers = mittHandlers.get(key) ?? new Set<(payload?: unknown) => unknown>()
  handlers.add(handler)
  mittHandlers.set(key, handlers)

  return () => {
    handlers.delete(handler)
    if (handlers.size === 0) {
      mittHandlers.delete(key)
    }
  }
})

const useMittOffMock = vi.fn((event: MittEnum | string, handler: (payload?: unknown) => unknown) => {
  const key = String(event)
  mittHandlers.get(key)?.delete(handler)
})

vi.mock('@/composables/common/useMitt', () => ({
  useMitt: {
    emit: useMittEmitMock,
    on: useMittOnMock,
    off: useMittOffMock
  }
}))

const { useSessionEvents } = await import('../useSessionEvents')

const flushAll = async () => {
  await flushPromises()
  await nextTick()
  await flushPromises()
}

const emitMitt = async (event: MittEnum | string, payload?: unknown) => {
  const handlers = [...(mittHandlers.get(String(event)) ?? [])]
  for (const handler of handlers) {
    await handler(payload)
  }
}

const createHarness = async (
  options: Parameters<typeof useSessionEvents>[0] = {
    currentSessionRoomId: ref(''),
    invalidateSessionCache: vi.fn(),
    handleSessionDelete: vi.fn(),
    ensureSessionVisible: vi.fn(),
    scrollToSession: vi.fn()
  }
) => {
  const Harness = defineComponent({
    setup() {
      useSessionEvents(options)
      return () => null
    }
  })

  const wrapper = mount(Harness)
  await flushAll()
  return wrapper
}

describe('useSessionEvents', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mittHandlers.clear()
  })

  afterEach(() => {
    mittHandlers.clear()
  })

  it('emits LOCATE_SESSION for the current room before mount', async () => {
    const currentSessionRoomId = ref('!room:server')

    const wrapper = await createHarness({
      currentSessionRoomId,
      invalidateSessionCache: vi.fn(),
      handleSessionDelete: vi.fn(),
      ensureSessionVisible: vi.fn(),
      scrollToSession: vi.fn()
    })

    expect(useMittEmitMock).toHaveBeenCalledWith(MittEnum.LOCATE_SESSION, { roomId: '!room:server' })

    wrapper.unmount()
  })

  it('wires update and delete events to the provided callbacks', async () => {
    const invalidateSessionCache = vi.fn()
    const handleSessionDelete = vi.fn()

    const wrapper = await createHarness({
      currentSessionRoomId: ref(''),
      invalidateSessionCache,
      handleSessionDelete,
      ensureSessionVisible: vi.fn(),
      scrollToSession: vi.fn()
    })

    await emitMitt(MittEnum.UPDATE_SESSION_LAST_MSG, { roomId: '!target:server' })
    await emitMitt(MittEnum.DELETE_SESSION, '!target:server')

    expect(invalidateSessionCache).toHaveBeenCalledWith('!target:server')
    expect(handleSessionDelete).toHaveBeenCalledWith('!target:server')

    wrapper.unmount()
  })

  it('skips invalidation without roomId when strict mode is enabled', async () => {
    const invalidateSessionCache = vi.fn()

    const wrapper = await createHarness({
      currentSessionRoomId: ref(''),
      invalidateSessionCache,
      handleSessionDelete: vi.fn(),
      ensureSessionVisible: vi.fn(),
      scrollToSession: vi.fn(),
      requireRoomIdForInvalidate: true
    })

    await emitMitt(MittEnum.UPDATE_SESSION_LAST_MSG, {})

    expect(invalidateSessionCache).not.toHaveBeenCalled()

    wrapper.unmount()
  })

  it('ensures the session is visible before scrolling to it', async () => {
    const callOrder: string[] = []
    const ensureSessionVisible = vi.fn(async (roomId: string) => {
      callOrder.push(`ensure:${roomId}`)
      await Promise.resolve()
    })
    const scrollToSession = vi.fn(async (roomId: string) => {
      callOrder.push(`scroll:${roomId}`)
    })

    const wrapper = await createHarness({
      currentSessionRoomId: ref(''),
      invalidateSessionCache: vi.fn(),
      handleSessionDelete: vi.fn(),
      ensureSessionVisible,
      scrollToSession
    })

    await emitMitt(MittEnum.LOCATE_SESSION, { roomId: '!focus:server' })

    expect(callOrder).toEqual(['ensure:!focus:server', 'scroll:!focus:server'])

    wrapper.unmount()
  })

  it('removes subscribed mitt handlers after unmount', async () => {
    const wrapper = await createHarness({
      currentSessionRoomId: ref(''),
      invalidateSessionCache: vi.fn(),
      handleSessionDelete: vi.fn(),
      ensureSessionVisible: vi.fn(),
      scrollToSession: vi.fn()
    })

    expect(mittHandlers.get(String(MittEnum.UPDATE_SESSION_LAST_MSG))?.size).toBe(1)
    expect(mittHandlers.get(String(MittEnum.DELETE_SESSION))?.size).toBe(1)
    expect(mittHandlers.get(String(MittEnum.LOCATE_SESSION))?.size).toBe(1)

    wrapper.unmount()

    expect(mittHandlers.get(String(MittEnum.UPDATE_SESSION_LAST_MSG))?.size ?? 0).toBe(0)
    expect(mittHandlers.get(String(MittEnum.DELETE_SESSION))?.size ?? 0).toBe(0)
    expect(mittHandlers.get(String(MittEnum.LOCATE_SESSION))?.size ?? 0).toBe(0)
  })
})
