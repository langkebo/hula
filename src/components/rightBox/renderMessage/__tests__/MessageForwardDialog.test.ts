import { flushPromises, mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ref } from 'vue'
import MessageForwardDialog from '../MessageForwardDialog.vue'

const { showFeedbackMock, forwardMock, searchRoomsMock } = vi.hoisted(() => ({
  showFeedbackMock: vi.fn(),
  forwardMock: vi
    .fn<(...args: unknown[]) => Promise<unknown[]>>()
    .mockResolvedValue([{ roomId: '!room-2:server', success: true, eventId: '$new:server' }]),
  searchRoomsMock: vi.fn().mockResolvedValue([
    {
      roomId: '!room-2:server',
      roomName: 'General',
      avatarUrl: undefined,
      memberCount: 5,
      isJoined: true,
      isDirect: false
    },
    {
      roomId: '!room-3:server',
      roomName: 'Random',
      avatarUrl: undefined,
      memberCount: 2,
      isJoined: true,
      isDirect: true
    }
  ])
}))

vi.mock('vue-i18n', () => ({
  useI18n: () => ({
    t: (key: string, params?: Record<string, unknown>) => (params ? `${key}:${JSON.stringify(params)}` : key)
  })
}))

vi.mock('@/composables/common/useActionFeedback', () => ({
  useActionFeedback: () => ({ showFeedback: showFeedbackMock })
}))

vi.mock('@/stores/domains/chat/chat', () => ({
  useChatStore: () => ({
    customForwardTask: ref(null),
    setCustomForwardTask: vi.fn()
  })
}))

vi.mock('@/services/matrix/messaging/MatrixForwardService', () => ({
  matrixForwardService: {
    forwardRoomMessages: forwardMock
  }
}))

vi.mock('@/services/matrix/MatrixSearchService', () => ({
  matrixSearchService: {
    searchRooms: searchRoomsMock
  }
}))

