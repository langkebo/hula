import type { DirectiveBinding } from 'vue'

/**
 * v-clickable：为无法改为 <button> 的容器元素补齐键盘与语义能力。
 *
 * 使用方式：
 * - `v-clickable`：补 role="button" + tabindex="0"，Enter/Space 派发 click；
 * - `v-clickable="'aria-label 文本'"`：额外写入 aria-label；
 * - `v-clickable="{ label: '文本', disabled: true }"`：带标签与禁用态。
 *
 * 可用于 div/span 等 HTML 容器，**也可用于 `<svg>`**：SVGElement 没有 `click()`，
 * 指令内部按能力探测走 dispatchEvent（详见 `activate()`）。
 *
 * 仅用于既有 `@click` 的 div/span 等非语义容器，新代码优先使用 <button>。
 */
type ClickableOptions = {
  label?: string
  disabled?: boolean
}

type ClickableElement = Element & {
  /**
   * 存 `EventListener` 而不是 `(e: KeyboardEvent) => void`：
   * `Element` 的 `addEventListener` 没有 `keydown` 这条重载（只有 HTMLElement 有），
   * 声明成 KeyboardEvent 会落到 `EventListenerOrEventListenerObject` 重载并被判不兼容。
   * 统一按 Event 存，函数体内再窄化。
   */
  __tjgClickableKeydown__?: EventListener
  __tjgClickablePrevTabindex__?: string | null
  __tjgClickablePrevRole__?: string | null
}

/**
 * 触发一次"点击"。
 *
 * ⚠️ `click()` 定义在 **HTMLElement** 上，`SVGElement` 继承的是 `Element`，没有这个方法。
 * 直接 `el.click()` 在 `<svg>` 上会抛 `TypeError: el.click is not a function`，
 * 而它又是挂在 `keydown` 里的 —— 表现为"按 Enter 没反应 + 控制台报错"，很容易被当成没实现。
 * 所以这里按能力探测，非 HTMLElement 走 dispatchEvent。
 */
function activate(el: Element): void {
  const maybeClickable = el as HTMLElement
  if (typeof maybeClickable.click === 'function') {
    maybeClickable.click()
    return
  }
  el.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }))
}

function resolveOptions(binding: DirectiveBinding<ClickableOptions | string | undefined>): ClickableOptions {
  const value = binding.value
  if (typeof value === 'string') return { label: value }
  return value ?? {}
}

function applySemantics(el: ClickableElement, options: ClickableOptions) {
  if (!el.__tjgClickablePrevRole__ && el.__tjgClickablePrevRole__ !== '') {
    el.__tjgClickablePrevRole__ = el.getAttribute('role')
  }
  if (!el.__tjgClickablePrevTabindex__) {
    el.__tjgClickablePrevTabindex__ = el.getAttribute('tabindex')
  }

  el.setAttribute('role', 'button')
  el.setAttribute('tabindex', options.disabled ? '-1' : '0')
  el.setAttribute('aria-disabled', options.disabled ? 'true' : 'false')
  if (options.label) el.setAttribute('aria-label', options.label)

  if (!el.__tjgClickableKeydown__) {
    el.__tjgClickableKeydown__ = (event: Event) => {
      const key = (event as KeyboardEvent).key
      if (key !== 'Enter' && key !== ' ') return
      // 避免触发页面滚动
      event.preventDefault()
      if (el.getAttribute('aria-disabled') === 'true') return
      activate(el)
    }
    el.addEventListener('keydown', el.__tjgClickableKeydown__)
  }
}

export default {
  mounted(el: Element, binding: DirectiveBinding<ClickableOptions | string | undefined>) {
    applySemantics(el as ClickableElement, resolveOptions(binding))
  },
  updated(el: Element, binding: DirectiveBinding<ClickableOptions | string | undefined>) {
    applySemantics(el as ClickableElement, resolveOptions(binding))
  },
  unmounted(el: Element) {
    const node = el as ClickableElement
    if (node.__tjgClickableKeydown__) {
      node.removeEventListener('keydown', node.__tjgClickableKeydown__)
      delete node.__tjgClickableKeydown__
    }
  }
}
