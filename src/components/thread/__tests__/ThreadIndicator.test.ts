import { mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { nextTick } from 'vue'

// MatrixThreadService extends BaseMatrixService; stub it so the service can be
// instantiated without pulling the real base class internals.
vi.mock('@/services/matrix/BaseMatrixService', () => ({
  BaseMatrixService: class {}
}))

// Make matrixClientService.getClient() return a controllable fake client so the
// real (non-mocked) matrixThreadService.getThread can run against it.
// vi.hoisted guarantees it exists before the hoisted vi.mock factory runs.
const { getClientMock } = vi.hoisted(() => ({
  getClientMock: vi.fn()
}))
vi.mock('@/services/matrix/MatrixClientService', () => ({
  default: { getClient: getClientMock },
  matrixClientService: { getClient: getClientMock }
}))

// @iconify/vue + Naive UI atoms are not available under happy-dom.
vi.mock('@iconify/vue', () => ({
  Icon: { name: 'IconStub', template: '<i class="icon-stub"></i>' }
}))

import ThreadIndicator from '@/components/thread/ThreadIndicator.vue'
import { matrixThreadService } from '@/services/matrix/messaging/MatrixThreadService'

const ROOM_ID = '!room:matrix.test'
const ROOT_ID = '$root:matrix.test'

function makeReply(id: string, sender: string, ts: number) {
  return {
    getId: () => id,
    getSender: () => sender,
    getTs: () => ts,
    getContent: () => ({
      body: 'reply',
      'm.relates_to': { rel_type: 'm.thread', event_id: ROOT_ID }
    })
  }
}

function makeFakeClient(replies: ReturnType<typeof makeReply>[]) {
  const room = {
    getUnfilteredTimelineSet: () => ({
      getLiveTimeline: () => ({ getEvents: () => replies })
    })
  }
  return {
    getRoom: (id: string) => (id === ROOM_ID ? room : null)
  }
}

describe('ThreadIndicator — P0-#1 线程回复数渲染（解构 this 丢失回归）', () => {
  beforeEach(() => {
    getClientMock.mockReset()
  })

  it('挂载时应读取真实 MatrixThreadService.getThread 并展示回复数', async () => {
    const replies = [
      makeReply('$r1', '@a:matrix.test', 100),
      makeReply('$r2', '@b:matrix.test', 200),
      makeReply('$r3', '@a:matrix.test', 300)
    ]
    getClientMock.mockReturnValue(makeFakeClient(replies))

    const spy = vi.spyOn(matrixThreadService, 'getThread')
    const wrapper = mount(ThreadIndicator, {
      props: { roomId: ROOM_ID, eventId: ROOT_ID },
      global: {
        stubs: {
          'n-icon': { name: 'NIcon', template: '<i><slot /></i>' },
          'n-button': { name: 'NButton', template: '<button><slot /></button>' }
        }
      }
    })

    await nextTick()

    // 未解构 this 时，getThread 内部 this.getThreadReplies 可正常调用，
    // replyCount 应为 3，渲染出 thread-indicator。
    expect(spy).toHaveBeenCalledTimes(1)
    expect(wrapper.find('.thread-indicator').exists()).toBe(true)
    expect(wrapper.text()).toContain('3')
    // 不应回退到「发起线程」按钮
    expect(wrapper.find('.start-thread-btn').exists()).toBe(false)

    spy.mockRestore()
  })
})
