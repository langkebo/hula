import { mount } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import HulaSpaceJoinCta from '../HulaSpaceJoinCta.vue'

type HulaSpaceJoinCtaVm = {
  handleJoin: () => Promise<void>
  handleLeave: () => Promise<void>
}

const { showFeedbackMock, joinMock, leaveMock } = vi.hoisted(() => ({
  showFeedbackMock: vi.fn(),
  joinMock: vi.fn(),
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
    leave: leaveMock
  })
}))

describe('HulaSpaceJoinCta', () => {
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

    const wrapper = mount(HulaSpaceJoinCta, {
      props: {
        spaceId: '!space:example.com',
        joinRule: 'public',
        membership: 'leave'
      }
    })

    await (wrapper.vm as unknown as HulaSpaceJoinCtaVm).handleJoin()

    expect(joinMock).toHaveBeenCalled()
    expect(showFeedbackMock).toHaveBeenCalledWith('space.join_success', 'success')
    expect(wrapper.emitted('success')).toEqual([['join']])
  })

  it('离开空间失败时播报 error 且不抛出 success 事件', async () => {
    leaveMock.mockRejectedValue(new Error('leave failed'))

    const wrapper = mount(HulaSpaceJoinCta, {
      props: {
        spaceId: '!space:example.com',
        membership: 'join'
      }
    })

    await (wrapper.vm as unknown as HulaSpaceJoinCtaVm).handleLeave()

    expect(leaveMock).toHaveBeenCalled()
    expect(showFeedbackMock).toHaveBeenCalledWith('space.leave_failed', 'error')
    expect(wrapper.emitted('success')).toBeUndefined()
  })
})
