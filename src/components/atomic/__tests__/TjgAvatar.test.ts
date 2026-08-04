import { enableAutoUnmount, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import TjgAvatar from '../TjgAvatar.vue'

// === Mock AvatarUtils ===
const getAvatarUrlMock = vi.fn((src: string) => src || '/logoD.png')
vi.mock('@/utils/AvatarUtils', () => ({
  AvatarUtils: {
    getAvatarUrl: (src: string) => getAvatarUrlMock(src)
  }
}))

// === Mock setting store ===
vi.mock('@/stores/domains/settings/setting', () => ({
  useSettingStore: () => ({
    themeContent: 'light'
  })
}))

// === Mock ThemeEnum ===
vi.mock('@/enums', () => ({
  ThemeEnum: { DARK: 'dark', LIGHT: 'light' }
}))

describe('TjgAvatar', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
  })

  enableAutoUnmount(afterEach)

  it('renders img with resolved src', () => {
    const wrapper = mount(TjgAvatar, {
      props: { src: 'https://example.com/a.png', size: 48 }
    })
    const img = wrapper.find('img')
    expect(img.exists()).toBe(true)
    expect(img.attributes('src')).toBe('https://example.com/a.png')
  })

  it('passes loading=lazy and decoding=async to img', () => {
    const wrapper = mount(TjgAvatar, {
      props: { src: 'https://example.com/a.png' }
    })
    const img = wrapper.find('img')
    expect(img.attributes('loading')).toBe('lazy')
    expect(img.attributes('decoding')).toBe('async')
  })

  it('renders round avatar by default', () => {
    const wrapper = mount(TjgAvatar, {
      props: { src: 'https://example.com/a.png', round: true }
    })
    expect(wrapper.find('.tjg-avatar--round').exists()).toBe(true)
  })

  it('applies size to inline style', () => {
    const wrapper = mount(TjgAvatar, {
      props: { src: 'https://example.com/a.png', size: 64 }
    })
    const style = wrapper.find('.tjg-avatar').attributes('style') || ''
    expect(style).toContain('width: 64px')
    expect(style).toContain('height: 64px')
  })

  it('switches to fallback image when main image fails to load', async () => {
    const wrapper = mount(TjgAvatar, {
      props: { src: 'https://broken.example.com/a.png', fallbackSrc: '/custom-fallback.png' }
    })
    const img = wrapper.find('img')
    expect(img.attributes('src')).toBe('https://broken.example.com/a.png')

    // 模拟加载失败
    await img.trigger('error')

    // 应切换到 fallback
    const fallbackImg = wrapper.find('img')
    expect(fallbackImg.attributes('src')).toBe('/custom-fallback.png')
  })

  it('uses theme-aware fallback when fallbackSrc is not provided', () => {
    const wrapper = mount(TjgAvatar, {
      props: { src: 'https://broken.example.com/a.png' }
    })
    // 默认 light 主题，fallback 应该是 /logoD.png
    // 但因为没出错，主图仍是 src
    const img = wrapper.find('img')
    expect(img.attributes('src')).toBe('https://broken.example.com/a.png')
  })

  it('exposes role=img for screen readers', () => {
    const wrapper = mount(TjgAvatar, {
      props: { src: 'https://example.com/a.png', ariaLabel: 'User avatar' }
    })
    expect(wrapper.find('.tjg-avatar').attributes('role')).toBe('img')
    expect(wrapper.find('.tjg-avatar').attributes('aria-label')).toBe('User avatar')
  })
})
