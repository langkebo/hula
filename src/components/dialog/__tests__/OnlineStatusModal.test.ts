import { flushPromises, mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { reactive, ref, toRefs } from 'vue'
import OnlineStatusModal from '../OnlineStatusModal.vue'

const { showFeedbackMock, changeCurrentUserStateMock } = vi.hoisted(() => ({
  showFeedbackMock: vi.fn(),
  changeCurrentUserStateMock: vi.fn()
}))

let userStatusStore: ReturnType<
  typeof reactive<{
    stateList: Array<{ id: string; title: string; url: string }>
    changeCurrentUserState: typeof changeCurrentUserStateMock
  }>
>

vi.mock('pinia', () => ({
  storeToRefs: <T extends object>(store: T) => toRefs(store)
}))

vi.mock('vue-i18n', () => ({
  useI18n: () => ({
    t: (key: string) => key
  })
}))

vi.mock('@/composables/common/useActionFeedback', () => ({
  useActionFeedback: () => ({
    showFeedback: showFeedbackMock
  })
}))

vi.mock('@/hooks/useOnlineStatus', () => ({
  useOnlineStatus: () => ({
    currentState: ref(null),
    statusIcon: ref(''),
    statusTitle: ref('busy'),
    statusBgColor: ref('#fff'),
    hasCustomState: ref(false)
  })
}))

vi.mock('@/stores/domains/user/userStatus', () => ({
  useUserStatusStore: () => userStatusStore
}))

const mountComponent = () =>
  mount(OnlineStatusModal, {
    props: {
      show: true
    },
    global: {
      stubs: {
        'n-modal': {
          template: '<div><slot /></div>'
        },
        'n-flex': {
          template: '<div><slot /></div>'
        },
        'n-scrollbar': {
          template: '<div><slot /></div>'
        }
      }
    }
  })

describe('OnlineStatusModal', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    userStatusStore = reactive({
      stateList: [{ id: '1', title: 'busy', url: '/busy.png' }],
      changeCurrentUserState: changeCurrentUserStateMock
    })
    changeCurrentUserStateMock.mockResolvedValue(undefined)
  })

  it('uses action feedback for online status change success and failure', async () => {
    const wrapper = mountComponent()

    await (
      wrapper.vm as unknown as {
        handleActive: (item: { id: string; title: string; url: string }) => Promise<void>
      }
    ).handleActive({
      id: '1',
      title: 'busy',
      url: '/busy.png'
    })
    await flushPromises()

    expect(showFeedbackMock).toHaveBeenCalledWith('auth.onlineStatus.messages.success', 'success')
    expect(wrapper.emitted('update:show')).toEqual([[false]])

    changeCurrentUserStateMock.mockRejectedValueOnce(new Error('failed'))
    await (
      wrapper.vm as unknown as {
        handleActive: (item: { id: string; title: string; url: string }) => Promise<void>
      }
    ).handleActive({
      id: '1',
      title: 'busy',
      url: '/busy.png'
    })
    await flushPromises()

    expect(showFeedbackMock).toHaveBeenCalledWith('auth.onlineStatus.messages.error', 'error')
  })
})
