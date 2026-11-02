import { beforeEach, describe, expect, it } from 'vitest'
import { nextTick, ref } from 'vue'
import { CHAT_SIDEBAR_COLLAPSED_KEY, useChatSidebar } from '../useChatSidebar'

/** 模拟窗口宽度变化，驱动 useResponsiveBreakpoint 断点 */
const setWindowWidth = (width: number) => {
  Object.defineProperty(window, 'innerWidth', { value: width, writable: true, configurable: true })
  window.dispatchEvent(new Event('resize'))
}

describe('useChatSidebar', () => {
  beforeEach(() => {
    window.localStorage.clear()
    setWindowWidth(1280)
  })

  it('宽屏（>=1200px）且无持久化记录时默认展开', () => {
    const { isCollapsed, panelClass } = useChatSidebar({ isGroup: ref(true) })

    expect(isCollapsed.value).toBe(false)
    expect(panelClass.value).toContain('w-240px')
  })

  it('非宽屏且无持久化记录时默认折叠', () => {
    setWindowWidth(1100)
    const { isCollapsed } = useChatSidebar({ isGroup: ref(true) })

    expect(isCollapsed.value).toBe(true)
  })

  it('优先使用持久化的折叠状态', () => {
    window.localStorage.setItem(CHAT_SIDEBAR_COLLAPSED_KEY, '1')
    setWindowWidth(1280)
    expect(useChatSidebar({ isGroup: ref(true) }).isCollapsed.value).toBe(true)

    window.localStorage.setItem(CHAT_SIDEBAR_COLLAPSED_KEY, '0')
    setWindowWidth(1100)
    expect(useChatSidebar({ isGroup: ref(true) }).isCollapsed.value).toBe(false)
  })

  it('toggle 与 collapse 会写回持久化状态', async () => {
    const { isCollapsed, toggle, collapse } = useChatSidebar({ isGroup: ref(true) })

    toggle()
    await nextTick()
    expect(isCollapsed.value).toBe(true)
    expect(window.localStorage.getItem(CHAT_SIDEBAR_COLLAPSED_KEY)).toBe('1')

    collapse()
    await nextTick()
    expect(window.localStorage.getItem(CHAT_SIDEBAR_COLLAPSED_KEY)).toBe('1')
  })

  it('768-991px 判定为抽屉，<768px 不渲染面板', () => {
    setWindowWidth(900)
    const drawer = useChatSidebar({ isGroup: ref(true) })
    expect(drawer.isDrawer.value).toBe(true)
    expect(drawer.isHidden.value).toBe(false)

    setWindowWidth(480)
    const single = useChatSidebar({ isGroup: ref(true) })
    expect(single.isDrawer.value).toBe(false)
    expect(single.isHidden.value).toBe(true)
    single.toggle()
    expect(single.panelClass.value).toBe('w-0 border-none')

    setWindowWidth(1280)
    const wide = useChatSidebar({ isGroup: ref(true) })
    expect(wide.isDrawer.value).toBe(false)
    expect(wide.isHidden.value).toBe(false)
  })

  it('抽屉模式展开时 isDrawerOpen 为 true，折叠后为 false', () => {
    setWindowWidth(900)
    const { isDrawerOpen, toggle } = useChatSidebar({ isGroup: ref(true) })

    expect(isDrawerOpen.value).toBe(false)
    toggle()
    expect(isDrawerOpen.value).toBe(true)
    toggle()
    expect(isDrawerOpen.value).toBe(false)
  })

  it('面板 class 在抽屉展开时为浮层，桌面展开时为常驻 240px', () => {
    setWindowWidth(900)
    const drawerPanel = useChatSidebar({ isGroup: ref(true) })
    drawerPanel.toggle()
    expect(drawerPanel.panelClass.value).toContain('fixed')
    expect(drawerPanel.panelClass.value).toContain('w-240px')

    window.localStorage.clear()
    setWindowWidth(1280)
    const widePanel = useChatSidebar({ isGroup: ref(true) })
    expect(widePanel.panelClass.value).toContain('w-240px')
    expect(widePanel.panelClass.value).not.toContain('fixed')
  })

  it('单聊不展示信息面板', () => {
    const { panelClass } = useChatSidebar({ isGroup: ref(false) })

    expect(panelClass.value).toBe('w-0 border-none')
  })

  it('桌面展开时内联宽度取自拖拽持久化结果，折叠后清空', () => {
    // 与 useRightPaneWidth 共用 tjg.rightPaneWidth 映射
    window.localStorage.setItem('tjg.rightPaneWidth', JSON.stringify({ chat: 320 }))
    setWindowWidth(1280)
    const panel = useChatSidebar({ isGroup: ref(true) })

    expect(panel.panelStyle.value).toEqual({ width: '320px', transition: undefined })

    panel.toggle()
    expect(panel.panelStyle.value).toBeUndefined()
  })

  it('抽屉与单栏模式不输出内联宽度', () => {
    setWindowWidth(900)
    const drawer = useChatSidebar({ isGroup: ref(true) })
    drawer.toggle()
    expect(drawer.panelStyle.value).toBeUndefined()

    setWindowWidth(480)
    const single = useChatSidebar({ isGroup: ref(true) })
    single.toggle()
    expect(single.panelStyle.value).toBeUndefined()
  })
})
