import { describe, expect, it } from 'vitest'
import { clampMenuPosition } from '../useContextMenuPosition'

const viewport = { vw: 375, vh: 667 }

describe('clampMenuPosition', () => {
  it('flips left from the anchor when the menu overflows right', () => {
    expect(clampMenuPosition({ x: 360, y: 100, w: 245, h: 300, ...viewport }).posX).toBe(115)
  })

  it('clamps to the left margin instead of going negative', () => {
    expect(clampMenuPosition({ x: 200, y: 100, w: 245, h: 300, ...viewport }).posX).toBe(8)
  })

  it('clamps to the bottom margin', () => {
    expect(clampMenuPosition({ x: 10, y: 600, w: 200, h: 300, ...viewport }).posY).toBe(359)
  })

  it('keeps the top-left margin when the menu is larger than the viewport', () => {
    const { posX, posY } = clampMenuPosition({ x: 0, y: 0, w: 500, h: 900, ...viewport })
    expect(posX).toBe(8)
    expect(posY).toBe(8)
  })
})
