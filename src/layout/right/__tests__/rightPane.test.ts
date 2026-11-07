import { mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, h, ref } from 'vue'
import LayoutRight from '../index.vue'

/**
 * 回归：`layout/right/index.vue` 里的 `<CreateRoomPane>` 原先没有监听 `@close`
 * （守门基线 32 条之一），使得 CreateRoomPane 的 X / 取消按钮是空操作，只有顶部
 * ActionBar 的返回按钮有效。本测试断言两条路径走的是同一个 `handleBack`。
 */
const { routerBackMock, routerPushMock, currentRoute } = vi.hoisted(() => ({
  routerBackMock: vi.fn(),
  routerPushMock: vi.fn(async () => undefined),
  currentRoute: { value: { path: '/room/create', params: {}, query: {} } as Record<string, unknown> }
}))

vi.mock('vue-router', () => ({
  useRoute: () => currentRoute.value,
  useRouter: () => ({ back: routerBackMock, push: routerPushMock })
}))

vi.mock('@/router', () => ({
  default: { back: routerBackMock, push: routerPushMock }
}))

vi.mock('vue-i18n', () => ({
  useI18n: () => ({ t: (key: string) => key })
}))

vi.mock('@/composables/common/useMitt', () => ({
  useMitt: { emit: vi.fn(), on: vi.fn(() => () => undefined) }
}))

vi.mock('@/composables/layout/useResponsiveBreakpoint', () => ({
  useResponsiveBreakpoint: () => ({ isRightPaneFullscreen: ref(false), isShrink: ref(false) })
}))

const nudgeWidthMock = vi.fn()

vi.mock('@/composables/layout/useRightPaneWidth', () => ({
  useRightPaneWidth: () => ({
    width: ref(320),
    isDragging: ref(false),
    transitionEnabled: ref(false),
    startDrag: vi.fn(),
    nudgeWidth: nudgeWidthMock
  })
}))

vi.mock('@/stores/domains/widget/global', () => ({
  useGlobalStore: () => ({ currentSessionRoomId: ref(null) })
}))

const CreateRoomPaneStub = defineComponent({
  name: 'CreateRoomPane',
  emits: ['close'],
  setup(_, { emit }) {
    return () => h('button', { 'data-test': 'create-room-close', onClick: () => emit('close') }, 'close')
  }
})

const stubs = {
  ActionBar: true,
  ChatBox: true,
  Details: true,
  ApplyList: true,
  AddFriendPane: true,
  CreateRoomPane: CreateRoomPaneStub,
  JoinRoomPane: true,
  CreateSpacePane: true,
  SpaceChildrenPane: true,
  SearchPane: true,
  // 本文件只测关闭接线，玻璃材质层经 pinia store 取档位，隔离掉以免依赖全局 store
  TjGlass: true
}

const mountPane = () => mount(LayoutRight, { global: { stubs } })

const setHistoryLength = (length: number) =>
  Object.defineProperty(window, 'history', { value: { length }, writable: true, configurable: true })

describe('layout/right — pane close wiring', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    currentRoute.value = { path: '/room/create', params: {}, query: {} }
    setHistoryLength(2)
  })

  it('CreateRoomPane close does exactly what the ActionBar back button does', async () => {
    const wrapper = mountPane()

    // 参考路径：顶部 ActionBar 的返回按钮（handleBack）
    await wrapper.get('header button').trigger('click')
    expect(routerBackMock).toHaveBeenCalledTimes(1)

    routerBackMock.mockClear()
    expect(wrapper.find('[data-test="create-room-close"]').exists()).toBe(true)
    await wrapper.get('[data-test="create-room-close"]').trigger('click')
    expect(routerBackMock).toHaveBeenCalledTimes(1)
  })

  it('CreateRoomPane close falls back to the room root without history', async () => {
    setHistoryLength(1)
    const wrapper = mountPane()

    await wrapper.get('[data-test="create-room-close"]').trigger('click')

    expect(routerPushMock).toHaveBeenCalledWith('/room')
  })

  // UI-P2-01：聊天视图改为弹性主区，宽度拖拽交给信息面板左缘
  it('makes the chat view elastic and hides the pane drag handle', () => {
    currentRoute.value = { path: '/message/!room:example.com', params: { roomId: '!room:example.com' }, query: {} }
    const wrapper = mountPane()

    expect(wrapper.find('[data-test="right-pane-drag-handle"]').exists()).toBe(false)
    expect(wrapper.find('#chat-main').attributes('style')).toContain('min-width: 0')
  })

  // A-02：拖拽把手必须具备可访问名称、分隔条语义与键盘替代
  it('exposes an accessible resize separator with keyboard support', async () => {
    const wrapper = mountPane()
    const handle = wrapper.get('[data-test="right-pane-drag-handle"]')

    expect(handle.attributes('role')).toBe('separator')
    expect(handle.attributes('aria-orientation')).toBe('vertical')
    expect(handle.attributes('aria-label')).toBe('components.rightPane.resize_handle')
    expect(handle.attributes('tabindex')).toBe('0')

    await handle.trigger('keydown', { key: 'ArrowLeft' })
    expect(nudgeWidthMock).toHaveBeenLastCalledWith(16)

    await handle.trigger('keydown', { key: 'ArrowRight' })
    expect(nudgeWidthMock).toHaveBeenLastCalledWith(-16)
  })
})
