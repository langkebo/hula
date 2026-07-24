import { afterEach, describe, expect, it, vi } from 'vitest'
import vRipple from '../v-ripple'

describe('v-ripple', () => {
  afterEach(() => {
    vi.useRealTimers()
    document.body.innerHTML = ''
  })

  const createButton = () => {
    const el = document.createElement('button')
    el.getBoundingClientRect = () =>
      ({
        left: 0,
        top: 0,
        width: 100,
        height: 40,
        right: 100,
        bottom: 40,
        x: 0,
        y: 0,
        toJSON: () => ({})
      }) as DOMRect
    document.body.appendChild(el)
    return el
  }

  it('pointerdown 时在元素内创建涟漪 span', () => {
    const el = createButton()
    vRipple.mounted?.(el, {} as never)

    el.dispatchEvent(new PointerEvent('pointerdown', { clientX: 50, clientY: 20 }))

    const ripple = el.querySelector('span')
    expect(ripple).toBeTruthy()
  })

  it('涟漪 span 样式不影响布局且不拦截事件', () => {
    const el = createButton()
    vRipple.mounted?.(el, {} as never)

    el.dispatchEvent(new PointerEvent('pointerdown', { clientX: 50, clientY: 20 }))

    const ripple = el.querySelector('span') as HTMLSpanElement
    expect(ripple.style.position).toBe('absolute')
    expect(ripple.style.pointerEvents).toBe('none')
    expect(ripple.style.borderRadius).toBe('50%')
  })

  it('prefers-reduced-motion: reduce 时不创建涟漪', () => {
    const matchMediaSpy = vi.spyOn(window, 'matchMedia').mockImplementation((query) => ({
      matches: query === '(prefers-reduced-motion: reduce)',
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn()
    }))

    const el = createButton()
    vRipple.mounted?.(el, {} as never)

    el.dispatchEvent(new PointerEvent('pointerdown', { clientX: 50, clientY: 20 }))

    expect(el.querySelector('span')).toBeNull()

    matchMediaSpy.mockRestore()
  })

  it('动画结束后涟漪 span 被移除', () => {
    vi.useFakeTimers()
    const el = createButton()
    vRipple.mounted?.(el, {} as never)

    el.dispatchEvent(new PointerEvent('pointerdown', { clientX: 50, clientY: 20 }))
    expect(el.querySelector('span')).toBeTruthy()

    vi.advanceTimersByTime(300)

    expect(el.querySelector('span')).toBeNull()
  })

  it('unmounted 后 pointerdown 不再创建涟漪', () => {
    const el = createButton()
    vRipple.mounted?.(el, {} as never)
    vRipple.unmounted?.(el)

    el.dispatchEvent(new PointerEvent('pointerdown', { clientX: 50, clientY: 20 }))

    expect(el.querySelector('span')).toBeNull()
  })
})
