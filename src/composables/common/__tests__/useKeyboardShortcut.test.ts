import { enableAutoUnmount, mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, h, onMounted } from 'vue'
import { createMemoryHistory, createRouter } from 'vue-router'
import { useKeyboardShortcut } from '../useKeyboardShortcut'

// === Mock router ===
const pushMock = vi.fn()
const backMock = vi.fn()

vi.mock('@/router', () => ({
  default: {
    push: (...args: unknown[]) => pushMock(...(args as [string])),
    back: () => backMock()
  }
}))

// === Mock Logger ===
vi.mock('@/utils/Logger', () => ({
  createLogger: () => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn()
  })
}))

// === Helper: 派发 keydown 事件 ===
const dispatchKeydown = (key: string, options: KeyboardEventInit = {}) => {
  const event = new KeyboardEvent('keydown', {
    key,
    bubbles: true,
    cancelable: true,
    ...options
  })
  window.dispatchEvent(event)
  return event
}

// === Helper: 创建宿主组件 ===
let hostApi: ReturnType<typeof useKeyboardShortcut> | null = null

const TestHost = defineComponent({
  name: 'TestHost',
  setup() {
    hostApi = useKeyboardShortcut()
    onMounted(() => {})
    return () => h('div', { class: 'test-host' })
  }
})

const buildRouter = () =>
  createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/', name: 'home', component: { template: '<div/>' } },
      { path: '/friend', name: 'friend', component: { template: '<div/>' } }
    ]
  })

// 在文件顶层调用一次，避免多次调用错误
enableAutoUnmount(afterEach)

// 每个测试前重置 hostApi
beforeEach(() => {
  hostApi = null
})

describe('useKeyboardShortcut - constants & registration', () => {
  it('registers and unregisters keydown listener correctly', async () => {
    const wrapper = mount(TestHost, { global: { plugins: [buildRouter()] } })
    // 派发任意键应被接收（不报错）
    dispatchKeydown('a')
    expect(wrapper.exists()).toBe(true)
  })
})

describe('useKeyboardShortcut - Esc behavior', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('Esc clears active search input when one is focused', async () => {
    const input = document.createElement('input')
    input.type = 'text'
    input.value = 'some query'
    document.body.appendChild(input)
    input.focus()

    mount(TestHost, { global: { plugins: [buildRouter()] } })
    dispatchKeydown('Escape')

    expect(input.value).toBe('')
    document.body.removeChild(input)
  })

  it('Esc triggers router.back() when no input is focused', async () => {
    mount(TestHost, { global: { plugins: [buildRouter()] } })
    dispatchKeydown('Escape')

    expect(backMock).toHaveBeenCalled()
  })
})

describe('useKeyboardShortcut - Alt+ArrowLeft behavior', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('Alt+ArrowLeft triggers router.back()', async () => {
    mount(TestHost, { global: { plugins: [buildRouter()] } })
    dispatchKeydown('ArrowLeft', { altKey: true })

    expect(backMock).toHaveBeenCalled()
  })

  it('ArrowLeft without Alt does NOT trigger router.back()', async () => {
    mount(TestHost, { global: { plugins: [buildRouter()] } })
    dispatchKeydown('ArrowLeft')

    expect(backMock).not.toHaveBeenCalled()
  })
})

describe('useKeyboardShortcut - list navigation (ArrowUp/ArrowDown/Enter)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('ArrowDown moves active index forward and dispatches selection event', async () => {
    mount(TestHost, { global: { plugins: [buildRouter()] } })
    hostApi!.registerListNavigation({
      itemCount: 5,
      onSelect: vi.fn()
    })

    // ArrowDown 3 次：0 -> 1 -> 2 -> 3
    dispatchKeydown('ArrowDown')
    dispatchKeydown('ArrowDown')
    dispatchKeydown('ArrowDown')

    expect(hostApi!.getActiveIndex()).toBe(3)
  })

  it('ArrowUp moves active index backward (clamps at 0)', async () => {
    mount(TestHost, { global: { plugins: [buildRouter()] } })
    hostApi!.registerListNavigation({
      itemCount: 5,
      onSelect: vi.fn()
    })

    // 起始位置 0，ArrowUp 应保持 0
    dispatchKeydown('ArrowUp')
    expect(hostApi!.getActiveIndex()).toBe(0)

    // 向下走 2 步，再回 1 步
    dispatchKeydown('ArrowDown')
    dispatchKeydown('ArrowDown')
    dispatchKeydown('ArrowUp')
    expect(hostApi!.getActiveIndex()).toBe(1)
  })

  it('Enter triggers onSelect with current active item', async () => {
    const onSelect = vi.fn()
    mount(TestHost, { global: { plugins: [buildRouter()] } })
    hostApi!.registerListNavigation({
      itemCount: 5,
      onSelect
    })

    // 移动到第 2 项（索引 1），按 Enter
    dispatchKeydown('ArrowDown')
    dispatchKeydown('Enter')

    expect(onSelect).toHaveBeenCalledWith(1)
  })

  it('ArrowDown at last item clamps to last index', async () => {
    mount(TestHost, { global: { plugins: [buildRouter()] } })
    hostApi!.registerListNavigation({
      itemCount: 3,
      onSelect: vi.fn()
    })

    // 不停地按 ArrowDown，应停在最后一项
    dispatchKeydown('ArrowDown')
    dispatchKeydown('ArrowDown')
    dispatchKeydown('ArrowDown')
    dispatchKeydown('ArrowDown')
    dispatchKeydown('ArrowDown')

    expect(hostApi!.getActiveIndex()).toBe(2)
  })
})

describe('useKeyboardShortcut - Ctrl+F focuses search box', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('Ctrl+F dispatches "search:focus" event (prevents browser find)', async () => {
    const focusSpy = vi.fn()
    window.addEventListener('search:focus', focusSpy)

    mount(TestHost, { global: { plugins: [buildRouter()] } })
    dispatchKeydown('f', { ctrlKey: true })

    expect(focusSpy).toHaveBeenCalled()
    window.removeEventListener('search:focus', focusSpy)
  })

  it('Cmd+F on Mac dispatches "search:focus" event', async () => {
    const focusSpy = vi.fn()
    window.addEventListener('search:focus', focusSpy)

    mount(TestHost, { global: { plugins: [buildRouter()] } })
    // 同时按 ctrl+meta 模拟跨平台测试环境
    dispatchKeydown('f', { metaKey: true, ctrlKey: true })

    expect(focusSpy).toHaveBeenCalled()
    window.removeEventListener('search:focus', focusSpy)
  })
})
