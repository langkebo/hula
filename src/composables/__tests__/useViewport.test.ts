import { describe, expect, it } from 'vitest'
import { useViewport } from '@/composables/common/useViewport'

describe('useViewport', () => {
  it('returns refs for current viewport width and height', () => {
    const { vw, vh } = useViewport()
    expect(typeof vw.value).toBe('number')
    expect(typeof vh.value).toBe('number')
    expect(vw.value).toBe(document.documentElement.clientWidth)
    expect(vh.value).toBe(document.documentElement.clientHeight)
  })

  it('returns the same ref instances across calls (module-level state)', () => {
    const a = useViewport()
    const b = useViewport()
    expect(a.vw).toBe(b.vw)
    expect(a.vh).toBe(b.vh)
  })

  it('updates vw/vh when window dispatches resize', () => {
    const { vw, vh } = useViewport()
    Object.defineProperty(document.documentElement, 'clientWidth', {
      configurable: true,
      get: () => 1234
    })
    Object.defineProperty(document.documentElement, 'clientHeight', {
      configurable: true,
      get: () => 567
    })
    window.dispatchEvent(new Event('resize'))
    expect(vw.value).toBe(1234)
    expect(vh.value).toBe(567)
  })
})
