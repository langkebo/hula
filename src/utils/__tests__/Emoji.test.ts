import { describe, expect, it, vi } from 'vitest'

vi.mock('@/services/i18n', () => ({
  useI18nGlobal: () => ({
    t: (key: string) => {
      const translations: Record<string, string> = {
        'emoticon.categories.expression': '表情',
        'emoticon.categories.animal': '动物',
        'emoticon.categories.gesture': '手势'
      }
      return translations[key] || key
    }
  })
}))

import { getAllTypeEmojis } from '../Emoji'

describe('getAllTypeEmojis', () => {
  it('returns three categories with translated names', () => {
    const result = getAllTypeEmojis()
    expect(result.expressionEmojis.name).toBe('表情')
    expect(result.animalEmojis.name).toBe('动物')
    expect(result.gestureEmojis.name).toBe('手势')
  })

  it('returns expression emoji array containing 😀', () => {
    const result = getAllTypeEmojis()
    expect(Array.isArray(result.expressionEmojis.value)).toBe(true)
    expect(result.expressionEmojis.value).toContain('😀')
  })

  it('returns animal emoji array containing 🐶', () => {
    const result = getAllTypeEmojis()
    expect(Array.isArray(result.animalEmojis.value)).toBe(true)
    expect(result.animalEmojis.value).toContain('🐶')
  })

  it('returns gesture emoji array containing 👍', () => {
    const result = getAllTypeEmojis()
    expect(Array.isArray(result.gestureEmojis.value)).toBe(true)
    expect(result.gestureEmojis.value).toContain('👍')
  })

  it('expression emojis only contain emoji characters (no whitespace)', () => {
    const result = getAllTypeEmojis()
    for (const emoji of result.expressionEmojis.value) {
      expect(emoji).toMatch(/\p{Emoji}/u)
      expect(emoji).not.toMatch(/\s/)
    }
  })

  it('gesture emojis only contain emoji characters', () => {
    const result = getAllTypeEmojis()
    for (const emoji of result.gestureEmojis.value) {
      expect(emoji).toMatch(/\p{Emoji}/u)
    }
  })

  it('returns consistent results across multiple calls', () => {
    const first = getAllTypeEmojis()
    const second = getAllTypeEmojis()
    expect(first.expressionEmojis.value).toEqual(second.expressionEmojis.value)
    expect(first.animalEmojis.value).toEqual(second.animalEmojis.value)
    expect(first.gestureEmojis.value).toEqual(second.gestureEmojis.value)
  })

  it('each category has a non-empty value array', () => {
    const result = getAllTypeEmojis()
    expect(result.expressionEmojis.value.length).toBeGreaterThan(0)
    expect(result.animalEmojis.value.length).toBeGreaterThan(0)
    expect(result.gestureEmojis.value.length).toBeGreaterThan(0)
  })
})
