import { describe, expect, it, vi } from 'vitest'
import { createI18nMock } from '~/tests/i18n-messages'
import { useMobileErrorText } from '../useMobileErrorText'

vi.mock('vue-i18n', () => createI18nMock())

describe('useMobileErrorText', () => {
  it('无法分类的错误也返回可展示文案', () => {
    const { resolve } = useMobileErrorText()
    const text = resolve(new Error('boom'))
    expect(text.trim().length).toBeGreaterThan(0)
    expect(text).not.toContain('error.')
  })

  it('命中 i18n 键时使用翻译文案', () => {
    const { resolve } = useMobileErrorText()
    const text = resolve(new Error('Failed to fetch'))
    expect(text).not.toBe('Failed to fetch')
    expect(text.length).toBeGreaterThan(0)
  })

  it('空错误也返回非空文案', () => {
    const { resolve } = useMobileErrorText()
    const text = resolve(null)
    expect(text.trim().length).toBeGreaterThan(0)
    expect(text).not.toBe('error.matrix.unknown')
  })
})
