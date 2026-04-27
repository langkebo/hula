import { describe, it, expect, vi, beforeEach } from 'vitest'
import { ref } from 'vue'
import { getEditorRange, getMessageContentType, triggerInputEvent } from '../editorDomBasics'
import { MsgEnum } from '@/enums'

describe('getEditorRange', () => {
  beforeEach(() => {
    document.body.innerHTML = ''
    window.getSelection()?.removeAllRanges()
  })

  it('returns null when window.getSelection is unavailable', () => {
    const original = window.getSelection
    ;(window as any).getSelection = undefined
    expect(getEditorRange()).toBeNull()
    ;(window as any).getSelection = original
  })

  it('returns the current range when one is already selected', () => {
    const div = document.createElement('div')
    div.textContent = 'hello'
    document.body.appendChild(div)
    const range = document.createRange()
    range.selectNodeContents(div)
    const sel = window.getSelection()!
    sel.removeAllRanges()
    sel.addRange(range)

    const result = getEditorRange()
    expect(result).not.toBeNull()
    expect(result!.range.startContainer).toBe(div)
  })

  it('falls back to caret-at-end of #message-input when no selection exists', () => {
    const input = document.createElement('div')
    input.id = 'message-input'
    input.textContent = 'abc'
    document.body.appendChild(input)

    const result = getEditorRange()
    expect(result).not.toBeNull()
    // collapsed at the end
    expect(result!.range.collapsed).toBe(true)
  })

  it('returns null when no selection exists and #message-input is missing', () => {
    expect(getEditorRange()).toBeNull()
  })
})

describe('getMessageContentType', () => {
  const wrap = (children: Node[]) => {
    const el = document.createElement('div')
    children.forEach((c) => el.appendChild(c))
    return ref(el)
  }

  const txt = (s: string) => document.createTextNode(s)
  const img = (dataset?: Record<string, string>) => {
    const el = document.createElement('img')
    if (dataset) for (const [k, v] of Object.entries(dataset)) el.dataset[k] = v
    return el
  }

  it('returns TEXT for empty editor', () => {
    expect(getMessageContentType(wrap([]))).toBe(MsgEnum.TEXT)
  })

  it('returns TEXT for plain text-only content', () => {
    expect(getMessageContentType(wrap([txt('hello')]))).toBe(MsgEnum.TEXT)
  })

  it('returns IMAGE for image-only content', () => {
    expect(getMessageContentType(wrap([img()]))).toBe(MsgEnum.IMAGE)
  })

  it('returns FILE when a file-canvas img is present (highest non-voice precedence)', () => {
    expect(getMessageContentType(wrap([txt('caption'), img({ type: 'file-canvas' })]))).toBe(MsgEnum.FILE)
  })

  it('returns EMOJI for emoji-only content', () => {
    expect(getMessageContentType(wrap([img({ type: 'emoji' })]))).toBe(MsgEnum.EMOJI)
  })

  it('returns MIXED when emoji is combined with text', () => {
    expect(getMessageContentType(wrap([txt('hi'), img({ type: 'emoji' })]))).toBe(MsgEnum.MIXED)
  })

  it('returns MIXED when image and text coexist', () => {
    expect(getMessageContentType(wrap([txt('caption'), img()]))).toBe(MsgEnum.MIXED)
  })

  it('returns VIDEO for <video> children', () => {
    const v = document.createElement('video')
    expect(getMessageContentType(wrap([v]))).toBe(MsgEnum.VIDEO)
  })

  it('returns VIDEO for <a href="*.mp4"> children', () => {
    const a = document.createElement('a')
    a.href = 'http://example.com/foo.mp4'
    expect(getMessageContentType(wrap([a]))).toBe(MsgEnum.VIDEO)
  })

  it('returns VOICE for the voice placeholder div', () => {
    const v = document.createElement('div')
    v.className = 'voice-message-placeholder'
    expect(getMessageContentType(wrap([v]))).toBe(MsgEnum.VOICE)
  })

  it('VOICE precedence beats FILE/VIDEO/IMAGE/MIXED', () => {
    const voice = document.createElement('div')
    voice.className = 'voice-message-placeholder'
    expect(getMessageContentType(wrap([txt('hi'), img(), voice]))).toBe(MsgEnum.VOICE)
  })

  it('whitespace-only text nodes are ignored', () => {
    expect(getMessageContentType(wrap([txt('   '), img()]))).toBe(MsgEnum.IMAGE)
  })
})

describe('triggerInputEvent', () => {
  it('dispatches a bubbling input event on the element', () => {
    const el = document.createElement('div')
    const listener = vi.fn()
    el.addEventListener('input', listener)
    triggerInputEvent(el)
    expect(listener).toHaveBeenCalledTimes(1)
    expect(listener.mock.calls[0][0].bubbles).toBe(true)
  })

  it('is a no-op when element is null/undefined', () => {
    expect(() => triggerInputEvent(null as any)).not.toThrow()
    expect(() => triggerInputEvent(undefined as any)).not.toThrow()
  })
})
