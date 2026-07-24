import type { DirectiveBinding } from 'vue'

const HANDLER_KEY = Symbol('rippleHandler')

type RippleHandler = (e: PointerEvent) => void

function createRipple(el: HTMLElement, e: PointerEvent) {
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return

  const rect = el.getBoundingClientRect()
  const size = Math.max(rect.width, rect.height)
  const ripple = document.createElement('span')
  ripple.style.cssText = `
    position: absolute; width: ${size}px; height: ${size}px;
    left: ${e.clientX - rect.left - size / 2}px;
    top: ${e.clientY - rect.top - size / 2}px;
    border-radius: 50%; background: currentColor; opacity: 0.3;
    transform: scale(0); pointer-events: none;
    transition: transform 300ms var(--hula-motion-ease-standard);
  `
  el.appendChild(ripple)
  requestAnimationFrame(() => {
    ripple.style.transform = 'scale(2.5)'
  })
  setTimeout(() => ripple.remove(), 300)
}

export default {
  mounted(el: HTMLElement, _binding: DirectiveBinding) {
    const handler: RippleHandler = (e: PointerEvent) => {
      createRipple(el, e)
    }
    el.addEventListener('pointerdown', handler as EventListener)
    ;(el as unknown as Record<symbol, RippleHandler>)[HANDLER_KEY] = handler
  },
  unmounted(el: HTMLElement) {
    const handler = (el as unknown as Record<symbol, RippleHandler | undefined>)[HANDLER_KEY]
    if (handler) {
      el.removeEventListener('pointerdown', handler as EventListener)
    }
  }
}
