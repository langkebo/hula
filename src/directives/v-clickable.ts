import type { DirectiveBinding } from 'vue'

/**
 * v-clickable：为无法改为 <button> 的容器元素补齐键盘与语义能力。
 *
 * 使用方式：
 * - `v-clickable`：补 role="button" + tabindex="0"，Enter/Space 派发 click；
 * - `v-clickable="'aria-label 文本'"`：额外写入 aria-label；
 * - `v-clickable="{ label: '文本', disabled: true }"`：带标签与禁用态。
 *
 * 仅用于既有 `@click` 的 div/span 等非语义容器，新代码优先使用 <button>。
 */
type ClickableOptions = {
  label?: string
  disabled?: boolean
}

type ClickableElement = HTMLElement & {
  __tjgClickableKeydown__?: (e: KeyboardEvent) => void
  __tjgClickablePrevTabindex__?: string | null
  __tjgClickablePrevRole__?: string | null
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
    el.__tjgClickableKeydown__ = (event: KeyboardEvent) => {
      if (event.key !== 'Enter' && event.key !== ' ') return
      // 避免触发页面滚动
      event.preventDefault()
      if (el.getAttribute('aria-disabled') === 'true') return
      el.click()
    }
    el.addEventListener('keydown', el.__tjgClickableKeydown__)
  }
}

export default {
  mounted(el: HTMLElement, binding: DirectiveBinding<ClickableOptions | string | undefined>) {
    applySemantics(el as ClickableElement, resolveOptions(binding))
  },
  updated(el: HTMLElement, binding: DirectiveBinding<ClickableOptions | string | undefined>) {
    applySemantics(el as ClickableElement, resolveOptions(binding))
  },
  unmounted(el: HTMLElement) {
    const node = el as ClickableElement
    if (node.__tjgClickableKeydown__) {
      node.removeEventListener('keydown', node.__tjgClickableKeydown__)
      delete node.__tjgClickableKeydown__
    }
  }
}
