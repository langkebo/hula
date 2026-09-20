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

/**
 * 交互态（方案 3.1：锁徽章是「可操作入口」）
 *
 * 覆盖：根节点元素类型切换、verify 事件派发条件、无障碍名称、单根结构回归
 * 不覆盖：点击后打开哪个对话框（见 components/encryption/__tests__/deviceVerifyFlow.contract.test.ts）
 */
describe('MessageLockBadge 交互态', () => {
  it('默认渲染 <span>，且点击不派发 verify（纯展示语义与历史一致）', async () => {
    const wrapper = createWrapper(MessageLockBadge, { trustLevel: 'unverified' as TrustLevel })

    const root = wrapper.find('[data-testid="message-lock-badge"]')
    expect(root.element.tagName).toBe('SPAN')

    await root.trigger('click')
    expect(wrapper.emitted('verify')).toBeFalsy()
  })

  it('interactive 时渲染 <button>，点击派发 verify', async () => {
    const wrapper = createWrapper(MessageLockBadge, {
      trustLevel: 'unverified' as TrustLevel,
      interactive: true
    })

    const root = wrapper.find('[data-testid="message-lock-badge"]')
    expect(root.element.tagName).toBe('BUTTON')
    // button 默认 type=submit 会在表单里触发提交，必须显式声明为 button
    expect(root.attributes('type')).toBe('button')

    await root.trigger('click')
    expect(wrapper.emitted('verify')).toHaveLength(1)
  })

  it('交互态必须有可访问名称：ariaLabel 优先，其次 title，最后回退状态文案', () => {
    const withAriaLabel = createWrapper(MessageLockBadge, {
      trustLevel: 'unverified' as TrustLevel,
      interactive: true,
      ariaLabel: '验证发送方设备',
      title: '端到端加密已验证'
    })
    expect(withAriaLabel.find('[data-testid="message-lock-badge"]').attributes('aria-label')).toBe('验证发送方设备')

    const withTitleOnly = createWrapper(MessageLockBadge, {
      trustLevel: 'unverified' as TrustLevel,
      interactive: true,
      title: '端到端加密已验证'
    })
    expect(withTitleOnly.find('[data-testid="message-lock-badge"]').attributes('aria-label')).toBe('端到端加密已验证')

    const withNothing = createWrapper(MessageLockBadge, {
      trustLevel: 'unverified' as TrustLevel,
      interactive: true
    })
    expect(withNothing.find('[data-testid="message-lock-badge"]').attributes('aria-label')).toBe('未验证')
  })

  it('非交互态不输出 aria-label（避免给纯展示元素加冗余语义）', () => {
    const wrapper = createWrapper(MessageLockBadge, { trustLevel: 'unverified' as TrustLevel })
    expect(wrapper.find('[data-testid="message-lock-badge"]').attributes('aria-label')).toBeUndefined()
  })

  it('模板不得以注释开头：注释会成为额外根节点，使 wrapper 取不到真实根元素', () => {
    // 回归守卫：一旦模板顶部出现 HTML 注释，组件退化为多根片段，
    // wrapper.element 会落到外层容器，本文件其余所有 classes() 断言会静默失空。
    const wrapper = createWrapper(MessageLockBadge, { trustLevel: 'verified' as TrustLevel })

    expect(wrapper.element.tagName).toBe('SPAN')
    expect(wrapper.element.className).toContain('msg-lock-badge')
  })

  it('交互态保留三态配色修饰类（按钮默认样式不得顶替状态色）', () => {
    for (const trustLevel of ['verified', 'unverified', 'risk'] as TrustLevel[]) {
      const wrapper = createWrapper(MessageLockBadge, { trustLevel, interactive: true })
      expect(wrapper.classes(`msg-lock-badge--${trustLevel}`)).toBe(true)
      expect(wrapper.classes('msg-lock-badge--interactive')).toBe(true)
    }
  })
})