describe('MessageForwardDialog', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    forwardMock.mockResolvedValue([{ roomId: '!room-2:server', success: true, eventId: '$new:server' }])
  })

  it('does not render when visible=false', () => {
    const wrapper = mount(MessageForwardDialog, {
      props: {
        visible: false,
        sourceRoomId: '!room-1:server',
        eventIds: ['$event-1:server']
      }
    })
    expect(wrapper.find('[data-test="forward-dialog"]').exists()).toBe(false)
  })

  it('renders dialog when visible=true', () => {
    const wrapper = mount(MessageForwardDialog, {
      props: {
        visible: true,
        sourceRoomId: '!room-1:server',
        eventIds: ['$event-1:server']
      }
    })
    expect(wrapper.find('[data-test="forward-dialog"]').exists()).toBe(true)
    expect(wrapper.find('[data-test="forward-search"]').exists()).toBe(true)
    expect(wrapper.find('[data-test="forward-submit"]').exists()).toBe(true)
  })

  it('shows selected count badge', async () => {
    const wrapper = mount(MessageForwardDialog, {
      props: {
        visible: true,
        sourceRoomId: '!room-1:server',
        eventIds: ['$event-1:server']
      }
    })
    const vm = wrapper.vm as unknown as { selectedTargets: string[] }
    vm.selectedTargets = ['!room-2:server', '!room-3:server']
    await wrapper.vm.$nextTick()
    expect(wrapper.find('[data-test="forward-count"]').text()).toContain('2')
  })

  it('disables submit button when no targets selected', () => {
    const wrapper = mount(MessageForwardDialog, {
      props: {
        visible: true,
        sourceRoomId: '!room-1:server',
        eventIds: ['$event-1:server']
      }
    })
    const submitBtn = wrapper.find('[data-test="forward-submit"]')
    expect(submitBtn.attributes('disabled')).toBeDefined()
  })

  it('calls matrixForwardService on submit and emits success', async () => {
    const wrapper = mount(MessageForwardDialog, {
      props: {
        visible: true,
        sourceRoomId: '!room-1:server',
        eventIds: ['$event-1:server']
      }
    })
    const vm = wrapper.vm as unknown as {
      selectedTargets: string[]
      handleSubmit: () => Promise<void>
    }
    vm.selectedTargets = ['!room-2:server']
    await wrapper.vm.$nextTick()

    await vm.handleSubmit()
    await flushPromises()

    expect(forwardMock).toHaveBeenCalledWith('!room-1:server', ['$event-1:server'], ['!room-2:server'])
    expect(showFeedbackMock).toHaveBeenCalledWith('message.forward_success', 'success')
    expect(wrapper.emitted('success')).toBeTruthy()
    expect(wrapper.emitted('update:visible')![0]).toEqual([false])
  })

  it('shows error feedback when forward fails', async () => {
    forwardMock.mockResolvedValueOnce([{ roomId: '!room-2:server', success: false, error: 'Permission denied' }])
    const wrapper = mount(MessageForwardDialog, {
      props: {
        visible: true,
        sourceRoomId: '!room-1:server',
        eventIds: ['$event-1:server']
      }
    })
    const vm = wrapper.vm as unknown as {
      selectedTargets: string[]
      handleSubmit: () => Promise<void>
    }
    vm.selectedTargets = ['!room-2:server']
    await wrapper.vm.$nextTick()

    await vm.handleSubmit()
    await flushPromises()

    expect(showFeedbackMock).toHaveBeenCalledWith('message.forward_failed', 'error')
  })

  it('shows warning feedback when partial targets fail and emits success', async () => {
    // 2 个目标：1 个成功，1 个失败
    forwardMock.mockResolvedValueOnce([
      { roomId: '!room-2:server', success: true, eventId: '$new:server' },
      { roomId: '!room-3:server', success: false, error: 'Permission denied' }
    ])
    const wrapper = mount(MessageForwardDialog, {
      props: {
        visible: true,
        sourceRoomId: '!room-1:server',
        eventIds: ['$event-1:server']
      }
    })
    const vm = wrapper.vm as unknown as {
      selectedTargets: string[]
      handleSubmit: () => Promise<void>
    }
    vm.selectedTargets = ['!room-2:server', '!room-3:server']
    await wrapper.vm.$nextTick()

    await vm.handleSubmit()
    await flushPromises()

    expect(showFeedbackMock).toHaveBeenCalledWith('message.forward_partial_failed:{"failed":1,"total":2}', 'warning')
    // 部分成功仍触发 success（已成功的部分保留）
    expect(wrapper.emitted('success')).toBeTruthy()
    expect(wrapper.emitted('update:visible')![0]).toEqual([false])
  })

  it('emits update:visible=false when clicking cancel', async () => {
    const wrapper = mount(MessageForwardDialog, {
      props: {
        visible: true,
        sourceRoomId: '!room-1:server',
        eventIds: ['$event-1:server']
      }
    })
    await wrapper.find('[data-test="forward-cancel"]').trigger('click')
    expect(wrapper.emitted('update:visible')![0]).toEqual([false])
  })

  it('clears selected targets when dialog closes', async () => {
    const wrapper = mount(MessageForwardDialog, {
      props: {
        visible: true,
        sourceRoomId: '!room-1:server',
        eventIds: ['$event-1:server']
      }
    })
    const vm = wrapper.vm as unknown as { selectedTargets: string[] }
    vm.selectedTargets = ['!room-2:server']
    await wrapper.vm.$nextTick()

    await wrapper.setProps({ visible: false })
    await wrapper.vm.$nextTick()

    expect(vm.selectedTargets).toEqual([])
  })

  it('searches targets by keyword', async () => {
    const wrapper = mount(MessageForwardDialog, {
      props: {
        visible: true,
        sourceRoomId: '!room-1:server',
        eventIds: ['$event-1:server']
      }
    })
    const vm = wrapper.vm as unknown as {
      searchKeyword: string
      handleSearch: () => Promise<void>
      searchResults: { id: string; name: string; type: string }[]
    }
    vm.searchKeyword = 'gen'
    await vm.handleSearch()
    await flushPromises()

    expect(searchRoomsMock).toHaveBeenCalledWith('gen')
    expect(vm.searchResults.length).toBeGreaterThan(0)
  })

  it('toggles target selection on click', async () => {
    const wrapper = mount(MessageForwardDialog, {
      props: {
        visible: true,
        sourceRoomId: '!room-1:server',
        eventIds: ['$event-1:server']
      }
    })
    const vm = wrapper.vm as unknown as {
      selectedTargets: string[]
      toggleTarget: (id: string) => void
    }
    vm.toggleTarget('!room-2:server')
    expect(vm.selectedTargets).toContain('!room-2:server')
    vm.toggleTarget('!room-2:server')
    expect(vm.selectedTargets).not.toContain('!room-2:server')
  })
})
