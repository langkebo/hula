import { mount } from '@vue/test-utils'
import { describe, expect, it, vi } from 'vitest'
import PrivateModeBanner from '../PrivateModeBanner.vue'

vi.mock('vue-i18n', () => ({
  useI18n: () => ({ t: (key: string) => key })
}))

describe('PrivateModeBanner', () => {
  it('renders banner when burn is enabled', () => {
    const wrapper = mount(PrivateModeBanner, {
      props: { burnEnabled: true, remainingSeconds: 60 }
    })
    expect(wrapper.find('[data-test="private-mode-banner"]').exists()).toBe(true)
  })

  it('hides banner when burn is disabled', () => {
    const wrapper = mount(PrivateModeBanner, {
      props: { burnEnabled: false, remainingSeconds: undefined }
    })
    expect(wrapper.find('[data-test="private-mode-banner"]').exists()).toBe(false)
  })

  it('shows countdown text when burning', () => {
    const wrapper = mount(PrivateModeBanner, {
      props: { burnEnabled: true, remainingSeconds: 30 }
    })
    expect(wrapper.text()).toContain('30s')
  })
})
