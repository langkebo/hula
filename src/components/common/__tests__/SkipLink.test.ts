import { mount } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, h } from 'vue'
import SkipLink from '../SkipLink.vue'

/**
 * 模拟 layout/index.vue 中 SkipLink 的真实挂载顺序：
 * skip-link 在容器最顶部，其后跟可聚焦的兄弟元素（按钮/输入框）。
 * 用真实组件 mount 而非 innerHTML 字符串，确保断言反映真实渲染产物。
 */
const MountOrderHost = defineComponent({
  name: 'MountOrderHost',
  components: { SkipLink },
  props: {
    skipFirst: { type: Boolean, default: true }
  },
  setup(props) {
    const skipLink = h(SkipLink, { target: '#chat-main', label: '跳到聊天区' })
    const siblingButton = h('button', { type: 'button' }, '其他按钮')
    const siblingInput = h('input', { type: 'text' })
    const children = props.skipFirst ? [skipLink, siblingButton, siblingInput] : [siblingButton, siblingInput, skipLink]
    return () => h('div', children)
  }
})

describe('SkipLink', () => {
  beforeEach(() => {
    document.body.innerHTML = ''
  })

  afterEach(() => {
    document.body.innerHTML = ''
    vi.restoreAllMocks()
  })

  it('renders an anchor with the skip-link class, label text, and target-derived href', () => {
    const wrapper = mount(SkipLink, {
      props: { target: '#chat-main', label: '跳到聊天区' }
    })
    const link = wrapper.find('[data-test="skip-link"]')
    expect(link.exists()).toBe(true)
    expect(link.element.tagName).toBe('A')
    expect(link.classes()).toContain('skip-link')
    expect(link.text()).toBe('跳到聊天区')
    // href 由 target 派生：JS 失效时原生锚点跳转兜底
    expect(link.attributes('href')).toBe('#chat-main')
  })

  it('fires the focus handler and is focusable (CSS drives visibility, not JS state)', async () => {
    const wrapper = mount(SkipLink, {
      props: { target: '#chat-main', label: '跳到聊天区' },
      attachTo: document.body
    })
    const link = wrapper.find('[data-test="skip-link"]')
    const linkEl = link.element as HTMLAnchorElement
    expect(linkEl.tabIndex).toBe(0)
    // 真实触发 focus 事件，确认元素可获焦且不抛错
    linkEl.focus()
    expect(document.activeElement).toBe(linkEl)
    // CSS 通过 :focus/:focus-visible 切换可见性，jsdom 不能算布局，
    // 但元素本身在 DOM 中且可获焦，证明 skip-link 常态存在于 a11y 树
    expect(link.isVisible()).toBe(true)
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

  it('is the first focusable element in DOM order when mounted at the top (Tab 首停点)', () => {
    const wrapper = mount(MountOrderHost, { props: { skipFirst: true } })
    const focusable = (wrapper.element as HTMLElement).querySelectorAll(
      'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex="0"]'
    )
    expect(focusable.length).toBeGreaterThanOrEqual(1)
    const first = focusable[0]
    expect(first.getAttribute('data-test')).toBe('skip-link')
    expect(first.tagName).toBe('A')
  })

  it('fails the Tab 首停点 assertion when skip-link is mounted after sibling focusables', () => {
    // 反向验证：skip-link 放在兄弟可聚焦元素之后，首停点不应是 skip-link。
    // 此用例确保上一条断言不是恒真的——若 skip-link 位置错误，必须能被检出。
    const wrapper = mount(MountOrderHost, { props: { skipFirst: false } })
    const focusable = (wrapper.element as HTMLElement).querySelectorAll(
      'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex="0"]'
    )
    expect(focusable.length).toBeGreaterThanOrEqual(1)
    const first = focusable[0]
    expect(first.getAttribute('data-test')).not.toBe('skip-link')
  })
})
