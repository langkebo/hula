import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { nextTick, reactive } from 'vue'

/**
 * 移动端聊天布局的私密房门禁遮罩。
 *
 * 关键风险：快速连续切房时，旧一次守卫的 `finally` 会把新一次刚置的
 * `gatePending=true` 清成 false，遮罩提前解除 → 私密内容闪现。
 * 因此只有最新一次运行能改 `gatePending`。
 */

const route = reactive<{ name: string; params: { roomId?: string } }>({
  name: 'mobileChatMain',
  params: { roomId: '!a:test' }
})

const mocks = vi.hoisted(() => ({
  assertAccess: vi.fn(),
  loggerError: vi.fn()
}))

vi.mock('vue-i18n', () => ({ useI18n: () => ({ t: (key: string) => key }) }))
vi.mock('vue-router', () => ({ useRoute: () => route }))
vi.mock('@/utils/Logger', () => ({
  createLogger: () => ({ error: mocks.loggerError, info: vi.fn(), warn: vi.fn(), debug: vi.fn() })
}))
vi.mock('@/composables/secretChat/useMobilePrivateRoomGate', () => ({
  useMobilePrivateRoomGate: () => ({ assertAccess: mocks.assertAccess, resolveRoomIdByPeer: () => null })
}))

import ChatRoomLayout from '../ChatRoomLayout.vue'

const MASK_SELECTOR = '[data-testid="mobile-chat-room-gate-mask"]'

type Deferred = { resolve: () => void; reject: (reason: unknown) => void }
const deferreds: Deferred[] = []

let mounted: VueWrapper | undefined

const mountLayout = () => {
  mounted = mount(ChatRoomLayout, {
    global: {
      stubs: {
        MobileLayout: { template: '<div><slot /></div>' },
        RouterView: { template: '<div class="stub-router-view" />' },
        'van-loading': { template: '<div />' }
      }
    }
  })
  return mounted
}

describe('移动端聊天布局 · 私密房遮罩', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    deferreds.length = 0
    route.name = 'mobileChatMain'
    route.params.roomId = '!a:test'
    mocks.assertAccess.mockImplementation(
      () =>
        new Promise<boolean>((resolve, reject) => {
          deferreds.push({ resolve: () => resolve(true), reject })
        })
    )
  })

  // 必须卸载：残留实例的 route watcher 会在下个用例改路由时再次触发，污染 deferreds 顺序
  afterEach(() => {
    mounted?.unmount()
    mounted = undefined
  })

  it('连续两次切房：旧一次结束不解除遮罩，只有最新一次结束才解除', async () => {
    const wrapper = mountLayout()
    await nextTick()
    expect(wrapper.find(MASK_SELECTOR).exists()).toBe(true)
    expect(deferreds).toHaveLength(1)

    // 第一次守卫还没结束就切到另一个房间
    route.params.roomId = '!b:test'
    await nextTick()
    expect(deferreds).toHaveLength(2)

    deferreds[0]?.resolve()
    await flushPromises()
    expect(wrapper.find(MASK_SELECTOR).exists()).toBe(true)

    deferreds[1]?.resolve()
    await flushPromises()
    expect(wrapper.find(MASK_SELECTOR).exists()).toBe(false)
  })

  it('assertAccess 抛错时记录日志并解除遮罩', async () => {
    const wrapper = mountLayout()
    await nextTick()
    expect(wrapper.find(MASK_SELECTOR).exists()).toBe(true)

    deferreds[0]?.reject(new Error('registry exploded'))
    await flushPromises()

    expect(mocks.loggerError).toHaveBeenCalled()
    expect(wrapper.find(MASK_SELECTOR).exists()).toBe(false)
  })
})
