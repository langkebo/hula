// @vitest-environment jsdom
import DOMPurify from 'dompurify'
import { describe, expect, it } from 'vitest'
import { DEFAULT_SAFE_HTML_CONFIG, installSafeHtmlHooks, resolveSafeHtmlConfig } from '../safeHtml'

describe('resolveSafeHtmlConfig', () => {
  it('falls back to the default config for non-object input', () => {
    expect(resolveSafeHtmlConfig(undefined)).toBe(DEFAULT_SAFE_HTML_CONFIG)
    expect(resolveSafeHtmlConfig(null)).toBe(DEFAULT_SAFE_HTML_CONFIG)
    expect(resolveSafeHtmlConfig('nope')).toBe(DEFAULT_SAFE_HTML_CONFIG)
    expect(resolveSafeHtmlConfig(['nope'])).toBe(DEFAULT_SAFE_HTML_CONFIG)
  })

  it('passes through explicit object configs', () => {
    const config = { ALLOWED_TAGS: ['b'] }
    expect(resolveSafeHtmlConfig(config)).toBe(config)
  })
})

describe('installSafeHtmlHooks', () => {
  it('adds target/rel to anchors and is idempotent across repeated installs', () => {
    installSafeHtmlHooks(DOMPurify)
    installSafeHtmlHooks(DOMPurify)

    const result = String(DOMPurify.sanitize('<a href="https://example.com">link</a>', DEFAULT_SAFE_HTML_CONFIG))
    expect(result).toContain('target="_blank"')
    expect(result).toContain('rel="noopener noreferrer"')
    // 幂等：不应出现重复的 target 属性
    expect(result.match(/target=/g)).toHaveLength(1)
  })

  it('converts data-mx-color into a safe inline style', () => {
    installSafeHtmlHooks(DOMPurify)
    const result = String(DOMPurify.sanitize('<span data-mx-color="#ff0000">x</span>', DEFAULT_SAFE_HTML_CONFIG))
    expect(result).toContain('style="color:#ff0000"')
  })
})

describe('default config hardening', () => {
  it('strips forbidden tags and event handler attributes identically on both paths', () => {
    const html = '<form><input value="x"><div onclick="alert(1)">hi</div></form>'

    installSafeHtmlHooks(DOMPurify)
    const mainThread = String(DOMPurify.sanitize(html, DEFAULT_SAFE_HTML_CONFIG))

    // 模拟 worker 路径：未显式传配置时回落到默认配置
    const workerFallback = String(DOMPurify.sanitize(html, resolveSafeHtmlConfig(undefined)))

    expect(mainThread).toBe(workerFallback)
    expect(mainThread).not.toContain('<form')
    expect(mainThread).not.toContain('<input')
    expect(mainThread).not.toContain('onclick')
    expect(mainThread).toContain('hi')
  })
})
