import { beforeEach, describe, expect, it } from 'vitest'
import type { SelectionRange } from '../../common/useCommon'
import { useCursorManager } from '../useCursorManager'

const makeSelectionRange = (): SelectionRange => {
  const range = document.createRange()
  return { range } as unknown as SelectionRange
}

describe('useCursorManager', () => {
  let container: HTMLDivElement

  beforeEach(() => {
    container = document.createElement('div')
    container.contentEditable = 'true'
    container.innerText = 'hello world'
    document.body.appendChild(container)
  })

  it('getCursorSelectionRange returns null before any update', () => {
    const { getCursorSelectionRange } = useCursorManager()
    expect(getCursorSelectionRange()).toBeNull()
  })

  it('updateSelectionRange stores and round-trips the value', () => {
    const { updateSelectionRange, getCursorSelectionRange } = useCursorManager()
    const sr = makeSelectionRange()
    updateSelectionRange(sr)
    expect(getCursorSelectionRange()).toBe(sr)
  })

  it('updateSelectionRange(null) clears the stored value', () => {
    const { updateSelectionRange, getCursorSelectionRange } = useCursorManager()
    updateSelectionRange(makeSelectionRange())
    updateSelectionRange(null)
    expect(getCursorSelectionRange()).toBeNull()
  })

  it('focusOn focuses the editor even without a stored range', () => {
    const { focusOn } = useCursorManager()
    focusOn(container)
    expect(document.activeElement).toBe(container)
  })

  it('focusOn restores the stored selection range onto the editor', () => {
    const { focusOn, updateSelectionRange } = useCursorManager()
    const sr = makeSelectionRange()
    sr.range.selectNodeContents(container)
    updateSelectionRange(sr)
    focusOn(container)
    expect(document.activeElement).toBe(container)
    const selection = window.getSelection()
    expect(selection?.rangeCount).toBeGreaterThan(0)
  })

  it('each invocation produces an isolated cursor state', () => {
    const a = useCursorManager()
    const b = useCursorManager()
    a.updateSelectionRange(makeSelectionRange())
    expect(b.getCursorSelectionRange()).toBeNull()
  })
})
