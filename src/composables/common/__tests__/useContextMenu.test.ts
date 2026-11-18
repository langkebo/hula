import { mount } from '@vue/test-utils'
import { afterEach, describe, expect, it } from 'vitest'
import { defineComponent, ref } from 'vue'
import { useContextMenu } from '../useContextMenu'

type ContextMenuApi = ReturnType<typeof useContextMenu>

const mountHarness = () => {
  const Harness = defineComponent({
    template: `
      <div ref="root">
        <div id="row" tabindex="0"><span id="label">会话标题</span></div>
        <button id="btn" type="button">按钮</button>
      </div>
    `,
    setup() {
      const root = ref<HTMLElement | null>(null)
      const menu = useContextMenu(root)
      return { root, menu }
    }
  })
  const wrapper = mount(Harness, { attachTo: document.body })
  const menu = (wrapper.vm as unknown as { menu: ContextMenuApi }).menu
  return { wrapper, menu }
}

const rightClick = (target: HTMLElement) => {
  const event = new MouseEvent('contextmenu', { bubbles: true, cancelable: true, clientX: 20, clientY: 30 })
  target.dispatchEvent(event)
  return event
}

afterEach(() => {
  document.body.innerHTML = ''
})

describe('useContextMenu 触发元素焦点回收', () => {
  it('右键点击行内文本时记录可聚焦祖先作为 opener', () => {
    const { wrapper, menu } = mountHarness()
    const row = wrapper.find('#row').element as HTMLElement
    const label = wrapper.find('#label').element as HTMLElement

    menu.handleContextMenu(rightClick(label))

    expect(menu.showMenu.value).toBe(true)
    menu.restoreOpenerFocus()
    expect(document.activeElement).toBe(row)
  })

  it('关闭后 trigger 已卸载时放弃回收，焦点不落到 body 之外的残留节点', () => {
    const { wrapper, menu } = mountHarness()
    const row = wrapper.find('#row').element as HTMLElement

    menu.handleContextMenu(rightClick(row))
    row.remove()
    menu.restoreOpenerFocus()

    expect(row.isConnected).toBe(false)
    expect(document.activeElement).not.toBe(row)
  })

  it('opener 是按钮时关闭后焦点回到按钮', () => {
    const { wrapper, menu } = mountHarness()
    const btn = wrapper.find('#btn').element as HTMLElement

    menu.handleContextMenu(rightClick(btn))
    menu.restoreOpenerFocus()

    expect(document.activeElement).toBe(btn)
  })
})
