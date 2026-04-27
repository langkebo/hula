import { describe, it, expect } from 'vitest'
import { estimateTokens, estimateMessageTokens } from '../tokenEstimator'

describe('estimateTokens', () => {
  it('returns 0 for empty, null, undefined', () => {
    expect(estimateTokens('')).toBe(0)
    expect(estimateTokens(null)).toBe(0)
    expect(estimateTokens(undefined)).toBe(0)
  })

  it('rounds up ASCII words by chars/4', () => {
    // "hello" -> ceil(5/4) = 2
    expect(estimateTokens('hello')).toBe(2)
    // "a b c" -> 1 + 1 + 1 = 3
    expect(estimateTokens('a b c')).toBe(3)
  })

  it('counts each non-ASCII codepoint as 1 token', () => {
    // 4 CJK characters
    expect(estimateTokens('你好世界')).toBe(4)
  })

  it('sums ASCII word tokens and non-ASCII codepoint tokens', () => {
    // "hello 世界" -> 2 (hello) + 2 (CJK)
    expect(estimateTokens('hello 世界')).toBe(4)
  })

  it('handles multi-codepoint emoji as individual codepoints', () => {
    // "🙂" is 2 UTF-16 code units but 1 codepoint via Array.from -> 1 non-ASCII token
    expect(estimateTokens('🙂')).toBe(1)
  })

  it('ignores whitespace-only strings after trimming', () => {
    expect(estimateTokens('   ')).toBe(0)
  })
})

describe('estimateMessageTokens', () => {
  it('sums content + reasoningContent', () => {
    expect(estimateMessageTokens({ content: 'hello', reasoningContent: 'world' })).toBe(4)
  })

  it('treats missing fields as empty', () => {
    expect(estimateMessageTokens({})).toBe(0)
    expect(estimateMessageTokens({ content: 'hi' })).toBe(1)
    expect(estimateMessageTokens({ reasoningContent: 'hi' })).toBe(1)
  })
})
