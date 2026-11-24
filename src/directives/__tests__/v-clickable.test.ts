import { describe, expect, it, vi } from 'vitest'
import type { DirectiveBinding } from 'vue'
import vClickable from '../v-clickable'

type ClickableOptions = { label?: string; disabled?: boolean }

function bind(value?: ClickableOptions | string): DirectiveBinding<ClickableOptions | string | undefined> {
  return { value } as DirectiveBinding<ClickableOptions | string | undefined>
}

function mount(el: Element, value?: ClickableOptions | string) {
  vClickable.mounted(el, bind(value))
}

function press(el: Element, key: string) {
  el.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true }))
}

function createSvg(): SVGElement {
  return document.createElementNS('http://www.w3.org/2000/svg', 'svg')
}

describe('v-clickable', () => {
  it('给 HTML 容器补 role / tabindex / aria-disabled', () => {
    const el = document.createElement('div')
    mount(el)
    expect(el.getAttribute('role')).toBe('button')
    expect(el.getAttribute('tabindex')).toBe('0')
    expect(el.getAttribute('aria-disabled')).toBe('false')
  })

  it('传字符串时写入 aria-label', () => {
    const el = document.createElement('div')
    mount(el, '关闭')
    expect(el.getAttribute('aria-label')).toBe('关闭')
  })

  it('Enter 与 Space 都派发 click', () => {
    const el = document.createElement('div')
    const onClick = vi.fn()
    el.addEventListener('click', onClick)
    mount(el)

    press(el, 'Enter')
    press(el, ' ')
    expect(onClick).toHaveBeenCalledTimes(2)
  })

  it('其它按键不派发 click', () => {
    const el = document.createElement('div')
    const onClick = vi.fn()
    el.addEventListener('click', onClick)
    mount(el)

    press(el, 'a')
    press(el, 'Escape')
    expect(onClick).not.toHaveBeenCalled()
  })

  it('disabled 时 tabindex=-1 且键盘不触发', () => {
    const el = document.createElement('div')
    const onClick = vi.fn()
    el.addEventListener('click', onClick)
    mount(el, { disabled: true })

    expect(el.getAttribute('tabindex')).toBe('-1')
    expect(el.getAttribute('aria-disabled')).toBe('true')
    press(el, 'Enter')
    expect(onClick).not.toHaveBeenCalled()
  })

  it('<svg> 上可用：补 tabindex 且 Enter 派发 click', () => {
    // 回归点：click() 定义在 HTMLElement 上，SVGElement 继承的是 Element。
    // 早期实现直接 el.click()，在 <svg> 上会抛 TypeError（表现为"按 Enter 没反应 + 控制台报错"）。
    const svg = createSvg()
    const onClick = vi.fn()
    svg.addEventListener('click', onClick)
    mount(svg)

    expect(svg.getAttribute('tabindex')).toBe('0')
    expect(svg.getAttribute('role')).toBe('button')

    press(svg, 'Enter')
    expect(onClick).toHaveBeenCalledTimes(1)
  })

  it('<svg> 在 click() 不可用时走 dispatchEvent 兜底', () => {
    // 直接抹掉 click 能力，强制走兜底分支 —— 这条用例存在的意义是：
    // 不管 happy-dom 有没有给 SVGElement 实现 click()，兜底分支都必须真实可用。
    const svg = createSvg()
    ;(svg as unknown as { click?: unknown }).click = undefined
    const onClick = vi.fn()
    svg.addEventListener('click', onClick)
    mount(svg)

    expect(() => press(svg, ' ')).not.toThrow()
    expect(onClick).toHaveBeenCalledTimes(1)
  })

  it('unmounted 后键盘不再触发', () => {
    const el = document.createElement('div')
    const onClick = vi.fn()
    el.addEventListener('click', onClick)
    mount(el)

    vClickable.unmounted(el)
    press(el, 'Enter')
    expect(onClick).not.toHaveBeenCalled()
  })
})
