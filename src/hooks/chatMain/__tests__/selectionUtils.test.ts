import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import {
  clearSelection,
  extractMsgIdFromDataKey,
  getSelectedText,
  hasSelectedText,
  resolveSelectionMessageId
} from '../selectionUtils'

describe('extractMsgIdFromDataKey', () => {
  it('returns empty string for null/undefined', () => {
    expect(extractMsgIdFromDataKey(null)).toBe('')
    expect(extractMsgIdFromDataKey(undefined)).toBe('')
    expect(extractMsgIdFromDataKey('')).toBe('')
  })

  it('strips a single leading letter', () => {
    expect(extractMsgIdFromDataKey('T1700000000')).toBe('1700000000')
    expect(extractMsgIdFromDataKey('m-abc123')).toBe('-abc123')
  })

  it('leaves all-digit input untouched', () => {
    expect(extractMsgIdFromDataKey('42')).toBe('42')
  })
})

const makeSelection = (anchor: Node | null, focus: Node | null, text = ''): Selection => {
  return {
    anchorNode: anchor,
    focusNode: focus,
    rangeCount: anchor ? 1 : 0,
    toString: () => text,
    removeAllRanges: () => undefined
  } as unknown as Selection
}

describe('resolveSelectionMessageId', () => {
  let container: HTMLElement

  beforeEach(() => {
    container = document.createElement('div')
    container.id = 'image-chat-main'
    document.body.appendChild(container)
  })

  afterEach(() => {
    container.remove()
  })

  it('returns "" when anchor and focus lack a common data-key ancestor', () => {
    const a = document.createElement('span')
    a.textContent = 'x'
    container.appendChild(a)
    const sel = makeSelection(a.firstChild, a.firstChild)
    expect(resolveSelectionMessageId(sel)).toBe('')
  })

  it('returns the stripped msgId when anchor/focus share a bubble', () => {
    const bubble = document.createElement('div')
    bubble.setAttribute('data-key', 'T1234')
    const text = document.createTextNode('hello')
    bubble.appendChild(text)
    container.appendChild(bubble)
    const sel = makeSelection(text, text)
    expect(resolveSelectionMessageId(sel)).toBe('1234')
  })

  it('returns "" when endpoints straddle two bubbles', () => {
    const b1 = document.createElement('div')
    b1.setAttribute('data-key', 'T1')
    const t1 = document.createTextNode('one')
    b1.appendChild(t1)
    const b2 = document.createElement('div')
    b2.setAttribute('data-key', 'T2')
    const t2 = document.createTextNode('two')
    b2.appendChild(t2)
    container.append(b1, b2)
    const sel = makeSelection(t1, t2)
    expect(resolveSelectionMessageId(sel)).toBe('')
  })

  it('returns "" when the bubble is outside the chat root', () => {
    const outside = document.createElement('div')
    outside.setAttribute('data-key', 'T9')
    const text = document.createTextNode('x')
    outside.appendChild(text)
    document.body.appendChild(outside)
    try {
      const sel = makeSelection(text, text)
      expect(resolveSelectionMessageId(sel)).toBe('')
    } finally {
      outside.remove()
    }
  })

  it('returns "" when anchor is null', () => {
    const sel = makeSelection(null, null)
    expect(resolveSelectionMessageId(sel)).toBe('')
  })
})

describe('getSelectedText / hasSelectedText / clearSelection', () => {
  let container: HTMLElement

  beforeEach(() => {
    container = document.createElement('div')
    container.id = 'image-chat-main'
    document.body.appendChild(container)
  })

  afterEach(() => {
    container.remove()
    window.getSelection()?.removeAllRanges()
  })

  it('returns the selection text when inside a single bubble', () => {
    const bubble = document.createElement('div')
    bubble.setAttribute('data-key', 'Tabc')
    bubble.textContent = 'hello world'
    container.appendChild(bubble)

    const sel = window.getSelection()!
    const range = document.createRange()
    range.selectNodeContents(bubble)
    sel.removeAllRanges()
    sel.addRange(range)

    expect(getSelectedText()).toBe('hello world')
    expect(hasSelectedText()).toBe(true)
  })

  it('returns "" and hasSelectedText false when selection mismatches the passed messageId', () => {
    const bubble = document.createElement('div')
    bubble.setAttribute('data-key', 'Tabc')
    bubble.textContent = 'x'
    container.appendChild(bubble)
    const sel = window.getSelection()!
    const range = document.createRange()
    range.selectNodeContents(bubble)
    sel.removeAllRanges()
    sel.addRange(range)
    expect(getSelectedText('other')).toBe('')
    expect(hasSelectedText('other')).toBe(false)
  })

  it('clearSelection removes all ranges', () => {
    const bubble = document.createElement('div')
    bubble.setAttribute('data-key', 'Tabc')
    bubble.textContent = 'x'
    container.appendChild(bubble)
    const sel = window.getSelection()!
    const range = document.createRange()
    range.selectNodeContents(bubble)
    sel.removeAllRanges()
    sel.addRange(range)
    expect(sel.rangeCount).toBe(1)
    clearSelection()
    expect(window.getSelection()?.rangeCount).toBe(0)
  })
})
