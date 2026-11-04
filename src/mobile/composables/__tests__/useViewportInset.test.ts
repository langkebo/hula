import { describe, expect, it } from 'vitest'
import { computeKeyboardInset } from '../useViewportInset'

describe('computeKeyboardInset', () => {
  it('键盘收起时为 0', () => {
    expect(computeKeyboardInset(800, 800, 0)).toBe(0)
  })

  it('键盘弹出时返回被遮挡高度', () => {
    expect(computeKeyboardInset(800, 500, 0)).toBe(300)
  })

  it('visualViewport 有 offsetTop 时扣除偏移', () => {
    expect(computeKeyboardInset(800, 500, 50)).toBe(250)
  })

  it('取整且不为负', () => {
    expect(computeKeyboardInset(800, 499.4, 0)).toBe(301)
    expect(computeKeyboardInset(800, 900, 0)).toBe(0)
  })
})
