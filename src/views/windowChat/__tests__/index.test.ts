import { flushPromises, mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { nextTick } from 'vue'

const {
  hasAuthenticatedSessionMock,
  ensureClientReadyMock,
  waitForClientReadyMock,
  getClientMock,
  notifyUnreadUpdateMock,
  listenChatClosedMock,
  closeCurrentWindowMock,
  updateCurrentSessionRoomIdMock,
  routeState
} = vi.hoisted(() => ({
  hasAuthenticatedSessionMock: vi.fn(),
  ensureClientReadyMock: vi.fn(),
  waitForClientReadyMock: vi.fn(),
  getClientMock: vi.fn(),
  notifyUnreadUpdateMock: vi.fn().mockResolvedValue(undefined),
  listenChatClosedMock: vi.fn().mockResolvedValue(() => {}),
  closeCurrentWindowMock: vi.fn().mockResolvedValue(undefined),
  updateCurrentSessionRoomIdMock: vi.fn(),
  routeState: { params: {} as Record<string, unknown> }
}))

// 只替换 useRoute：ActionBar → @/router 会真实创建 router，
// 整体 mock vue-router 会把 createRouter 一起抹掉。
vi.mock('vue-router', async (importOriginal) => {
  const actual = await importOriginal<typeof import('vue-router')>()
  return { ...actual, useRoute: () => routeState }
})

// 真实走统一入口（useWindowSessionReady），只把底下的 SDK/会话服务换成可控假实现：
// 这样断言的是「组件 + 入口」的真实协作，而不是把入口自己也 mock 掉。
vi.mock('@/services/matrix/auth/SessionOrchestrator', () => ({
  sessionOrchestrator: {
    hasAuthenticatedSession: (...args: unknown[]) => hasAuthenticatedSessionMock(...args),
    ensureClientReady: (...args: unknown[]) => ensureClientReadyMock(...args)
  }
}))

vi.mock('@/services/matrix/MatrixClientService', () => {
  const service = {
    waitForClientReady: (...args: unknown[]) => waitForClientReadyMock(...args),
    getClient: (...args: unknown[]) => getClientMock(...args)
  }
  return { matrixClientService: service, default: service }
})

// ChatBox 自身会拉起整张聊天/好友服务图；本文件只关心「什么时候渲染它」。
vi.mock('@/components/rightBox/chatBox/index.vue', () => ({
  default: { name: 'ChatBox', template: '<div data-test="chat-box" />' }
}))

vi.mock('@/composables/chat/useIndependentChatWindow', () => ({
  useIndependentChatWindow: () => ({
    notifyUnreadUpdate: (...args: unknown[]) => notifyUnreadUpdateMock(...args),
    listenChatClosed: (...args: unknown[]) => listenChatClosedMock(...args)
  })
}))

vi.mock('@/composables/common/usePlatformClose', () => ({
  usePlatformClose: () => ({ closeCurrentWindow: () => closeCurrentWindowMock() })
}))

vi.mock('@/stores/domains/widget/global', () => ({
  useGlobalStore: () => ({ updateCurrentSessionRoomId: (roomId: string) => updateCurrentSessionRoomIdMock(roomId) })
}))

vi.mock('@/utils/Logger', () => ({
  createLogger: () => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() })
}))

import { resetWindowSessionReadyForTest } from '@/composables/common/useWindowSessionReady'
import WindowChatView from '../index.vue'

/** 让 onMounted 的 await 链推进到「已调用 ensureClientReady」的稳定点。 */
async function settle() {
  await flushPromises()
  await nextTick()
  await flushPromises()
}

function mountView() {
  return mount(WindowChatView, {
    global: {
      stubs: {
        ChatBox: { name: 'ChatBox', template: '<div data-test="chat-box" />' },
        ActionBar: { name: 'ActionBar', template: '<div />' }
      }
    }
  })
}

