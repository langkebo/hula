import { enableAutoUnmount, mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, h, onUnmounted } from 'vue'
import { createMemoryHistory, createRouter } from 'vue-router'
import { triggerGlobalSearch, useSearchShortcut } from '../useSearchShortcut'

// === Mock router ===
const pushMock = vi.fn()

vi.mock('@/router', () => ({
  default: {
    push: (...args: unknown[]) => pushMock(...args)
  }
}))

vi.mock('@/utils/Logger', () => ({
  createLogger: () => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn()
  })
}))

const buildRouter = () =>
  createRouter({
    history: createMemoryHistory(),
    routes: [{ path: '/', name: 'home', component: { template: '<div/>' } }]
  })

// 测试用的 host 组件，挂载后才会注册 useSearchShortcut 的 keydown 监听
const TestHost = defineComponent({
  name: 'TestHost',
  setup() {
    useSearchShortcut()
    onUnmounted(() => {})
    return () => h('div', { class: 'test-host' })
  }
})

describe('useSearchShortcut', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // 默认非 mac 平台
    vi.stubGlobal('navigator', { platform: 'Win32' })
  })

  const mountHost = () => {
    const router = buildRouter()
    const wrapper = mount(TestHost, { global: { plugins: [router] } })
    return wrapper
  }

  const dispatchKey = (key: string, opts: { ctrl?: boolean; meta?: boolean; shift?: boolean } = {}) => {
    window.dispatchEvent(
      new KeyboardEvent('keydown', {
        key,
        ctrlKey: Boolean(opts.ctrl),
        metaKey: Boolean(opts.meta),
        shiftKey: Boolean(opts.shift),
        bubbles: true,
        cancelable: true
      })
    )
  }

  enableAutoUnmount(afterEach)

  it('triggers global search on Ctrl+Shift+F (Windows/Linux)', async () => {
    const wrapper = mountHost()

    dispatchKey('F', { ctrl: true, shift: true })

    await wrapper.vm.$nextTick()

    expect(pushMock).toHaveBeenCalledTimes(1)
    expect(pushMock).toHaveBeenCalledWith('/search')
    wrapper.unmount()
  })

  it('dispatches search:focus event on Ctrl+F (Windows/Linux)', async () => {
    const wrapper = mountHost()
    const focusSpy = vi.fn()
    window.addEventListener('search:focus', focusSpy)

    dispatchKey('f', { ctrl: true })

    await wrapper.vm.$nextTick()

    expect(focusSpy).toHaveBeenCalledTimes(1)
    expect(pushMock).not.toHaveBeenCalled()

    window.removeEventListener('search:focus', focusSpy)
    wrapper.unmount()
  })

  it('triggers global search on Cmd+Shift+F (macOS)', async () => {
    vi.stubGlobal('navigator', { platform: 'MacIntel' })
    const wrapper = mountHost()

    dispatchKey('F', { meta: true, shift: true })

    await wrapper.vm.$nextTick()

    expect(pushMock).toHaveBeenCalledWith('/search')
    wrapper.unmount()
  })

  it('dispatches search:focus event on Cmd+F (macOS)', async () => {
    vi.stubGlobal('navigator', { platform: 'MacIntel' })
    const wrapper = mountHost()
    const focusSpy = vi.fn()
    window.addEventListener('search:focus', focusSpy)

    dispatchKey('f', { meta: true })

    await wrapper.vm.$nextTick()

    expect(focusSpy).toHaveBeenCalledTimes(1)
    expect(pushMock).not.toHaveBeenCalled()

    window.removeEventListener('search:focus', focusSpy)
    wrapper.unmount()
  })

  it('does nothing when neither Ctrl nor Cmd is pressed', async () => {
    const wrapper = mountHost()
    const focusSpy = vi.fn()
    window.addEventListener('search:focus', focusSpy)

    dispatchKey('f', { shift: true })

    await wrapper.vm.$nextTick()

    expect(focusSpy).not.toHaveBeenCalled()
    expect(pushMock).not.toHaveBeenCalled()

    window.removeEventListener('search:focus', focusSpy)
    wrapper.unmount()
  })

  it('does nothing for unrelated keys even with Ctrl', async () => {
    const wrapper = mountHost()
    const focusSpy = vi.fn()
    window.addEventListener('search:focus', focusSpy)

    dispatchKey('a', { ctrl: true })

    await wrapper.vm.$nextTick()

    expect(focusSpy).not.toHaveBeenCalled()
    expect(pushMock).not.toHaveBeenCalled()

    window.removeEventListener('search:focus', focusSpy)
    wrapper.unmount()
  })

  it('removes keydown listener on unmount', async () => {
    const wrapper = mountHost()
    wrapper.unmount()

    dispatchKey('F', { ctrl: true, shift: true })
    await Promise.resolve()

    expect(pushMock).not.toHaveBeenCalled()
  })
})

describe('triggerGlobalSearch', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('navigates to /search when no query is provided', () => {
    triggerGlobalSearch()

    expect(pushMock).toHaveBeenCalledWith('/search')
  })

  it('navigates to /search?q=... with encoded query', () => {
    triggerGlobalSearch('Alice & Bob')

    expect(pushMock).toHaveBeenCalledWith('/search?q=Alice%20%26%20Bob')
  })

  it('navigates to /search when query is only whitespace', () => {
    triggerGlobalSearch('   ')

    expect(pushMock).toHaveBeenCalledWith('/search')
  })
})
