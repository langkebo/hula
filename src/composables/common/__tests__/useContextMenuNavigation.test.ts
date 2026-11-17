import { describe, expect, it, vi } from 'vitest'
import { ref } from 'vue'
import { useContextMenuNavigation } from '../useContextMenuNavigation'
import type { ContextMenuItem } from '../useContextMenuTypes'

const menuItem = (label: string, disabled?: ContextMenuItem['disabled']): ContextMenuItem => ({
  label,
  icon: 'right',
  ...(disabled === undefined ? {} : { disabled })
})

/** 与 ContextMenu.vue 一致：把函数式 disabled 按当前 content 解析 */
const resolveDisabled = (item: ContextMenuItem, content: unknown): boolean =>
  typeof item.disabled === 'function'
    ? Boolean((item.disabled as (value: unknown) => boolean)(content))
    : item.disabled === true

const createHarness = (
  menu: ContextMenuItem[],
  special: ContextMenuItem[] = [],
  content: unknown = {},
  withResolver = true
) => {
  const visibleMenu = ref(menu)
  const visibleSpecialMenu = ref(special)
  const showMenu = ref(true)
  const onSelect = vi.fn()
  const navigation = useContextMenuNavigation({
    visibleMenu,
    visibleSpecialMenu,
    showMenu,
    onSelect,
    isItemDisabled: withResolver ? (item) => resolveDisabled(item, content) : undefined
  })
  return { ...navigation, showMenu, onSelect }
}

const press = (key: string) => {
  const event = new KeyboardEvent('keydown', { key, cancelable: true })
  return event
}

describe('useContextMenuNavigation', () => {
  it('ArrowDown 从初始态聚焦第一个可用项', () => {
    const { focusedIndex, handleMenuKeydown } = createHarness([menuItem('回复'), menuItem('复制')])
    handleMenuKeydown(press('ArrowDown'))
    expect(focusedIndex.value).toBe(0)
  })

  it('ArrowDown 跳过静态禁用项', () => {
    const { focusedIndex, handleMenuKeydown } = createHarness([menuItem('回复', true), menuItem('复制')])
    handleMenuKeydown(press('ArrowDown'))
    expect(focusedIndex.value).toBe(1)
  })

  it('ArrowDown 不得跳过函数式 disabled 判定为可用的项', () => {
    const { focusedIndex, handleMenuKeydown } = createHarness([menuItem('回复', () => false), menuItem('复制')])
    handleMenuKeydown(press('ArrowDown'))
    expect(focusedIndex.value).toBe(0)
  })

  it('ArrowDown 跳过函数式 disabled 判定为禁用的项', () => {
    const { focusedIndex, handleMenuKeydown } = createHarness([menuItem('撤回', () => true), menuItem('复制')])
    handleMenuKeydown(press('ArrowDown'))
    expect(focusedIndex.value).toBe(1)
  })

  it('ArrowUp 从末尾回环并跳过禁用项', () => {
    const { focusedIndex, handleMenuKeydown } = createHarness([
      menuItem('回复'),
      menuItem('转发'),
      menuItem('删除', true)
    ])
    handleMenuKeydown(press('ArrowUp'))
    expect(focusedIndex.value).toBe(1)
  })

  it('ArrowDown 到达末尾后回环到首项', () => {
    const { focusedIndex, handleMenuKeydown } = createHarness([menuItem('回复'), menuItem('复制')])
    handleMenuKeydown(press('ArrowDown'))
    handleMenuKeydown(press('ArrowDown'))
    handleMenuKeydown(press('ArrowDown'))
    expect(focusedIndex.value).toBe(0)
  })

  it('Enter 触发当前聚焦项，且阻止默认行为', () => {
    const { handleMenuKeydown, onSelect } = createHarness([menuItem('回复'), menuItem('复制')])
    handleMenuKeydown(press('ArrowDown'))
    const enter = press('Enter')
    handleMenuKeydown(enter)
    expect(onSelect).toHaveBeenCalledTimes(1)
    expect(onSelect.mock.calls[0]?.[0]?.label).toBe('回复')
    expect(enter.defaultPrevented).toBe(true)
  })

  it('未聚焦任何项时 Enter 不触发选择', () => {
    const { handleMenuKeydown, onSelect } = createHarness([menuItem('回复')])
    handleMenuKeydown(press('Enter'))
    expect(onSelect).not.toHaveBeenCalled()
  })

  it('Escape 关闭菜单', () => {
    const { handleMenuKeydown, showMenu } = createHarness([menuItem('回复')])
    handleMenuKeydown(press('Escape'))
    expect(showMenu.value).toBe(false)
  })

  it('全部项禁用时保持未聚焦且不抛错', () => {
    const { focusedIndex, handleMenuKeydown } = createHarness([menuItem('回复', true), menuItem('复制', true)])
    handleMenuKeydown(press('ArrowDown'))
    expect(focusedIndex.value).toBe(-1)
    handleMenuKeydown(press('ArrowUp'))
    expect(focusedIndex.value).toBe(-1)
  })

  it('空菜单键盘事件不抛错', () => {
    const { focusedIndex, handleMenuKeydown, onSelect, showMenu } = createHarness([])
    handleMenuKeydown(press('ArrowDown'))
    handleMenuKeydown(press('Enter'))
    expect(focusedIndex.value).toBe(-1)
    expect(onSelect).not.toHaveBeenCalled()
    handleMenuKeydown(press('Escape'))
    expect(showMenu.value).toBe(false)
  })

  it('扩展项参与同一套索引（常规项之后）', () => {
    const { focusedIndex, handleMenuKeydown } = createHarness([menuItem('回复')], [menuItem('删除')])
    handleMenuKeydown(press('ArrowDown'))
    handleMenuKeydown(press('ArrowDown'))
    expect(focusedIndex.value).toBe(1)
  })

  it('未注入解析器时仅静态布尔视为禁用', () => {
    const { focusedIndex, handleMenuKeydown } = createHarness(
      [menuItem('撤回', () => true), menuItem('复制')],
      [],
      {},
      false
    )
    handleMenuKeydown(press('ArrowDown'))
    expect(focusedIndex.value).toBe(0)
  })
})
