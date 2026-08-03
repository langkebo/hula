import { mount } from '@vue/test-utils'
import { describe, expect, it, vi } from 'vitest'
import BurnAfterReadToggle from '../BurnAfterReadToggle.vue'

vi.mock('vue-i18n', () => ({
  useI18n: () => ({ t: (key: string) => key })
}))

describe('BurnAfterReadToggle', () => {
  it('renders toggle switch', () => {
    const wrapper = mount(BurnAfterReadToggle, {
      props: { enabled: false }
    })
    expect(wrapper.find('[data-test="burn-toggle"]').exists()).toBe(true)
  })

  it('emits update:enabled when toggled', async () => {
    const wrapper = mount(BurnAfterReadToggle, {
      props: { enabled: false }
    })
    await wrapper.find('[data-test="burn-toggle"]').trigger('click')
    expect(wrapper.emitted('update:enabled')).toBeTruthy()
    expect(wrapper.emitted('update:enabled')![0]).toEqual([true])
  })

  it('shows duration options when enabled', () => {
    const wrapper = mount(BurnAfterReadToggle, {
      props: { enabled: true }
    })
    expect(wrapper.find('[data-test="burn-durations"]').exists()).toBe(true)
  })

  it('emits select-duration when a duration is clicked', async () => {
    const wrapper = mount(BurnAfterReadToggle, {
      props: { enabled: true }
    })
    await wrapper.find('[data-test="burn-duration-60"]').trigger('click')
    expect(wrapper.emitted('select-duration')).toBeTruthy()
    expect(wrapper.emitted('select-duration')![0]).toEqual([60])
  })
})
