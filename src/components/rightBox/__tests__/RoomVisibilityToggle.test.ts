import { flushPromises, mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import RoomVisibilityToggle from '../RoomVisibilityToggle.vue'

const { showFeedbackMock, setVisibilityMock, getVisibilityMock } = vi.hoisted(() => ({
  showFeedbackMock: vi.fn(),
  setVisibilityMock: vi.fn(async () => true),
  getVisibilityMock: vi.fn(async () => 'private' as 'public' | 'private')
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

vi.mock('@/stores/domains/chat/group', () => ({
  useGroupStore: () => ({
    setVisibility: setVisibilityMock,
    getVisibility: getVisibilityMock
  })
}))

describe('RoomVisibilityToggle', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    setVisibilityMock.mockResolvedValue(true)
    getVisibilityMock.mockResolvedValue('private')
  })

  it('loads current visibility on mount', async () => {
    mount(RoomVisibilityToggle, {
      props: { roomId: '!room-1:server' }
    })
    await flushPromises()

    expect(getVisibilityMock).toHaveBeenCalledWith('!room-1:server')
  })

  it('displays current visibility as private', async () => {
    getVisibilityMock.mockResolvedValue('private')
    const wrapper = mount(RoomVisibilityToggle, {
      props: { roomId: '!room-1:server' }
    })
    await flushPromises()

    expect(wrapper.find('[data-test="visibility-toggle"]').exists()).toBe(true)
    // 应显示"私密"状态
    expect(wrapper.text()).toContain('room.detail.visibility_private')
  })

  it('displays current visibility as public', async () => {
    getVisibilityMock.mockResolvedValue('public')
    const wrapper = mount(RoomVisibilityToggle, {
      props: { roomId: '!room-1:server' }
    })
    await flushPromises()

    expect(wrapper.text()).toContain('room.detail.visibility_public')
  })

  it('toggles visibility from private to public on click', async () => {
    getVisibilityMock.mockResolvedValue('private')
    const wrapper = mount(RoomVisibilityToggle, {
      props: { roomId: '!room-1:server' }
    })
    await flushPromises()

    await wrapper.find('[data-test="visibility-toggle"]').trigger('click')
    await flushPromises()

    expect(setVisibilityMock).toHaveBeenCalledWith('!room-1:server', 'public')
    expect(showFeedbackMock).toHaveBeenCalledWith('room.detail.visibility_updated', 'success')
  })

  it('toggles visibility from public to private on click', async () => {
    getVisibilityMock.mockResolvedValue('public')
    const wrapper = mount(RoomVisibilityToggle, {
      props: { roomId: '!room-1:server' }
    })
    await flushPromises()

    await wrapper.find('[data-test="visibility-toggle"]').trigger('click')
    await flushPromises()

    expect(setVisibilityMock).toHaveBeenCalledWith('!room-1:server', 'private')
    expect(showFeedbackMock).toHaveBeenCalledWith('room.detail.visibility_updated', 'success')
  })

  it('shows error feedback when toggle fails', async () => {
    getVisibilityMock.mockResolvedValue('private')
    setVisibilityMock.mockResolvedValueOnce(false)
    const wrapper = mount(RoomVisibilityToggle, {
      props: { roomId: '!room-1:server' }
    })
    await flushPromises()

    await wrapper.find('[data-test="visibility-toggle"]').trigger('click')
    await flushPromises()

    expect(showFeedbackMock).toHaveBeenCalledWith('room.detail.visibility_update_failed', 'error')
  })

  it('does not toggle when loading', async () => {
    getVisibilityMock.mockResolvedValue('private')
    const wrapper = mount(RoomVisibilityToggle, {
      props: { roomId: '!room-1:server' }
    })
    await flushPromises()

    const vm = wrapper.vm as unknown as { loading: boolean }
    vm.loading = true

    await wrapper.find('[data-test="visibility-toggle"]').trigger('click')
    await flushPromises()

    expect(setVisibilityMock).not.toHaveBeenCalled()
  })
})
