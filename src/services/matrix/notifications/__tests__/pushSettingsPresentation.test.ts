import type { IPushRule, IPushRules } from 'matrix-js-sdk'
import { describe, expect, it } from 'vitest'
import {
  countPushRules,
  formatPushRuleId,
  getPusherDisplayName,
  getPusherSubtitle,
  groupPushRulesByKind,
  isPusherEnabled,
  isPushRuleEnabled,
  maskPushKey,
  PUSH_RULE_KINDS
} from '../pushSettingsPresentation'

function rule(partial: Partial<IPushRule> & { rule_id: string }): IPushRule {
  return partial as IPushRule
}

describe('maskPushKey', () => {
  it('keeps head and tail for long keys', () => {
    expect(maskPushKey('abcdefghijklmnop')).toBe('abcdef...klmnop')
  })

  it('keeps short keys intact', () => {
    expect(maskPushKey('short')).toBe('short')
  })

  it('keeps exactly 12 characters intact', () => {
    expect(maskPushKey('123456789012')).toBe('123456789012')
  })

  it('masks a 13 character key', () => {
    expect(maskPushKey('1234567890123')).toBe('123456...890123')
  })

  it('returns an empty string for missing keys', () => {
    expect(maskPushKey(null)).toBe('')
    expect(maskPushKey(undefined)).toBe('')
    expect(maskPushKey('')).toBe('')
  })

  it('never leaks more than 12 characters of a long key', () => {
    const masked = maskPushKey('A'.repeat(200))
    expect(masked.length).toBeLessThanOrEqual(15)
  })
})

describe('formatPushRuleId', () => {
  it('strips the spec prefix', () => {
    expect(formatPushRuleId('.m.rule.contains_display_name')).toBe('contains_display_name')
  })

  it('leaves custom rule ids untouched', () => {
    expect(formatPushRuleId('my_custom_rule')).toBe('my_custom_rule')
  })

  it('returns an empty string for empty input', () => {
    expect(formatPushRuleId('')).toBe('')
  })
})

describe('groupPushRulesByKind', () => {
  it('returns empty arrays for every kind when rules are missing', () => {
    const grouped = groupPushRulesByKind(null)
    for (const kind of PUSH_RULE_KINDS) {
      expect(grouped[kind]).toEqual([])
    }
    expect(countPushRules(grouped)).toBe(0)
  })

  it('groups global rules by kind', () => {
    const rules = {
      global: {
        override: [rule({ rule_id: '.m.rule.master' })],
        content: [rule({ rule_id: 'a' }), rule({ rule_id: 'b' })],
        sender: [rule({ rule_id: 'c' })]
      }
    } as unknown as IPushRules

    const grouped = groupPushRulesByKind(rules)
    expect(grouped.override.map((r) => r.rule_id)).toEqual(['.m.rule.master'])
    expect(grouped.content).toHaveLength(2)
    expect(grouped.sender).toHaveLength(1)
    expect(grouped.room).toEqual([])
    expect(grouped.underride).toEqual([])
    expect(countPushRules(grouped)).toBe(4)
  })

  it('ignores non-array entries instead of throwing', () => {
    const rules = { global: { override: 'nope' } } as unknown as IPushRules
    expect(groupPushRulesByKind(rules).override).toEqual([])
  })

  it('counts every kind', () => {
    const grouped = groupPushRulesByKind({
      global: Object.fromEntries(PUSH_RULE_KINDS.map((kind) => [kind, [rule({ rule_id: kind })]]))
    } as unknown as IPushRules)
    expect(countPushRules(grouped)).toBe(PUSH_RULE_KINDS.length)
  })
})

describe('isPushRuleEnabled', () => {
  it('treats undefined as enabled', () => {
    expect(isPushRuleEnabled({})).toBe(true)
  })

  it('treats explicit true as enabled', () => {
    expect(isPushRuleEnabled({ enabled: true })).toBe(true)
  })

  it('treats explicit false as disabled', () => {
    expect(isPushRuleEnabled({ enabled: false })).toBe(false)
  })
})

describe('isPusherEnabled', () => {
  it('treats missing flags as enabled', () => {
    expect(isPusherEnabled({})).toBe(true)
  })

  it('honours the msc3881 flag over the legacy flag', () => {
    expect(isPusherEnabled({ enabled: true, 'org.matrix.msc3881.enabled': false })).toBe(false)
    expect(isPusherEnabled({ enabled: false, 'org.matrix.msc3881.enabled': true })).toBe(true)
  })

  it('treats null as enabled', () => {
    expect(isPusherEnabled({ enabled: null })).toBe(true)
  })
})

describe('getPusherDisplayName', () => {
  it('prefers the device name', () => {
    expect(getPusherDisplayName({ device_display_name: 'Phone', app_display_name: 'TJG' }, 'fallback')).toBe('Phone')
  })

  it('falls back to the app name', () => {
    expect(getPusherDisplayName({ device_display_name: '  ', app_display_name: 'TJG' }, 'fallback')).toBe('TJG')
  })

  it('falls back to the provided placeholder', () => {
    expect(getPusherDisplayName({}, 'noDevices')).toBe('noDevices')
  })
})

describe('getPusherSubtitle', () => {
  it('joins app name and kind', () => {
    expect(getPusherSubtitle({ app_display_name: 'TJG', kind: 'http' })).toBe('TJG · http')
  })

  it('drops missing parts', () => {
    expect(getPusherSubtitle({ kind: 'http' })).toBe('http')
    expect(getPusherSubtitle({})).toBe('')
  })
})
