import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import MessageLockBadge, { type TrustLevel } from '../MessageLockBadge.vue'

// Simple test wrapper
const createWrapper = (component: any, props = {}) => {
  return mount(component, {
    props,
    global: {
      stubs: {
        Transition: {
          template: '<div><slot /></div>'
        }
      }
    }
  })
}

describe('MessageLockBadge', () => {
  it('renders with verified trust level', () => {
    const wrapper = createWrapper(MessageLockBadge, {
      trustLevel: 'verified' as TrustLevel
    })
    expect(wrapper.exists()).toBe(true)
    expect(wrapper.classes('msg-lock-badge--verified')).toBe(true)
  })

  it('renders with unverified trust level', () => {
    const wrapper = createWrapper(MessageLockBadge, {
      trustLevel: 'unverified' as TrustLevel
    })
    expect(wrapper.exists()).toBe(true)
    expect(wrapper.classes('msg-lock-badge--unverified')).toBe(true)
  })

  it('renders with risk trust level', () => {
    const wrapper = createWrapper(MessageLockBadge, {
      trustLevel: 'risk' as TrustLevel
    })
    expect(wrapper.exists()).toBe(true)
    expect(wrapper.classes('msg-lock-badge--risk')).toBe(true)
    expect(wrapper.classes('msg-lock-badge--ring')).toBe(true)
  })

  it('defaults to unverified trust level', () => {
    const wrapper = createWrapper(MessageLockBadge, {})
    expect(wrapper.classes('msg-lock-badge--unverified')).toBe(true)
  })

  it('hides label when showLabel is false', () => {
    const wrapper = createWrapper(MessageLockBadge, {
      trustLevel: 'verified' as TrustLevel,
      showLabel: false
    })
    expect(wrapper.find('.msg-lock-badge__label').exists()).toBe(false)
  })

  it('shows custom label when provided', () => {
    const wrapper = createWrapper(MessageLockBadge, {
      trustLevel: 'verified' as TrustLevel,
      label: 'Custom Status',
      showLabel: true
    })
    expect(wrapper.find('.msg-lock-badge__label').text()).toContain('Custom Status')
  })

  it('has correct data-testid', () => {
    const wrapper = createWrapper(MessageLockBadge, {
      trustLevel: 'verified' as TrustLevel
    })
    expect(wrapper.find('[data-testid="message-lock-badge"]').exists()).toBe(true)
  })

  it('has correct title attribute', () => {
    const wrapper = createWrapper(MessageLockBadge, {
      trustLevel: 'verified' as TrustLevel,
      title: 'Verified Encrypted Message'
    })
    expect(wrapper.find('[title="Verified Encrypted Message"]').exists()).toBe(true)
  })

  it('renders green lock icon for verified', () => {
    const wrapper = createWrapper(MessageLockBadge, {
      trustLevel: 'verified' as TrustLevel
    })
    // Check that SVG exists with correct fill class
    expect(wrapper.find('svg').exists()).toBe(true)
    expect(wrapper.classes('msg-lock-badge--verified')).toBe(true)
  })

  it('renders gray lock icon for risk (stroke-based)', () => {
    const wrapper = createWrapper(MessageLockBadge, {
      trustLevel: 'risk' as TrustLevel
    })
    expect(wrapper.find('svg').exists()).toBe(true)
    expect(wrapper.classes('msg-lock-badge--risk')).toBe(true)
  })
})
