import { mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import EventSignaturePanel from '../EventSignaturePanel.vue'

vi.mock('vue-i18n', () => ({
  useI18n: () => ({ t: (key: string) => key })
}))

const signEventMock = vi.fn()
const verifyEventMock = vi.fn()

vi.mock('@/services/matrix/room/AccountDataService', () => ({
  matrixRoomAccountDataService: {
    signEvent: (...args: unknown[]) => signEventMock(...args),
    verifyEvent: (...args: unknown[]) => verifyEventMock(...args)
  }
}))

const showFeedbackMock = vi.fn()
vi.mock('@/composables/common/useActionFeedback', () => ({
  useActionFeedback: () => ({ showFeedback: (...args: unknown[]) => showFeedbackMock(...args) })
}))

const naiveStubs = {
  Card: {
    template:
      '<div class="n-card"><div class="n-card-header"><slot name="header" /></div><div class="n-card-body"><slot /></div></div>',
    props: ['size', 'bordered']
  },
  Button: {
    template: '<button class="n-button" :disabled="disabled" @click="$emit(\'click\')"><slot /></button>',
    props: ['disabled', 'loading', 'type', 'size', 'block', 'secondary'],
    emits: ['click']
  },
  Input: {
    template:
      '<input class="n-input" :value="value" :placeholder="placeholder" @input="$emit(\'update:value\', $event.target.value)" />',
    props: ['value', 'type', 'placeholder', 'rows', 'disabled'],
    emits: ['update:value']
  },
  Tag: { template: '<span class="n-tag"><slot /></span>', props: ['type', 'size', 'round'] }
}

describe('EventSignaturePanel — P2-8 事件签名与验证面板', () => {
  beforeEach(() => {
    signEventMock.mockReset()
    verifyEventMock.mockReset()
    showFeedbackMock.mockReset()
  })

  const mountPanel = () => {
    return mount(EventSignaturePanel, {
      props: { roomId: '!room:hs' },
      global: { stubs: naiveStubs }
    })
  }

  it('渲染事件 ID 输入框和签名/验证按钮', () => {
    const wrapper = mountPanel()
    expect(wrapper.find('[data-testid="event-id-input"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="sign-btn"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="verify-btn"]').exists()).toBe(true)
  })

  it('事件 ID 为空时禁用签名和验证按钮', () => {
    const wrapper = mountPanel()
    expect(wrapper.find('[data-testid="sign-btn"]').attributes('disabled')).toBeDefined()
    expect(wrapper.find('[data-testid="verify-btn"]').attributes('disabled')).toBeDefined()
  })

  it('点击签名按钮调用 signEvent 并显示成功反馈', async () => {
    signEventMock.mockResolvedValue({ signature: 'sig123' })
    const wrapper = mountPanel()
    await wrapper.find('[data-testid="event-id-input"]').setValue('$e1:hs')
    await wrapper.find('[data-testid="sign-btn"]').trigger('click')
    await Promise.resolve()
    await wrapper.vm.$nextTick()

    expect(signEventMock).toHaveBeenCalledWith('!room:hs', '$e1:hs')
    expect(showFeedbackMock).toHaveBeenCalledWith('room.event_signature.sign_success', 'success')
  })

  it('点击验证按钮调用 verifyEvent 并显示结果', async () => {
    verifyEventMock.mockResolvedValue({ valid: true })
    const wrapper = mountPanel()
    await wrapper.find('[data-testid="event-id-input"]').setValue('$e1:hs')
    await wrapper.find('[data-testid="verify-btn"]').trigger('click')
    await Promise.resolve()
    await wrapper.vm.$nextTick()

    expect(verifyEventMock).toHaveBeenCalledWith('!room:hs', '$e1:hs')
    expect(wrapper.text()).toContain('room.event_signature.valid')
  })

  it('签名失败时显示错误反馈', async () => {
    signEventMock.mockRejectedValue(new Error('network'))
    const wrapper = mountPanel()
    await wrapper.find('[data-testid="event-id-input"]').setValue('$e1:hs')
    await wrapper.find('[data-testid="sign-btn"]').trigger('click')
    await Promise.resolve()
    await wrapper.vm.$nextTick()
    await wrapper.vm.$nextTick()

    expect(showFeedbackMock).toHaveBeenCalledWith('room.event_signature.sign_failed', 'error')
  })
})
