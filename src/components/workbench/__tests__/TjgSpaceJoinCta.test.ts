import { mount } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import TjgSpaceJoinCta from '../TjgSpaceJoinCta.vue'

type TjgSpaceJoinCtaVm = {
  handleJoin: () => Promise<void>
  handleLeave: () => Promise<void>
}

const { showFeedbackMock, joinMock, knockMock, leaveMock } = vi.hoisted(() => ({
  showFeedbackMock: vi.fn(),
  joinMock: vi.fn(),
  knockMock: vi.fn(),
  leaveMock: vi.fn()
}))

vi.mock('vue-i18n', () => ({
  useI18n: () => ({
    t: (key: string) => key
  })
}))

vi.mock('naive-ui', async () => {
  const { defineComponent } = await import('vue')

  return {
    NButton: defineComponent({
      name: 'NButton',
      template: '<button type="button"><slot /><slot name="icon" /></button>'
    }),
    NFlex: defineComponent({
      name: 'NFlex',
      template: '<div><slot /></div>'
    })
  }
})

vi.mock('@/composables/common/useActionFeedback', () => ({
  useActionFeedback: () => ({
    showFeedback: showFeedbackMock
  })
}))

vi.mock('@/composables/space', () => ({
  useSpace: () => ({
    join: joinMock,
    knock: knockMock,
    leave: leaveMock
  })
}))

describe('TjgSpaceJoinCta', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.runOnlyPendingTimers()
    vi.useRealTimers()
  })

  it('加入空间成功后播报 success 并抛出 success 事件', async () => {
    joinMock.mockResolvedValue(undefined)

    const wrapper = mount(TjgSpaceJoinCta, {
      props: {
        spaceId: '!space:example.com',
        joinRule: 'public',
        membership: 'leave'
      }
    })

    await (wrapper.vm as unknown as TjgSpaceJoinCtaVm).handleJoin()

    expect(joinMock).toHaveBeenCalled()
    expect(showFeedbackMock).toHaveBeenCalledWith('space.join_success', 'success')
    expect(wrapper.emitted('success')).toEqual([['join']])
  })

  it('knock 空间应提交申请而非直接加入', async () => {
    knockMock.mockResolvedValue(undefined)

    const wrapper = mount(TjgSpaceJoinCta, {
      props: {
        spaceId: '!space:example.com',
        joinRule: 'knock',
        membership: 'leave'
      }
    })

    await (wrapper.vm as unknown as TjgSpaceJoinCtaVm).handleJoin()

    expect(knockMock).toHaveBeenCalled()
    expect(joinMock).not.toHaveBeenCalled()
    expect(showFeedbackMock).toHaveBeenCalledWith('space.knock_success', 'success')
    expect(wrapper.emitted('success')).toEqual([['knock']])
  })

  it('离开空间失败时播报 error 且不抛出 success 事件', async () => {
    leaveMock.mockRejectedValue(new Error('leave failed'))

    const wrapper = mount(TjgSpaceJoinCta, {
      props: {
        spaceId: '!space:example.com',
        membership: 'join'
      }
    })

    await (wrapper.vm as unknown as TjgSpaceJoinCtaVm).handleLeave()

    expect(leaveMock).toHaveBeenCalled()
    expect(showFeedbackMock).toHaveBeenCalledWith('space.leave_failed', 'error')
    expect(wrapper.emitted('success')).toBeUndefined()
  })
})
