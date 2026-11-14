import { mount } from '@vue/test-utils'
import { describe, expect, it, vi } from 'vitest'
import Validation from '../Validation.vue'

vi.mock('vue-i18n', () => ({
  useI18n: () => ({ t: (key: string) => key })
}))

const flexStub = { template: '<div><slot /></div>' }

describe('Validation', () => {
  it('renders the neutral state without an alert role', () => {
    const wrapper = mount(Validation, {
      props: { value: '', message: 'Required', validator: () => false },
      global: { stubs: { 'n-flex': flexStub } }
    })

    expect(wrapper.find('[role="alert"]').exists()).toBe(false)
    expect(wrapper.text()).toBe('Required')
    expect(wrapper.find('p').classes()).toContain('color-[--tjg-text-tertiary]')
    expect(wrapper.find('[data-follow-stroke]').attributes('data-follow-stroke')).toBe('var(--tjg-text-tertiary)')
  })

  it('renders the success state when the validator passes', () => {
    const wrapper = mount(Validation, {
      props: { value: 'ok', message: 'Looks good', validator: () => true },
      global: { stubs: { 'n-flex': flexStub } }
    })

    expect(wrapper.find('p').classes()).toContain('color-[--tjg-text-primary]')
    expect(wrapper.find('[data-follow-stroke]').attributes('data-follow-stroke')).toBe('var(--tjg-color-primary-500)')
  })

  it('forces the success tone even when the validator fails', () => {
    const wrapper = mount(Validation, {
      props: { value: 'bad', message: 'Looks good', tone: 'success', validator: () => false },
      global: { stubs: { 'n-flex': flexStub } }
    })

    expect(wrapper.find('p').classes()).toContain('color-[--tjg-text-primary]')
    expect(wrapper.find('[data-follow-stroke]').attributes('data-follow-stroke')).toBe('var(--tjg-color-primary-500)')
  })

  it('renders an inline error state with an alert role', () => {
    const wrapper = mount(Validation, {
      props: { value: 'bad', message: 'Invalid format', tone: 'error' },
      global: { stubs: { 'n-flex': flexStub } }
    })

    expect(wrapper.find('[role="alert"]').exists()).toBe(true)
    expect(wrapper.find('p').classes()).toContain('color-[--tjg-color-danger-600]')
    const marker = wrapper.find('[data-follow-stroke]')
    expect(marker.attributes('data-follow-stroke')).toBe('var(--tjg-color-danger-500)')
    expect(marker.attributes('data-follow-fill')).toBe('var(--tjg-color-danger-100)')
  })

  it('exposes the message id for aria-describedby wiring', () => {
    const wrapper = mount(Validation, {
      props: { value: 'bad', message: 'Invalid format', tone: 'error', id: 'field-error' },
      global: { stubs: { 'n-flex': flexStub } }
    })

    expect(wrapper.find('p').attributes('id')).toBe('field-error')
  })
})
