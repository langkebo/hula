import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import InlineEdit from '../InlineEdit.vue'

vi.mock('vue-i18n', () => ({
  useI18n: () => ({
    t: (key: string) => key
  })
}))

describe('InlineEdit', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  const mountComponent = (props: Record<string, unknown> = {}) => {
    return mount(InlineEdit, {
      props: {
        label: '备注',
        value: '好友备注内容',
        ...props
      }
    })
  }

  it('renders view state with label and value', () => {
    const wrapper = mountComponent()
    expect(wrapper.find('.inline-edit__label').text()).toBe('备注')
    expect(wrapper.find('.inline-edit__value').text()).toBe('好友备注内容')
    expect(wrapper.find('.inline-edit__toggle').text()).toBe('common.edit')
  })

  it('shows placeholder style when value is empty', () => {
    const wrapper = mountComponent({ value: '', placeholder: '请输入备注' })
    expect(wrapper.find('.inline-edit__value--placeholder').exists()).toBe(true)
    expect(wrapper.find('.inline-edit__value').text()).toBe('请输入备注')
  })

  it('enters edit mode and focuses input when clicking edit button', async () => {
    const wrapper = mountComponent()
    await wrapper.find('.inline-edit__toggle').trigger('click')
    expect(wrapper.find('.inline-edit__input').exists()).toBe(true)
    expect(wrapper.find('.inline-edit__toggle').text()).toBe('common.cancel')
  })

  it('pre-fills input with current value when entering edit mode', async () => {
    const wrapper = mountComponent({ value: '原备注' })
    await wrapper.find('.inline-edit__toggle').trigger('click')
    expect((wrapper.find('.inline-edit__input').element as HTMLInputElement).value).toBe('原备注')
  })

  it('emits submit with trimmed value when clicking confirm', async () => {
    const wrapper = mountComponent({ value: '原备注' })
    await wrapper.find('.inline-edit__toggle').trigger('click')
    await wrapper.find('.inline-edit__input').setValue('  新备注  ')
    await wrapper.find('.inline-edit__confirm').trigger('click')
    expect(wrapper.emitted('submit')).toEqual([['新备注']])
  })

  it('does not emit submit when value unchanged', async () => {
    const wrapper = mountComponent({ value: '原备注' })
    await wrapper.find('.inline-edit__toggle').trigger('click')
    await wrapper.find('.inline-edit__confirm').trigger('click')
    expect(wrapper.emitted('submit')).toBeUndefined()
  })

  it('does not emit submit when value is empty after trim', async () => {
    const wrapper = mountComponent({ value: '原备注' })
    await wrapper.find('.inline-edit__toggle').trigger('click')
    await wrapper.find('.inline-edit__input').setValue('   ')
    await wrapper.find('.inline-edit__confirm').trigger('click')
    expect(wrapper.emitted('submit')).toBeUndefined()
  })

  it('cancels edit mode when clicking cancel button', async () => {
    const wrapper = mountComponent()
    await wrapper.find('.inline-edit__toggle').trigger('click')
    await wrapper.find('.inline-edit__toggle').trigger('click')
    expect(wrapper.find('.inline-edit__input').exists()).toBe(false)
    expect(wrapper.find('.inline-edit__value').exists()).toBe(true)
    expect(wrapper.emitted('cancel')).toHaveLength(1)
  })

  it('confirm button is disabled when loading', async () => {
    const wrapper = mountComponent({ value: '原备注', loading: true })
    await wrapper.find('.inline-edit__toggle').trigger('click')
    expect(wrapper.find('.inline-edit__input').attributes('disabled')).toBeDefined()
    expect(wrapper.find('.inline-edit__confirm').attributes('disabled')).toBeDefined()
  })

  it('shows spinner when loading is true', async () => {
    const wrapper = mountComponent({ value: '原备注', loading: true })
    await wrapper.find('.inline-edit__toggle').trigger('click')
    expect(wrapper.find('.inline-edit__spinner').exists()).toBe(true)
  })

  it('exits edit mode when value prop changes (parent submit success)', async () => {
    const wrapper = mountComponent({ value: '原备注' })
    await wrapper.find('.inline-edit__toggle').trigger('click')
    expect(wrapper.find('.inline-edit__input').exists()).toBe(true)

    // 模拟父组件提交成功后刷新 value
    await wrapper.setProps({ value: '新备注' })
    expect(wrapper.find('.inline-edit__input').exists()).toBe(false)
    expect(wrapper.find('.inline-edit__value').text()).toBe('新备注')
  })

  it('Enter key triggers submit', async () => {
    const wrapper = mountComponent({ value: '原备注' })
    await wrapper.find('.inline-edit__toggle').trigger('click')
    await wrapper.find('.inline-edit__input').setValue('新备注')
    await wrapper.find('.inline-edit__input').trigger('keydown', { key: 'Enter' })
    expect(wrapper.emitted('submit')).toEqual([['新备注']])
  })

  it('Esc key cancels edit mode', async () => {
    const wrapper = mountComponent({ value: '原备注' })
    await wrapper.find('.inline-edit__toggle').trigger('click')
    expect(wrapper.find('.inline-edit__input').exists()).toBe(true)
    await wrapper.find('.inline-edit__input').trigger('keydown', { key: 'Escape' })
    expect(wrapper.find('.inline-edit__input').exists()).toBe(false)
    expect(wrapper.emitted('cancel')).toHaveLength(1)
  })

  it('respects maxlength attribute', async () => {
    const wrapper = mountComponent({ value: '原备注', maxlength: 50 })
    await wrapper.find('.inline-edit__toggle').trigger('click')
    expect(wrapper.find('.inline-edit__input').attributes('maxlength')).toBe('50')
  })

  it('uses editAriaLabel for edit button when provided', async () => {
    const wrapper = mountComponent({ editAriaLabel: '编辑备注' })
    expect(wrapper.find('.inline-edit__toggle').attributes('aria-label')).toBe('编辑备注')
  })
})
