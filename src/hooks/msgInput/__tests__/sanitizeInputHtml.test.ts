import { describe, expect, it } from 'vitest'
import {
  applySanitizedMessageInputHtml,
  getPlainTextFromSanitizedHtml,
  sanitizeMessageInputHtml
} from '../sanitizeInputHtml'

describe('sanitizeMessageInputHtml', () => {
  it('removes dangerous tags and attributes', () => {
    const sanitized = sanitizeMessageInputHtml(
      '<div onclick="alert(1)">hi<script>alert(1)</script><img src="x" onerror="alert(1)" /></div>'
    )

    expect(sanitized).toContain('<div>hi<img src="x"></div>')
    expect(sanitized).not.toContain('script')
    expect(sanitized).not.toContain('onclick')
    expect(sanitized).not.toContain('onerror')
  })

  it('preserves editor-specific attributes used by mentions and image uploads', () => {
    const sanitized = sanitizeMessageInputHtml(
      '<span id="aitSpan" data-ait-uid="u1" contenteditable="false">@Alice</span><img id="temp-image" data-path="/tmp/a.png" data-type="emoji" data-server-url="mxc://x" src="blob:test" />'
    )

    expect(sanitized).toContain('id="aitSpan"')
    expect(sanitized).toContain('data-ait-uid="u1"')
    expect(sanitized).toContain('contenteditable="false"')
    expect(sanitized).toContain('data-path="/tmp/a.png"')
    expect(sanitized).toContain('data-type="emoji"')
    expect(sanitized).toContain('data-server-url="mxc://x"')
  })

  it('removes style attributes from editor html', () => {
    const sanitized = sanitizeMessageInputHtml('<span style="color:red" data-ait-uid="u1">hi</span>')

    expect(sanitized).not.toContain('style=')
    expect(sanitized).toContain('data-ait-uid="u1"')
  })
})

describe('applySanitizedMessageInputHtml', () => {
  it('writes sanitized html back to the contenteditable container', () => {
    const container = document.createElement('div')
    const result = applySanitizedMessageInputHtml(container, '<div onclick="x()" style="color:red">hi</div>')

    expect(result).toBe('<div>hi</div>')
    expect(container.innerHTML).toBe('<div>hi</div>')
  })
})

describe('getPlainTextFromSanitizedHtml', () => {
  it('extracts normalized text content', () => {
    expect(getPlainTextFromSanitizedHtml('<div>Hello&nbsp;<span>World</span></div>')).toBe('Hello World')
  })
})
