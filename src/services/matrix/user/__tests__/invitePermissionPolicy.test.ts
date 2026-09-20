import { beforeEach, describe, expect, it } from 'vitest'
import {
  cacheInvitePermissionConfig,
  DEFAULT_INVITE_PERMISSION_CONFIG,
  INVITE_PERMISSION_ACCOUNT_DATA_TYPE,
  INVITE_PERMISSION_MODES,
  type InvitePermissionConfig,
  isInvitePermissionMode,
  loadInvitePermissionConfig,
  normalizeInvitePermissionConfig,
  normalizeUserId,
  shouldRejectInvite
} from '../invitePermissionPolicy'

function config(overrides: Partial<InvitePermissionConfig> = {}): InvitePermissionConfig {
  return { ...DEFAULT_INVITE_PERMISSION_CONFIG, ...overrides }
}

describe('isInvitePermissionMode', () => {
  it('accepts the three modes', () => {
    for (const mode of INVITE_PERMISSION_MODES) {
      expect(isInvitePermissionMode(mode)).toBe(true)
    }
  })

  it('rejects unknown and non-string values', () => {
    expect(isInvitePermissionMode('nobody')).toBe(false)
    expect(isInvitePermissionMode(undefined)).toBe(false)
    expect(isInvitePermissionMode(3)).toBe(false)
  })
})

describe('normalizeUserId', () => {
  it('trims whitespace', () => {
    expect(normalizeUserId('  @a:b  ')).toBe('@a:b')
  })

  it('preserves case (Matrix localparts are case sensitive)', () => {
    expect(normalizeUserId('@Alice:Example.org')).toBe('@Alice:Example.org')
  })

  it('returns an empty string for non-strings', () => {
    expect(normalizeUserId(undefined)).toBe('')
    expect(normalizeUserId(7)).toBe('')
  })
})

describe('normalizeInvitePermissionConfig', () => {
  it('falls back to allow_all for junk input', () => {
    expect(normalizeInvitePermissionConfig(null)).toEqual(DEFAULT_INVITE_PERMISSION_CONFIG)
    expect(normalizeInvitePermissionConfig('nope')).toEqual(DEFAULT_INVITE_PERMISSION_CONFIG)
  })

  it('replaces an unknown mode with the default', () => {
    expect(normalizeInvitePermissionConfig({ mode: 'nobody' }).mode).toBe('allow_all')
  })

  it('drops blank, duplicate and non-string entries', () => {
    const result = normalizeInvitePermissionConfig({
      mode: 'blocklist',
      blocklist: ['@a:b', '  ', '@a:b', 5, null, '@c:d']
    })
    expect(result.blocklist).toEqual(['@a:b', '@c:d'])
  })

  it('defaults missing lists to empty arrays', () => {
    const result = normalizeInvitePermissionConfig({ mode: 'allowlist' })
    expect(result.blocklist).toEqual([])
    expect(result.allowlist).toEqual([])
  })

  it('does not share array references with the default config', () => {
    const first = normalizeInvitePermissionConfig(null)
    first.blocklist.push('@x:y')
    expect(normalizeInvitePermissionConfig(null).blocklist).toEqual([])
  })
})

describe('shouldRejectInvite', () => {
  it('never rejects in allow_all', () => {
    expect(shouldRejectInvite('@anyone:server', config({ mode: 'allow_all' }))).toBe(false)
    expect(shouldRejectInvite('', config({ mode: 'allow_all' }))).toBe(false)
  })

  it('rejects listed users in blocklist mode', () => {
    const cfg = config({ mode: 'blocklist', blocklist: ['@spam:evil.org'] })
    expect(shouldRejectInvite('@spam:evil.org', cfg)).toBe(true)
    expect(shouldRejectInvite('@friend:server', cfg)).toBe(false)
  })

  it('rejects everyone not listed in allowlist mode', () => {
    const cfg = config({ mode: 'allowlist', allowlist: ['@friend:server'] })
    expect(shouldRejectInvite('@friend:server', cfg)).toBe(false)
    expect(shouldRejectInvite('@stranger:server', cfg)).toBe(true)
  })

  it('rejects an empty inviter in blocklist mode', () => {
    expect(shouldRejectInvite('   ', config({ mode: 'blocklist' }))).toBe(true)
    expect(shouldRejectInvite(undefined, config({ mode: 'blocklist' }))).toBe(true)
  })

  it('rejects an empty inviter in allowlist mode', () => {
    expect(shouldRejectInvite('', config({ mode: 'allowlist', allowlist: ['@a:b'] }))).toBe(true)
  })

  it('trims the inviter before comparing', () => {
    const cfg = config({ mode: 'blocklist', blocklist: ['@spam:evil.org'] })
    expect(shouldRejectInvite('  @spam:evil.org  ', cfg)).toBe(true)
  })

  it('normalizes a malformed config instead of throwing', () => {
    expect(shouldRejectInvite('@a:b', { mode: 'bogus' } as unknown as InvitePermissionConfig)).toBe(false)
  })

  it('treats a non-array blocklist as empty (so nobody is rejected)', () => {
    const cfg = { mode: 'blocklist', blocklist: 'nope' } as unknown as InvitePermissionConfig
    expect(shouldRejectInvite('@a:b', cfg)).toBe(false)
  })

  it('treats a non-array allowlist as empty (so everyone is rejected)', () => {
    const cfg = { mode: 'allowlist', allowlist: 'nope' } as unknown as InvitePermissionConfig
    expect(shouldRejectInvite('@a:b', cfg)).toBe(true)
  })
})

describe('load / cache round trip', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('returns defaults when nothing is cached', () => {
    expect(loadInvitePermissionConfig()).toEqual(DEFAULT_INVITE_PERMISSION_CONFIG)
  })

  it('round-trips a config', () => {
    const cfg = config({ mode: 'allowlist', allowlist: ['@a:b'], blocklist: ['@c:d'] })
    cacheInvitePermissionConfig(cfg)
    expect(loadInvitePermissionConfig()).toEqual(cfg)
  })

  it('writes under the account-data type key', () => {
    cacheInvitePermissionConfig(config({ mode: 'blocklist' }))
    expect(localStorage.getItem(INVITE_PERMISSION_ACCOUNT_DATA_TYPE)).toBeTruthy()
  })

  it('does not let a cached config regress to allow_all after corruption', () => {
    localStorage.setItem(INVITE_PERMISSION_ACCOUNT_DATA_TYPE, '{broken')
    expect(loadInvitePermissionConfig().mode).toBe('allow_all')
  })

  it('normalizes before caching', () => {
    cacheInvitePermissionConfig({ mode: 'bogus', blocklist: ['@a:b'] } as unknown as InvitePermissionConfig)
    expect(loadInvitePermissionConfig().mode).toBe('allow_all')
  })

  it('tolerates storage that throws', () => {
    const throwingRead = {
      getItem: () => {
        throw new Error('blocked')
      }
    } as unknown as Pick<Storage, 'getItem'>
    const throwingWrite = {
      setItem: () => {
        throw new Error('quota')
      }
    } as unknown as Pick<Storage, 'setItem'>
    expect(loadInvitePermissionConfig(throwingRead)).toEqual(DEFAULT_INVITE_PERMISSION_CONFIG)
    expect(() => cacheInvitePermissionConfig(config(), throwingWrite)).not.toThrow()
  })
})