describe('windowChat 独立窗口 — 会话恢复（Batch 2 / 图谱 §8.5 B3）', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    resetWindowSessionReadyForTest()
    routeState.params = { roomId: '!room:test' }
    getClientMock.mockReturnValue(null)
    hasAuthenticatedSessionMock.mockResolvedValue(true)
    listenChatClosedMock.mockResolvedValue(() => {})
  })

  it('会话恢复中显示 loading，而不是直接渲染一个空聊天', async () => {
    let resolveEnsure!: () => void
    ensureClientReadyMock.mockImplementation(
      () =>
        new Promise<void>((resolve) => {
          resolveEnsure = () => {
            getClientMock.mockReturnValue({ tag: 'client' })
            resolve()
          }
        })
    )

    const wrapper = mountView()
    await settle()

    expect(wrapper.find('[data-test="window-chat-initializing"]').exists()).toBe(true)
    expect(wrapper.find('[data-test="chat-box"]').exists()).toBe(false)

    resolveEnsure()
    await settle()

    expect(wrapper.find('[data-test="window-chat-initializing"]').exists()).toBe(false)
    expect(wrapper.find('[data-test="chat-box"]').exists()).toBe(true)
    wrapper.unmount()
  })

  it('恢复成功后渲染 ChatBox，并把该房间未读清零', async () => {
    ensureClientReadyMock.mockImplementation(async () => {
      getClientMock.mockReturnValue({ tag: 'client' })
    })

    const wrapper = mountView()
    await settle()

    expect(wrapper.find('[data-test="chat-box"]').exists()).toBe(true)
    expect(ensureClientReadyMock).toHaveBeenCalledTimes(1)
    expect(notifyUnreadUpdateMock).toHaveBeenCalledWith('!room:test', 0)
    wrapper.unmount()
  })

  it('本地无会话 ⇒ 显示「未登录」空态，不渲染 ChatBox，也不清零未读', async () => {
    hasAuthenticatedSessionMock.mockResolvedValue(false)

    const wrapper = mountView()
    await settle()

    expect(wrapper.find('[data-test="window-chat-no-session"]').exists()).toBe(true)
    expect(wrapper.find('[data-test="chat-box"]').exists()).toBe(false)
    expect(ensureClientReadyMock).not.toHaveBeenCalled()
    expect(notifyUnreadUpdateMock).not.toHaveBeenCalled()
    wrapper.unmount()
  })

  it('恢复失败 ⇒ 显示失败态与原因，且提供可用的重试', async () => {
    ensureClientReadyMock.mockRejectedValueOnce(new Error('后端令牌已失效'))

    const wrapper = mountView()
    await settle()

    const errorState = wrapper.find('[data-test="window-chat-session-error"]')
    expect(errorState.exists()).toBe(true)
    expect(errorState.text()).toContain('后端令牌已失效')
    expect(wrapper.find('[data-test="chat-box"]').exists()).toBe(false)

    // 重试：第二次成功 ⇒ 切到 ChatBox（error 不落终态，重试真的再跑一次）
    ensureClientReadyMock.mockImplementation(async () => {
      getClientMock.mockReturnValue({ tag: 'client' })
    })
    await wrapper.find('[data-test="window-chat-retry"]').trigger('click')
    await settle()

    expect(ensureClientReadyMock).toHaveBeenCalledTimes(2)
    expect(wrapper.find('[data-test="chat-box"]').exists()).toBe(true)
    wrapper.unmount()
  })

  it('路由缺少 roomId ⇒ 显示「未提供会话 ID」空态（窗口被错误创建，不是会话问题）', async () => {
    routeState.params = {}

    const wrapper = mountView()
    await settle()

    expect(wrapper.find('[data-test="window-chat-no-room-id"]').exists()).toBe(true)
    expect(wrapper.find('[data-test="chat-box"]').exists()).toBe(false)
    wrapper.unmount()
  })

  it('挂载时把 roomId 写入当前会话，并注册主窗口关闭监听', async () => {
    ensureClientReadyMock.mockImplementation(async () => {
      getClientMock.mockReturnValue({ tag: 'client' })
    })

    const wrapper = mountView()
    await settle()

    expect(updateCurrentSessionRoomIdMock).toHaveBeenCalledWith('!room:test')
    expect(listenChatClosedMock).toHaveBeenCalledTimes(1)
    wrapper.unmount()
  })
})
