import { mount } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import BurnMessage from '../BurnMessage.vue'

const mocks = vi.hoisted(() => ({
  markMessageRead: vi.fn().mockResolvedValue(true),
  updateMsg: vi.fn(),
  deleteMsg: vi.fn(),
  markEventBurned: vi.fn()
}))

vi.mock('@/composables/useBurnAfterRead', () => ({
  useBurnAfterRead: () => ({ markMessageRead: mocks.markMessageRead })
}))

vi.mock('@/stores/domains/chat/chat', () => ({
  useChatStore: () => ({ updateMsg: mocks.updateMsg, deleteMsg: mocks.deleteMsg })
}))

vi.mock('@/stores/domains/user/user', () => ({
  useUserStore: () => ({ userInfo: { uid: '@me:hs' } })
}))

vi.mock('@/utils/burnedMessages', () => ({
  markEventBurned: mocks.markEventBurned
}))

/**
 * 防止 happy-dom 的 IntersectionObserver 在挂载时触发阅读回调，
 * 本文件只验证「倒计时结束后的本地焚毁」，阅读触发由别处测试覆盖。
 */
class MockIntersectionObserver {
  observe = vi.fn()
  unobserve = vi.fn()
  disconnect = vi.fn()
}

function mountBurning(overrides: Record<string, unknown> = {}) {
  return mount(BurnMessage, {
    props: {
      msgId: '$m1',
      eventId: '$e1',
      roomId: '!room:hs',
      senderId: '@peer:hs',
      burnAfterRead: true,
      burnDuration: 1,
      isBurning: true,
      ...overrides
    }
  })
}

describe('BurnMessage 焚毁收尾', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.clearAllMocks()
    vi.stubGlobal('IntersectionObserver', MockIntersectionObserver)
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.unstubAllGlobals()
  })

  it('挂载时 isBurning 已为 true 也会自动启动倒计时', async () => {
    const wrapper = mountBurning()

    await vi.advanceTimersByTimeAsync(1000)

    expect(mocks.markEventBurned).toHaveBeenCalledWith('$e1')
    wrapper.unmount()
  })

  it('倒计时结束后写黑名单并从当前会话移除消息（重载不复活）', async () => {
    const wrapper = mountBurning()

    await vi.advanceTimersByTimeAsync(1000)

    expect(mocks.markEventBurned).toHaveBeenCalledTimes(1)
    expect(mocks.markEventBurned).toHaveBeenCalledWith('$e1')
    expect(mocks.deleteMsg).toHaveBeenCalledWith('$m1')
    wrapper.unmount()
  })

  it('eventId 缺失时回落用 msgId 作为黑名单键', async () => {
    const wrapper = mountBurning({ eventId: undefined })

    await vi.advanceTimersByTimeAsync(1000)

    expect(mocks.markEventBurned).toHaveBeenCalledWith('$m1')
    expect(mocks.deleteMsg).toHaveBeenCalledWith('$m1')
    wrapper.unmount()
  })

  it('倒计时未结束时不会提前焚毁', async () => {
    const wrapper = mountBurning({ burnDuration: 5 })

    await vi.advanceTimersByTimeAsync(1000)

    expect(mocks.markEventBurned).not.toHaveBeenCalled()
    expect(mocks.deleteMsg).not.toHaveBeenCalled()
    wrapper.unmount()
  })
})
