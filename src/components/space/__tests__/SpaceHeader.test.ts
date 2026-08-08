import { mount } from '@vue/test-utils'
import { describe, expect, it, vi } from 'vitest'
import SpaceHeader from '../SpaceHeader.vue'

vi.mock('vue-i18n', () => ({
  useI18n: () => ({
    t: (key: string, params?: Record<string, unknown>) => (params ? `${key}:${JSON.stringify(params)}` : key)
  })
}))

const sampleSpace = {
  spaceId: '!space-1:server',
  name: 'Design Team',
  topic: 'Design collaboration space',
  avatarUrl: undefined,
  memberCount: 12,
  childCount: 5
}

const mountHeader = (props: Record<string, unknown> = {}) =>
  mount(SpaceHeader, {
    props: {
      space: sampleSpace,
      ...props
    }
  })

describe('SpaceHeader', () => {
  it('renders the header container', () => {
    const wrapper = mountHeader()
    expect(wrapper.find('[data-testid="space-header"]').exists()).toBe(true)
  })

  it('renders the space name', () => {
    const wrapper = mountHeader()
    expect(wrapper.find('[data-testid="space-header-name"]').text()).toBe('Design Team')
  })

  it('renders the topic when provided', () => {
    const wrapper = mountHeader()
    expect(wrapper.find('[data-testid="space-header-topic"]').text()).toContain('Design collaboration space')
  })

  it('does not render topic element when topic is absent', () => {
    const wrapper = mountHeader({ space: { ...sampleSpace, topic: undefined } })
    expect(wrapper.find('[data-testid="space-header-topic"]').exists()).toBe(false)
  })

  it('renders member count stat', () => {
    const wrapper = mountHeader()
    const stats = wrapper.find('[data-testid="space-header-members"]')
    expect(stats.exists()).toBe(true)
    expect(stats.text()).toContain('12')
  })

  it('renders child count stat', () => {
    const wrapper = mountHeader()
    const stats = wrapper.find('[data-testid="space-header-children"]')
    expect(stats.exists()).toBe(true)
    expect(stats.text()).toContain('5')
  })

  it('renders avatar image when avatarUrl provided', () => {
    const wrapper = mountHeader({ space: { ...sampleSpace, avatarUrl: 'https://example.com/a.png' } })
    const img = wrapper.find('[data-testid="space-header-avatar-img"]')
    expect(img.exists()).toBe(true)
    expect(img.attributes('src')).toBe('https://example.com/a.png')
  })

  it('renders avatar placeholder with first character when no avatarUrl', () => {
    const wrapper = mountHeader()
    const placeholder = wrapper.find('[data-testid="space-header-avatar-placeholder"]')
    expect(placeholder.exists()).toBe(true)
    expect(placeholder.text()).toBe('D')
  })

  it('renders settings button when canManage is true', () => {
    const wrapper = mountHeader({ canManage: true })
    expect(wrapper.find('[data-testid="space-header-settings"]').exists()).toBe(true)
  })

  it('hides settings button when canManage is false', () => {
    const wrapper = mountHeader({ canManage: false })
    expect(wrapper.find('[data-testid="space-header-settings"]').exists()).toBe(false)
  })

  it('hides settings button when canManage is undefined (default)', () => {
    const wrapper = mountHeader()
    expect(wrapper.find('[data-testid="space-header-settings"]').exists()).toBe(false)
  })

  it('emits settings with spaceId when settings button clicked', async () => {
    const wrapper = mountHeader({ canManage: true })
    await wrapper.find('[data-testid="space-header-settings"]').trigger('click')
    expect(wrapper.emitted('settings')).toEqual([['!space-1:server']])
  })

  it('uses 1.5px stroke width on svg icons', () => {
    const wrapper = mountHeader({ canManage: true })
    const svgs = wrapper.findAll('svg')
    expect(svgs.length).toBeGreaterThan(0)
    for (const svg of svgs) {
      expect(svg.attributes('stroke-width')).toBe('1.5')
    }
  })

  it('renders accessible avatar region with aria-label', () => {
    const wrapper = mountHeader()
    const avatar = wrapper.find('[data-testid="space-header-avatar"]')
    expect(avatar.exists()).toBe(true)
    expect(avatar.attributes('aria-label')).toBeTruthy()
  })
})
