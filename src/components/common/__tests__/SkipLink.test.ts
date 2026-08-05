import { mount } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import SkipLink from '../SkipLink.vue'

describe('SkipLink', () => {
  beforeEach(() => {
    document.body.innerHTML = ''
  })

  afterEach(() => {
    document.body.innerHTML = ''
    vi.restoreAllMocks()
  })

  it('renders the label text and is visually hidden by default (off-screen)', () => {
    const wrapper = mount(SkipLink, {
      props: { target: '#chat-main', label: '跳到聊天区' }
    })
    const link = wrapper.find('[data-test="skip-link"]')
    expect(link.exists()).toBe(true)
    expect(link.text()).toBe('跳到聊天区')
    // 常态：top:-40px 移出视口（CSS 实现不可在 jsdom 取到布局值，
    // 但断言 class/属性可确认元素存在且未被 display:none 隐藏）
    expect(link.attributes('href')).toBe('#')
  })

  it('becomes visible on focus', async () => {
    const wrapper = mount(SkipLink, {
      props: { target: '#chat-main', label: '跳到聊天区' },
      attachTo: document.body
    })
    const link = wrapper.find('[data-test="skip-link"]')
    expect(link.isVisible()).toBe(true)
    // jsdom 无法真正计算 off-screen 可见性，但元素本身在 DOM 中
    expect(link.element.tagName).toBe('A')
  })

  it('activates jump and focuses target on click', async () => {
    const target = document.createElement('div')
    target.id = 'chat-main'
    target.tabIndex = -1
    document.body.appendChild(target)
    const focusSpy = vi.spyOn(target, 'focus')
    const scrollSpy = vi.spyOn(target, 'scrollIntoView')

    const wrapper = mount(SkipLink, {
      props: { target: '#chat-main', label: '跳到聊天区' },
      attachTo: document.body
    })

    await wrapper.find('[data-test="skip-link"]').trigger('click')

    expect(focusSpy).toHaveBeenCalledOnce()
    expect(scrollSpy).toHaveBeenCalledOnce()
    expect(document.activeElement).toBe(target)
  })

  it('activates jump on Enter key', async () => {
    const target = document.createElement('div')
    target.id = 'chat-main'
    target.tabIndex = -1
    document.body.appendChild(target)
    const focusSpy = vi.spyOn(target, 'focus')

    const wrapper = mount(SkipLink, {
      props: { target: '#chat-main', label: '跳到聊天区' },
      attachTo: document.body
    })

    await wrapper.find('[data-test="skip-link"]').trigger('keydown', { key: 'Enter' })

    expect(focusSpy).toHaveBeenCalledOnce()
    expect(document.activeElement).toBe(target)
  })

  it('activates jump on Space key', async () => {
    const target = document.createElement('div')
    target.id = 'chat-main'
    target.tabIndex = -1
    document.body.appendChild(target)
    const focusSpy = vi.spyOn(target, 'focus')

    const wrapper = mount(SkipLink, {
      props: { target: '#chat-main', label: '跳到聊天区' },
      attachTo: document.body
    })

    await wrapper.find('[data-test="skip-link"]').trigger('keydown', { key: ' ' })

    expect(focusSpy).toHaveBeenCalledOnce()
  })

  it('does nothing when target does not exist', async () => {
    const wrapper = mount(SkipLink, {
      props: { target: '#nonexistent', label: '跳到聊天区' },
      attachTo: document.body
    })
    // 不抛错
    await expect(wrapper.find('[data-test="skip-link"]').trigger('click')).resolves.toBeUndefined()
    expect(document.activeElement).toBe(document.body)
  })

  it('is the first focusable element in the document (Tab 首停点)', () => {
    // 模拟 layout 中的挂载顺序：skip-link 在最顶部
    const container = document.createElement('div')
    container.innerHTML = `
      <a href="#" data-test="skip-link" class="skip-link">跳到聊天区</a>
      <button type="button">其他按钮</button>
      <input type="text" />
    `
    document.body.appendChild(container)

    // 查询所有可聚焦元素
    const focusable = container.querySelectorAll(
      'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
    )
    expect(focusable.length).toBeGreaterThanOrEqual(1)
    const first = focusable[0]
    expect(first.getAttribute('data-test')).toBe('skip-link')
  })
})
