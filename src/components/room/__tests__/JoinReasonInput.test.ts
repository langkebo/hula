import { mount } from '@vue/test-utils'
import { describe, expect, it, vi } from 'vitest'
import JoinReasonInput from '../JoinReasonInput.vue'

vi.mock('vue-i18n', () => ({
  useI18n: () => ({ t: (key: string) => key })
}))

vi.mock('naive-ui', async () => {
  const { defineComponent, h } = await import('vue')
  const NInput = defineComponent({
    name: 'NInput',
    inheritAttrs: false,
    props: {
      value: { type: String, default: '' },
      type: { type: String, default: 'text' },
      placeholder: { type: String, default: '' },
      disabled: { type: Boolean, default: false },
      maxlength: { type: [Number, String], default: undefined },
      autosize: { type: [Boolean, Object], default: false }
    },
    emits: ['update:value'],
    setup(props, { emit, attrs }) {
      return () =>
        h('textarea', {
          value: props.value,
          placeholder: props.placeholder,
          disabled: props.disabled,
          ...attrs,
          onInput: (event: Event) => emit('update:value', (event.target as HTMLTextAreaElement).value)
        })
    }
  })
  return { NInput }
})

const mountInput = (props: Partial<{ modelValue: string; disabled: boolean }> = {}) =>
  mount(JoinReasonInput, {
    props: { modelValue: '', ...props }
  })

describe('JoinReasonInput', () => {
  it('renders a textarea bound to modelValue', () => {
    const wrapper = mountInput({ modelValue: 'hello' })
    const textarea = wrapper.find('[data-testid="join-reason-textarea"]')
    expect(textarea.exists()).toBe(true)
    expect((textarea.element as HTMLTextAreaElement).value).toBe('hello')
  })

  it('emits update:modelValue when typing', async () => {
    const wrapper = mountInput()
    await wrapper.find('[data-testid="join-reason-textarea"]').setValue('reason text')
    expect(wrapper.emitted('update:modelValue')).toEqual([['reason text']])
  })

  it('disables textarea when disabled prop is true', () => {
    const wrapper = mountInput({ modelValue: 'reason', disabled: true })
    expect(wrapper.find('[data-testid="join-reason-textarea"]').attributes('disabled')).toBeDefined()
  })

  it('renders no inline submit button (submission is owned by the dialog footer)', () => {
    const wrapper = mountInput({ modelValue: 'reason' })
    expect(wrapper.find('[data-testid="join-reason-submit"]').exists()).toBe(false)
  })
})
