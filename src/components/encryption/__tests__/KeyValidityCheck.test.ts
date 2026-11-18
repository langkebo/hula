import { flushPromises, mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'

/**
 * `KeyValidityCheck` 的判据（ROOM-06 收口时补，见前端遗留问题方案附录 C）。
 *
 * 该组件是「按密钥 ID 向服务端校验是否需要轮换」的唯一入口：它把
 * `useEncryption().checkKeyValidity(id)` 的三种结果分成三条互斥分支 ——
 * 空输入拦截、返回 null（服务端未响应）、正常结果（需轮换 / 正常）。
 * 三种分支的反馈文案与结果卡展示都不同，任何一条走错，用户都会得到错误结论。
 */
const { showFeedbackMock, checkKeyValidityMock } = vi.hoisted(() => ({
  showFeedbackMock: vi.fn(),
  checkKeyValidityMock: vi.fn()
}))

vi.mock('vue-i18n', () => ({ useI18n: () => ({ t: (key: string) => key }) }))

vi.mock('@/composables/common/useActionFeedback', () => ({
  useActionFeedback: () => ({ showFeedback: showFeedbackMock })
}))

vi.mock('@/composables/encryption', async () => {
  const { ref } = await import('vue')
  return {
    useEncryption: () => ({
      checkKeyValidity: checkKeyValidityMock,
      keyRotationStatus: ref(null)
    })
  }
})

vi.mock('@iconify/vue', () => ({ Icon: { template: '<i />' } }))

vi.mock('naive-ui', async () => {
  const { defineComponent, h } = await import('vue')
  return {
    NInput: defineComponent({
      name: 'NInput',
      props: ['value', 'placeholder'],
      emits: ['update:value'],
      setup(props, { emit }) {
        return () =>
          h('input', {
            'data-testid': 'n-input',
            value: props.value,
            onInput: (e: Event) => emit('update:value', (e.target as HTMLInputElement).value)
          })
      }
    }),
    NButton: defineComponent({
      name: 'NButton',
      props: ['loading'],
      setup(_, { slots }) {
        return () => h('button', { 'data-testid': 'n-button' }, slots.default?.())
      }
    }),
    NAlert: defineComponent({
      name: 'NAlert',
      props: ['type', 'title'],
      setup(props, { slots }) {
        return () =>
          h('div', { 'data-testid': 'n-alert', 'data-type': props.type, 'data-title': props.title }, slots.default?.())
      }
    })
  }
})

import KeyValidityCheck from '../KeyValidityCheck.vue'

const mountComponent = (props: Record<string, unknown> = {}) => mount(KeyValidityCheck, { props })

describe('KeyValidityCheck', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('keyId 为空时拦截并提示，不调用服务', async () => {
    const wrapper = mountComponent()

    await wrapper.find('[data-testid="key-rotation-validate"]').trigger('click')
    await flushPromises()

    expect(checkKeyValidityMock).not.toHaveBeenCalled()
    expect(showFeedbackMock).toHaveBeenCalledWith('encryption.key_rotation.validate_key_id_required', 'warning')
    expect(wrapper.find('[data-testid="key-rotation-validate-result"]').exists()).toBe(false)
  })

  it('服务端返回 null 时给出失败反馈，且不渲染结果卡', async () => {
    checkKeyValidityMock.mockResolvedValue(null)
    const wrapper = mountComponent({ defaultKeyId: 'key-1' })

    await wrapper.find('[data-testid="key-rotation-validate"]').trigger('click')
    await flushPromises()

    expect(checkKeyValidityMock).toHaveBeenCalledWith('key-1')
    expect(showFeedbackMock).toHaveBeenCalledWith('encryption.key_rotation.validate_failed', 'error')
    expect(wrapper.find('[data-testid="key-rotation-validate-result"]').exists()).toBe(false)
  })

  it('需要轮换时用 warning 结果卡', async () => {
    checkKeyValidityMock.mockResolvedValue({
      keyId: 'key-1',
      needsRotation: true,
      lastRotation: 1700000000000,
      intervalMs: 7 * 24 * 60 * 60 * 1000
    })
    const wrapper = mountComponent({ defaultKeyId: 'key-1' })

    await wrapper.find('[data-testid="key-rotation-validate"]').trigger('click')
    await flushPromises()

    const alert = wrapper.find('[data-testid="key-rotation-validate-result"]')
    expect(alert.exists()).toBe(true)
    expect(alert.attributes('data-type')).toBe('warning')
    expect(alert.text()).toContain('7')
    expect(showFeedbackMock).toHaveBeenCalledWith('encryption.key_rotation.validate_result_needs_rotation', 'warning')
  })

  it('无需轮换时用 success 结果卡', async () => {
    checkKeyValidityMock.mockResolvedValue({
      keyId: 'key-1',
      needsRotation: false,
      lastRotation: null,
      intervalMs: 0
    })
    const wrapper = mountComponent({ defaultKeyId: 'key-1' })

    await wrapper.find('[data-testid="key-rotation-validate"]').trigger('click')
    await flushPromises()

    const alert = wrapper.find('[data-testid="key-rotation-validate-result"]')
    expect(alert.attributes('data-type')).toBe('success')
    // intervalMs=0 时不渲染间隔行
    expect(alert.text()).not.toContain('common.days')
    expect(showFeedbackMock).toHaveBeenCalledWith('encryption.key_rotation.validate_result_ok', 'success')
  })

  it('服务抛错时提示失败而不是崩溃', async () => {
    checkKeyValidityMock.mockRejectedValue(new Error('boom'))
    const wrapper = mountComponent({ defaultKeyId: 'key-1' })

    await wrapper.find('[data-testid="key-rotation-validate"]').trigger('click')
    await flushPromises()

    expect(showFeedbackMock).toHaveBeenCalledWith('encryption.key_rotation.validate_failed', 'error')
    expect(wrapper.find('[data-testid="key-rotation-validate-result"]').exists()).toBe(false)
  })
})
