import { describe, expect, it } from 'vitest'
import { resolveLongPressMenuTop } from '../longPressPosition'

describe('resolveLongPressMenuTop', () => {
  it('uses the original anchor offset when there is room below', () => {
    expect(
      resolveLongPressMenuTop({ anchorTop: 200, anchorHeight: 68, menuHeight: 300, viewportHeight: 667 })
    ).toBeCloseTo(177.33, 1)
  })

  it('clamps to the bottom edge for the last rows', () => {
    expect(resolveLongPressMenuTop({ anchorTop: 640, anchorHeight: 68, menuHeight: 300, viewportHeight: 667 })).toBe(
      359
    )
  })

  it('never returns a negative top when the menu is taller than the viewport', () => {
    expect(resolveLongPressMenuTop({ anchorTop: 10, anchorHeight: 68, menuHeight: 900, viewportHeight: 667 })).toBe(8)
  })
})
