import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import FederationBadge from '../FederationBadge.vue'

// Mock vue-i18n
const mockT = (key: string) => key

// Simple test wrapper with i18n mock
const createWrapper = (component: any, props = {}) => {
  return mount(component, {
    props,
    global: {
      provide: {
        __i18n__: { t: mockT }
      },
      stubs: {
        Transition: {
          template: '<div><slot /></div>'
        }
      }
    }
  })
}

describe('FederationBadge', () => {
  it('renders with default props', () => {
    const wrapper = createWrapper(FederationBadge, {
      isLocal: false,
      size: 'sm'
    })
    expect(wrapper.exists()).toBe(true)
    expect(wrapper.classes('federation-badge')).toBe(true)
    expect(wrapper.classes('federation-badge--sm')).toBe(true)
    expect(wrapper.classes('federation-badge--local')).toBe(false)
  })

  it('shows local badge when isLocal is true', () => {
    const wrapper = createWrapper(FederationBadge, {
      isLocal: true,
      size: 'sm'
    })
    expect(wrapper.classes('federation-badge--local')).toBe(true)
  })

  it('renders with xs size', () => {
    const wrapper = createWrapper(FederationBadge, {
      size: 'xs',
      isLocal: false
    })
    expect(wrapper.classes('federation-badge--xs')).toBe(true)
  })

  it('renders with md size', () => {
    const wrapper = createWrapper(FederationBadge, {
      size: 'md',
      isLocal: false
    })
    expect(wrapper.classes('federation-badge--md')).toBe(true)
  })

  it('hides label when showLabel is false', () => {
    const wrapper = createWrapper(FederationBadge, {
      showLabel: false,
      isLocal: false
    })
    expect(wrapper.find('.federation-badge__label').exists()).toBe(false)
  })

  it('hides icon when showIcon is false', () => {
    const wrapper = createWrapper(FederationBadge, {
      showIcon: false,
      isLocal: false
    })
    expect(wrapper.find('.federation-badge__icon').exists()).toBe(false)
  })

  it('shows custom label when provided', () => {
    const wrapper = createWrapper(FederationBadge, {
      label: 'Custom Label',
      isLocal: false
    })
    expect(wrapper.find('.federation-badge__label').text()).toContain('Custom Label')
  })

  it('has correct data-testid', () => {
    const wrapper = createWrapper(FederationBadge, {
      isLocal: false
    })
    expect(wrapper.find('[data-testid="federation-badge"]').exists()).toBe(true)
  })

  it('has correct title attribute', () => {
    const wrapper = createWrapper(FederationBadge, {
      title: 'Custom Title',
      isLocal: false
    })
    expect(wrapper.find('[title="Custom Title"]').exists()).toBe(true)
  })
})
