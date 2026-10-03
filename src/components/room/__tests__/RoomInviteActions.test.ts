import { flushPromises, mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import RoomInviteActions from '../RoomInviteActions.vue'

const { joinRoomMock, leaveRoomMock, showFeedbackMock, loggerErrorMock } = vi.hoisted(() => ({
  joinRoomMock: vi.fn(),
  leaveRoomMock: vi.fn(),
  showFeedbackMock: vi.fn(),
  loggerErrorMock: vi.fn()
}))

vi.mock('vue-i18n', () => ({
  useI18n: () => ({ t: (key: string) => key })
}))

vi.mock('@/services/matrix/room/ActionFacade', () => ({
  matrixRoomActionFacade: {
    joinRoom: joinRoomMock,
    leaveRoom: leaveRoomMock
  }
}))

vi.mock('@/composables/common/useActionFeedback', () => ({
  useActionFeedback: () => ({ showFeedback: showFeedbackMock, showError: vi.fn() })
}))

vi.mock('@/utils/Logger', () => ({
  createLogger: () => ({ error: loggerErrorMock, info: vi.fn(), warn: vi.fn(), debug: vi.fn() })
}))

vi.mock('naive-ui', async () => {
  const { defineComponent, h } = await import('vue')
  const NButton = defineComponent({
    name: 'NButton',
    props: { loading: Boolean, disabled: Boolean },
    emits: ['click'],
    setup(_, { slots, emit }) {
      return () => h('button', { type: 'button', onClick: () => emit('click') }, slots.default?.())
    }
  })
  return { NButton }
})

const mountComponent = () => mount(RoomInviteActions, { props: { roomId: '!room:server' } })

describe('RoomInviteActions 失败时就地反馈', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('接受邀请失败时给出错误反馈且不再依赖无人监听的 error 事件', async () => {
    joinRoomMock.mockRejectedValueOnce(new Error('join failed'))

    const wrapper = mountComponent()
    await wrapper.findAll('button')[0].trigger('click')
    await flushPromises()

    expect(showFeedbackMock).toHaveBeenCalledWith('room.invite.accept_failed', 'error')
    expect(loggerErrorMock).toHaveBeenCalled()
    expect(wrapper.emitted('accepted')).toBeUndefined()
    expect(wrapper.emitted('error')).toBeUndefined()
  })

  it('拒绝邀请失败时给出错误反馈', async () => {
    leaveRoomMock.mockRejectedValueOnce(new Error('leave failed'))

    const wrapper = mountComponent()
    await wrapper.findAll('button')[1].trigger('click')
    await flushPromises()

    expect(showFeedbackMock).toHaveBeenCalledWith('room.invite.reject_failed', 'error')
    expect(wrapper.emitted('rejected')).toBeUndefined()
  })

  it('接受成功时照旧发出 accepted 且不报错', async () => {
    joinRoomMock.mockResolvedValueOnce(undefined)

    const wrapper = mountComponent()
    await wrapper.findAll('button')[0].trigger('click')
    await flushPromises()

    expect(wrapper.emitted('accepted')).toEqual([['!room:server']])
    expect(showFeedbackMock).not.toHaveBeenCalled()
  })
})
