import { flushPromises, mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import OneTimeInviteDialog from '../OneTimeInviteDialog.vue'

const { claimMock, showFeedbackMock } = vi.hoisted(() => ({
  claimMock: vi.fn(),
  showFeedbackMock: vi.fn()
}))

vi.mock('vue-i18n', () => ({
  useI18n: () => ({
    t: (key: string, params?: Record<string, unknown>) => (params ? `${key}:${JSON.stringify(params)}` : key)
  })
}))

vi.mock('@/composables/common/useActionFeedback', () => ({
  useActionFeedback: () => ({ showFeedback: showFeedbackMock })
}))

vi.mock('@/services/matrix/extensions/SynapseOneTimeInviteExtensionService', () => ({
  synapseOneTimeInviteService: {
    create: vi.fn(),
    claim: claimMock
  }
}))

describe('OneTimeInviteDialog', () => {
  beforeEach(() => {
    claimMock.mockReset()
    showFeedbackMock.mockReset()
  })

  it('领取成功后展示房间别名，确认后才跳转会话', async () => {
    claimMock.mockResolvedValue({ room_id: '!room:example.com', room_alias: '#abc:example.com' })
    const wrapper = mount(OneTimeInviteDialog, {
      props: { show: true },
      global: { stubs: { teleport: true } }
    })

    await wrapper.find('[data-test="ot-invite-claim-input"] input').setValue('a'.repeat(32))
    await wrapper.find('[data-test="ot-invite-claim"]').trigger('click')
    await flushPromises()

    const aliasInput = wrapper.find('[data-test="ot-invite-alias"] input')
    expect((aliasInput.element as HTMLInputElement).value).toBe('#abc:example.com')
    expect(wrapper.emitted('claimed')).toBeUndefined()

    await wrapper.find('[data-test="ot-invite-enter"]').trigger('click')

    expect(wrapper.emitted('claimed')?.[0]).toEqual(['!room:example.com'])
    expect(wrapper.emitted('update:show')?.[0]).toEqual([false])
    wrapper.unmount()
  })

  it('没有别名时仍可直接进入会话', async () => {
    claimMock.mockResolvedValue({ room_id: '!room:example.com', room_alias: null })
    const wrapper = mount(OneTimeInviteDialog, {
      props: { show: true },
      global: { stubs: { teleport: true } }
    })

    await wrapper.find('[data-test="ot-invite-claim-input"] input').setValue('a'.repeat(32))
    await wrapper.find('[data-test="ot-invite-claim"]').trigger('click')
    await flushPromises()

    expect(wrapper.find('[data-test="ot-invite-alias"]').exists()).toBe(false)
    await wrapper.find('[data-test="ot-invite-enter"]').trigger('click')

    expect(wrapper.emitted('claimed')?.[0]).toEqual(['!room:example.com'])
    wrapper.unmount()
  })
})
