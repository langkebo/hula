import { describe, expect, it } from 'vitest'
import {
  evaluatePasswordRules,
  getPasswordStrengthLevel,
  PASSWORD_MAX_LENGTH,
  PASSWORD_MIN_LENGTH,
  validatePasswordStrengthRuleIds
} from '../passwordStrength'

/**
 * 密码强度口径必须与后端 synapse-rust 策略一致，且桌面/移动共用同一实现。
 *
 * 历史问题：这 6 条规则原先内联在桌面端 `AccountSettings.vue` 的
 * `validatePasswordStrength()` 里，移动端要用就得复制一份——两处一旦漂移，
 * 移动端会放过后端拒绝的密码（或反之）。此模块是唯一事实源。
 */

describe('passwordStrength 规则', () => {
  it('暴露与后端一致的 8 / 128 长度边界', () => {
    expect(PASSWORD_MIN_LENGTH).toBe(8)
    expect(PASSWORD_MAX_LENGTH).toBe(128)
  })

  it('全部满足时无失败规则', () => {
    expect(validatePasswordStrengthRuleIds('Str0ng!Pass')).toEqual([])
  })

  it('逐条检出缺失的字符类别', () => {
    expect(validatePasswordStrengthRuleIds('str0ng!pass')).toContain('uppercase')
    expect(validatePasswordStrengthRuleIds('STR0NG!PASS')).toContain('lowercase')
    expect(validatePasswordStrengthRuleIds('Strong!Pass')).toContain('digit')
    expect(validatePasswordStrengthRuleIds('Str0ngPass')).toContain('special')
  })

  it('过短与过长分别命中 minLength / maxLength', () => {
    expect(validatePasswordStrengthRuleIds('Ab1!')).toContain('minLength')
    expect(validatePasswordStrengthRuleIds(`Ab1!${'a'.repeat(130)}`)).toContain('maxLength')
  })

  it('evaluatePasswordRules 返回每条规则的通过状态（供强度指示器）', () => {
    const rules = evaluatePasswordRules('Str0ng!Pass')
    expect(rules).toHaveLength(6)
    expect(rules.every((r) => r.passed)).toBe(true)
    expect(rules.map((r) => r.id)).toEqual(['minLength', 'maxLength', 'uppercase', 'lowercase', 'digit', 'special'])
  })

  it('强度等级随满足项单调不减', () => {
    const empty = getPasswordStrengthLevel('')
    const weak = getPasswordStrengthLevel('abc')
    const medium = getPasswordStrengthLevel('Abcdef12')
    const strong = getPasswordStrengthLevel('Str0ng!Pass')

    expect(empty).toBe(0)
    expect(weak).toBeGreaterThanOrEqual(empty)
    expect(medium).toBeGreaterThanOrEqual(weak)
    expect(strong).toBeGreaterThanOrEqual(medium)
    expect(strong).toBe(4)
  })

  it('等级始终落在 0..4（4 段色条）', () => {
    for (const pwd of ['', 'a', 'Ab1!', 'Str0ng!Pass', 'x'.repeat(200)]) {
      const level = getPasswordStrengthLevel(pwd)
      expect(level).toBeGreaterThanOrEqual(0)
      expect(level).toBeLessThanOrEqual(4)
    }
  })
})
