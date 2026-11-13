import { flushPromises, mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import ThreadView from '../ThreadView.vue'

const { markThreadAsReadMock, getThreadViewDataMock, loggerErrorMock } = vi.hoisted(() => ({
  markThreadAsReadMock: vi.fn(),
  getThreadViewDataMock: vi.fn(),
  loggerErrorMock: vi.fn()
}))

vi.mock('@/services/matrix/messaging/MatrixThreadService', () => ({
  matrixThreadService: {
    getThreadViewData: (...args: unknown[]) => getThreadViewDataMock(...args),
    markThreadAsRead: (...args: unknown[]) => markThreadAsReadMock(...args),
    loadThreadRepliesPage: vi.fn().mockResolvedValue({ replies: [], total: 0 }),
    resolveMediaUrl: vi.fn(() => null),
    sendThreadReply: vi.fn()
  }
}))

vi.mock('@/utils/Logger', () => ({
  createLogger: () => ({
    error: loggerErrorMock,
    info: vi.fn(),
    debug: vi.fn(),
    warn: vi.fn()
  })
}))

vi.mock('vue-router', async (importOriginal) => {
  const actual = await importOriginal<typeof import('vue-router')>()
  return {
    ...actual,
    useRouter: () => ({ back: vi.fn() })
  }
})

vi.mock('vant', () => ({
  showImagePreview: vi.fn(),
  showToast: vi.fn()
}))

vi.mock('dayjs', () => ({
  default: () => ({ fromNow: () => '刚刚' })
}))

const stubs = {
  VanNavBar: { template: '<div><slot name="right" /></div>', props: ['title', 'leftArrow'] },
  VanImage: { template: '<div class="van-image" />', props: ['src', 'round', 'width', 'height', 'fit'] },
  VanDivider: { template: '<div class="van-divider" />' },
  VanPullRefresh: { template: '<div><slot /></div>', props: ['modelValue'] },
  VanList: { template: '<div><slot /></div>', props: ['modelValue', 'loading', 'finished', 'finishedText'] },
  VanEmpty: { template: '<div class="van-empty" />', props: ['description'] },
  VanIcon: { template: '<i />', props: ['name', 'size'] },
  VanField: { template: '<textarea />', props: ['modelValue', 'placeholder', 'type', 'autosize', 'rows'] },
  VanButton: { template: '<button><slot /></button>', props: ['type', 'size', 'loading', 'disabled'] }
}

const mountThreadView = () =>
  mount(ThreadView, {
    props: { roomId: '!room:hs', threadRootId: '$root' },
    global: { stubs }
  })

describe('Mobile ThreadView thread read receipt', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    getThreadViewDataMock.mockReturnValue({
      thread: { replyCount: 2 },
      rootMessage: {
        eventId: '$root',
        senderName: 'Alice',
        content: 'root body',
        timestamp: Date.now(),
        msgType: 'm.text'
      }
    })
    markThreadAsReadMock.mockResolvedValue(undefined)
  })

  it('进入线程时上报线程已读', async () => {
    const wrapper = mountThreadView()
    await flushPromises()

    expect(markThreadAsReadMock).toHaveBeenCalledWith('!room:hs', '$root')
    expect(markThreadAsReadMock).toHaveBeenCalledTimes(1)
    expect(wrapper.text()).toContain('root body')
    wrapper.unmount()
  })

  it('已读上报失败只记录日志，不阻断线程渲染', async () => {
    markThreadAsReadMock.mockRejectedValue(new Error('network down'))

    const wrapper = mountThreadView()
    await flushPromises()

    expect(loggerErrorMock).toHaveBeenCalledWith('[MobileThreadView] Failed to mark thread as read:', expect.any(Error))
    expect(wrapper.text()).toContain('root body')
    wrapper.unmount()
  })

  it('线程 ID 变化时重新上报已读', async () => {
    const wrapper = mountThreadView()
    await flushPromises()

    await wrapper.setProps({ threadRootId: '$root2' })
    await flushPromises()

    expect(markThreadAsReadMock).toHaveBeenLastCalledWith('!room:hs', '$root2')
    expect(markThreadAsReadMock).toHaveBeenCalledTimes(2)
    wrapper.unmount()
  })
})
