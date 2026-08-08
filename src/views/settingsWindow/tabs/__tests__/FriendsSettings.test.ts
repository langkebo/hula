import { flushPromises, mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { nextTick } from 'vue'

const { waitForClientReadyMock, getFriendGroupsMock, getIncomingRequestsMock, getOutgoingRequestsMock } = vi.hoisted(
  () => ({
    waitForClientReadyMock: vi.fn(),
    getFriendGroupsMock: vi.fn().mockResolvedValue([]),
    getIncomingRequestsMock: vi.fn().mockResolvedValue([]),
    getOutgoingRequestsMock: vi.fn().mockResolvedValue([])
  })
)

let resolveReady: () => void
let readyPromise: Promise<void>

vi.mock('@/services/matrix/MatrixClientService', () => ({
  matrixClientService: { waitForClientReady: (...args: unknown[]) => waitForClientReadyMock(...args) },
  default: { waitForClientReady: (...args: unknown[]) => waitForClientReadyMock(...args) }
}))

vi.mock('@/services/matrix/friends/MatrixFriendService', () => ({
  matrixFriendService: {
    getFriendGroups: (...args: unknown[]) => getFriendGroupsMock(...args),
    getIncomingRequests: (...args: unknown[]) => getIncomingRequestsMock(...args),
    getOutgoingRequests: (...args: unknown[]) => getOutgoingRequestsMock(...args)
  }
}))

vi.mock('@/composables/common/useActionFeedback', () => ({
  useActionFeedback: () => ({ showFeedback: vi.fn() })
}))

vi.mock('naive-ui', () => ({
  NButton: { name: 'NButton', template: '<button><slot /></button>' },
  NDivider: { name: 'NDivider', template: '<hr />' },
  NForm: { name: 'NForm', template: '<form><slot /></form>' },
  NFormItem: { name: 'NFormItem', template: '<div><slot /></div>' },
  NInput: { name: 'NInput', template: '<input />' },
  NModal: { name: 'NModal', template: '<div><slot /></div>' },
  NSpin: { name: 'NSpin', template: '<div><slot /></div>' },
  NSwitch: { name: 'NSwitch', template: '<div />' },
  useDialog: () => ({ warning: vi.fn() })
}))

vi.mock('@iconify/vue', () => ({
  Icon: { name: 'Icon', template: '<i />' }
}))

import FriendsSettings from '../FriendsSettings.vue'

describe('FriendsSettings — P0-#3 客户端就绪竞态', () => {
  beforeEach(() => {
    getFriendGroupsMock.mockClear()
    getIncomingRequestsMock.mockClear()
    getOutgoingRequestsMock.mockClear()
    waitForClientReadyMock.mockClear()

    readyPromise = new Promise<void>((resolve) => {
      resolveReady = resolve
    })
    waitForClientReadyMock.mockReturnValue(readyPromise)
  })

  it('onMounted 应先 await 客户端就绪，再拉取好友分组', async () => {
    const wrapper = mount(FriendsSettings)

    // 就绪前不应抢跑发请求
    expect(waitForClientReadyMock).toHaveBeenCalledTimes(1)
    expect(getFriendGroupsMock).not.toHaveBeenCalled()
    expect(getIncomingRequestsMock).not.toHaveBeenCalled()

    // 客户端就绪后，拉取才真正发生
    resolveReady()
    await flushPromises()
    await nextTick()

    expect(getFriendGroupsMock).toHaveBeenCalledTimes(1)
    expect(getIncomingRequestsMock).toHaveBeenCalledTimes(1)

    wrapper.unmount()
  })

  it('客户端超时未就绪时不应让 onMounted 抛出未捕获错误', async () => {
    waitForClientReadyMock.mockRejectedValueOnce(new Error('not ready'))

    const wrapper = mount(FriendsSettings)
    await flushPromises()
    await nextTick()

    expect(wrapper.exists()).toBe(true)
    wrapper.unmount()
  })
})
