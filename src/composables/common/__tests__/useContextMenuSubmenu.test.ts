import { afterEach, describe, expect, it, vi } from 'vitest'
import { nextTick, ref } from 'vue'
import { useContextMenuSubmenu } from '../useContextMenuSubmenu'
import type { ContextMenuItem, MenuContent } from '../useContextMenuTypes'

const rect = (left: number, right: number, top: number, bottom: number) =>
  ({ left, right, top, bottom, width: right - left, height: bottom - top, x: left, y: top }) as DOMRect

const subItem = (label: string, click?: (content: MenuContent) => void): ContextMenuItem => ({
  label,
  icon: 'right',
  ...(click ? { click } : {})
})

const createParentItem = (id: string, className = 'menu-item') => {
  const el = document.createElement('div')
  el.id = id
  el.className = className
  el.tabIndex = -1
  el.getBoundingClientRect = () => rect(100, 200, 50, 80)
  return el
}

/**
 * 构造一个最小的真实 DOM：主菜单容器 + 子菜单容器。
 * 子菜单节点直接挂到 `submenuEl`，模拟模板渲染后的 ref 绑定。
 */
const createHarness = (
  options: {
    parentClassName?: string
    parentId?: string
    subLabels?: string[]
    clicks?: Array<(content: MenuContent) => void>
  } = {}
) => {
  const { parentClassName = 'menu-item', parentId = 'menu-item-0', subLabels = ['复制', '转发'], clicks = [] } = options

  const menuEl = document.createElement('div')
  menuEl.className = 'context-menu'
  const parent = createParentItem(parentId, parentClassName)
  menuEl.appendChild(parent)
  document.body.appendChild(menuEl)

  const submenu = document.createElement('div')
  submenu.className = 'context-submenu'
  const subItems = subLabels.map((label, index) => {
    const el = document.createElement('div')
    el.className = 'menu-item'
    el.tabIndex = -1
    el.textContent = label
    el.dataset.index = String(index)
    submenu.appendChild(el)
    return el
  })
  document.body.appendChild(submenu)

  const content = ref<MenuContent>({})
  const api = useContextMenuSubmenu({
    content,
    vw: ref(1440),
    vh: ref(900),
    menuEl: ref<HTMLElement | null>(menuEl)
  })
  api.submenuEl.value = submenu

  const parentItem: ContextMenuItem = {
    label: '更多',
    icon: 'right',
    children: subLabels.map((label, index) => subItem(label, clicks[index]))
  }

  return { api, content, parent, submenu, subItems, parentItem, menuEl }
}

const press = (key: string) => new KeyboardEvent('keydown', { key, cancelable: true, bubbles: true })

afterEach(() => {
  document.body.innerHTML = ''
})

describe('useContextMenuSubmenu 键盘交互', () => {
  it('键盘展开子菜单后焦点落在第一项', async () => {
    const { api, parentItem, subItems } = createHarness()

    expect(api.openSubmenuByKeyboard(parentItem, 0)).toBe(true)
    await nextTick()

    expect(api.showSubmenu.value).toBe(true)
    expect(api.focusedSubIndex.value).toBe(0)
    expect(document.activeElement).toBe(subItems[0])
  })

  it('ArrowDown / ArrowUp 在子项间循环移动焦点', async () => {
    const { api, parentItem, subItems } = createHarness({ subLabels: ['复制', '转发', '删除'] })
    api.openSubmenuByKeyboard(parentItem, 0)
    await nextTick()

    api.handleSubmenuKeydown(press('ArrowDown'))
    await nextTick()
    expect(document.activeElement).toBe(subItems[1])

    api.handleSubmenuKeydown(press('ArrowDown'))
    await nextTick()
    expect(document.activeElement).toBe(subItems[2])

    api.handleSubmenuKeydown(press('ArrowDown'))
    await nextTick()
    expect(document.activeElement).toBe(subItems[0])

    api.handleSubmenuKeydown(press('ArrowUp'))
    await nextTick()
    expect(document.activeElement).toBe(subItems[2])
  })

  it('Escape 收起子菜单并把焦点还给主菜单项', async () => {
    const { api, parentItem, parent } = createHarness()
    api.openSubmenuByKeyboard(parentItem, 0)
    await nextTick()

    const event = press('Escape')
    api.handleSubmenuKeydown(event)
    await nextTick()

    expect(api.showSubmenu.value).toBe(false)
    expect(event.defaultPrevented).toBe(true)
    expect(document.activeElement).toBe(parent)
  })

  it('ArrowLeft 收起子菜单并把焦点还给主菜单项', async () => {
    const { api, parentItem, parent } = createHarness()
    api.openSubmenuByKeyboard(parentItem, 0)
    await nextTick()

    api.handleSubmenuKeydown(press('ArrowLeft'))
    await nextTick()

    expect(api.showSubmenu.value).toBe(false)
    expect(document.activeElement).toBe(parent)
  })

  it('Enter 触发子项 click 并收起子菜单', async () => {
    const click = vi.fn()
    const { api, parentItem, parent } = createHarness({ clicks: [click] })
    api.openSubmenuByKeyboard(parentItem, 0)
    await nextTick()

    api.handleSubmenuKeydown(press('Enter'))
    await nextTick()

    expect(click).toHaveBeenCalledTimes(1)
    expect(api.showSubmenu.value).toBe(false)
    expect(document.activeElement).toBe(parent)
  })

  it('无 children 的菜单项键盘展开不生效', () => {
    const { api } = createHarness()
    const plainItem: ContextMenuItem = { label: '复制', icon: 'right' }

    expect(api.openSubmenuByKeyboard(plainItem, 0)).toBe(false)
    expect(api.showSubmenu.value).toBe(false)
  })

  it('子菜单关闭后键盘事件不再生效', async () => {
    const { api, parentItem, subItems } = createHarness()
    api.openSubmenuByKeyboard(parentItem, 0)
    await nextTick()
    api.closeSubmenu()
    await nextTick()

    api.handleSubmenuKeydown(press('ArrowDown'))
    await nextTick()
    expect(document.activeElement).not.toBe(subItems[1])
  })

  it('按 index 定位时跳过禁用项，不被 .menu-item 列表错位', () => {
    const menuEl = document.createElement('div')
    menuEl.className = 'context-menu'
    const disabled = createParentItem('menu-item-0', 'menu-item-disabled')
    disabled.getBoundingClientRect = () => rect(0, 50, 10, 40)
    const enabled = createParentItem('menu-item-1')
    enabled.getBoundingClientRect = () => rect(300, 400, 50, 80)
    menuEl.append(disabled, enabled)
    document.body.appendChild(menuEl)

    const api = useContextMenuSubmenu({
      content: ref<MenuContent>({}),
      vw: ref(1440),
      vh: ref(900),
      menuEl: ref<HTMLElement | null>(menuEl)
    })

    api.handleMouseEnter({ label: '更多', icon: 'right', children: [subItem('复制')] }, 1)

    // 右侧无溢出时菜单出现在目标项右侧：300 + 100 + 5
    expect(api.submenuPosition.value.left).toBe('405px')
  })
})
