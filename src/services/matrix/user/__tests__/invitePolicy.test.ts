import { beforeEach, describe, expect, it } from 'vitest'
import {
  cacheInvitePolicy,
  DEFAULT_INVITE_POLICY,
  INVITE_POLICY_ACCOUNT_DATA_TYPE,
  INVITE_POLICY_MODES,
  type InvitePolicy,
  isInvitePolicyMode,
  loadInvitePolicy,
  normalizeInvitePolicy,
  normalizeUserId,
  shouldRejectInvite
} from '../invitePolicy'

function policy(overrides: Partial<InvitePolicy> = {}): InvitePolicy {
  return { ...DEFAULT_INVITE_POLICY, ...overrides }
}

describe('INVITE_POLICY_ACCOUNT_DATA_TYPE', () => {
  it('must not collide with the backend room-scoped table name', () => {
    // 后端 synapse-rust 有 room_invite_blocklist 表与
    // /rooms/{room_id}/invite_blocklist 端点（房间级）。
    // account data 是账号级，两者同名会造成"改了账号设置却以为改了房间"的误判。
    expect(INVITE_POLICY_ACCOUNT_DATA_TYPE).not.toBe('im.hula.invite_blocklist')
    expect(INVITE_POLICY_ACCOUNT_DATA_TYPE).toContain('invite_policy')
  })
})

describe('isInvitePolicyMode', () => {
  it('accepts the three modes', () => {
    for (const mode of INVITE_POLICY_MODES) {
      expect(isInvitePolicyMode(mode)).toBe(true)
    }
  })

  it('rejects unknown and non-string values', () => {
    expect(isInvitePolicyMode('nobody')).toBe(false)
    expect(isInvitePolicyMode(undefined)).toBe(false)
    expect(isInvitePolicyMode(3)).toBe(false)
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

describe('normalizeInvitePolicy', () => {
  it('falls back to allow_all for junk input', () => {
    expect(normalizeInvitePolicy(null)).toEqual(DEFAULT_INVITE_POLICY)
    expect(normalizeInvitePolicy('nope')).toEqual(DEFAULT_INVITE_POLICY)
  })

  it('replaces an unknown mode with the default', () => {
    expect(normalizeInvitePolicy({ mode: 'nobody' }).mode).toBe('allow_all')
  })

  it('drops blank, duplicate and non-string entries', () => {
    const result = normalizeInvitePolicy({
      mode: 'blocklist',
      blocklist: ['@a:b', '  ', '@a:b', 5, null, '@c:d']
    })
    expect(result.blocklist).toEqual(['@a:b', '@c:d'])
  })

  it('defaults missing lists to empty arrays', () => {
    const result = normalizeInvitePolicy({ mode: 'allowlist' })
    expect(result.blocklist).toEqual([])
    expect(result.allowlist).toEqual([])
  })

  it('does not share array references with the default policy', () => {
    const first = normalizeInvitePolicy(null)
    first.blocklist.push('@x:y')
    expect(normalizeInvitePolicy(null).blocklist).toEqual([])
  })
})

describe('shouldRejectInvite — 静态名单策略', () => {
  it('never rejects in allow_all', () => {
    expect(shouldRejectInvite('@anyone:server', policy({ mode: 'allow_all' }))).toBe(false)
    expect(shouldRejectInvite('', policy({ mode: 'allow_all' }))).toBe(false)
  })

  it('rejects listed users in blocklist mode', () => {
    const p = policy({ mode: 'blocklist', blocklist: ['@spam:evil.org'] })
    expect(shouldRejectInvite('@spam:evil.org', p)).toBe(true)
    expect(shouldRejectInvite('@friend:server', p)).toBe(false)
  })

  it('rejects everyone not listed in allowlist mode', () => {
    const p = policy({ mode: 'allowlist', allowlist: ['@friend:server'] })
    expect(shouldRejectInvite('@friend:server', p)).toBe(false)
    expect(shouldRejectInvite('@stranger:server', p)).toBe(true)
  })

  it('rejects an empty inviter when a list mode is active', () => {
    expect(shouldRejectInvite('   ', policy({ mode: 'blocklist' }))).toBe(true)
    expect(shouldRejectInvite(undefined, policy({ mode: 'blocklist' }))).toBe(true)
    expect(shouldRejectInvite('', policy({ mode: 'allowlist', allowlist: ['@a:b'] }))).toBe(true)
  })

  it('trims the inviter before comparing', () => {
    const p = policy({ mode: 'blocklist', blocklist: ['@spam:evil.org'] })
    expect(shouldRejectInvite('  @spam:evil.org  ', p)).toBe(true)
  })

  it('normalizes a malformed policy instead of throwing', () => {
    expect(shouldRejectInvite('@a:b', { mode: 'bogus' } as unknown as InvitePolicy)).toBe(false)
  })

  it('treats a non-array blocklist as empty (so nobody is rejected)', () => {
    const p = { mode: 'blocklist', blocklist: 'nope' } as unknown as InvitePolicy
    expect(shouldRejectInvite('@a:b', p)).toBe(false)
  })

  it('treats a non-array allowlist as empty (so everyone is rejected)', () => {
    const p = { mode: 'allowlist', allowlist: 'nope' } as unknown as InvitePolicy
    expect(shouldRejectInvite('@a:b', p)).toBe(true)
  })
})

describe('shouldRejectInvite — 非联系人私聊（allow_strangers）', () => {
  it('rejects a stranger DM when stranger invites are disallowed', () => {
    const p = policy({ mode: 'allow_all', allowStrangers: false, contacts: ['@friend:server'] })
    expect(shouldRejectInvite('@stranger:server', p)).toBe(true)
  })

  it('lets a contact DM through when stranger invites are disallowed', () => {
    const p = policy({ mode: 'allow_all', allowStrangers: false, contacts: ['@friend:server'] })
    expect(shouldRejectInvite('@friend:server', p)).toBe(false)
  })

  it('allows strangers when the toggle is on', () => {
    const p = policy({ mode: 'allow_all', allowStrangers: true, contacts: [] })
    expect(shouldRejectInvite('@stranger:server', p)).toBe(false)
  })

  it('treats a whitespace-padded contact as a contact', () => {
    const p = policy({ mode: 'allow_all', allowStrangers: false, contacts: ['  @friend:server '] })
    expect(shouldRejectInvite('@friend:server', p)).toBe(false)
  })

  it('does not treat an empty contact entry as matching everyone', () => {
    const p = policy({ mode: 'allow_all', allowStrangers: false, contacts: ['', '   '] })
    expect(shouldRejectInvite('@stranger:server', p)).toBe(true)
  })

  it('blocklist wins over the stranger exemption', () => {
    const p = policy({
      mode: 'blocklist',
      blocklist: ['@bad:server'],
      allowStrangers: false,
      contacts: ['@bad:server']
    })
    expect(shouldRejectInvite('@bad:server', p)).toBe(true)
  })

  it('allowlist still rejects a non-listed contact', () => {
    const p = policy({
      mode: 'allowlist',
      allowlist: ['@a:b'],
      allowStrangers: false,
      contacts: ['@friend:server']
    })
    expect(shouldRejectInvite('@friend:server', p)).toBe(true)
  })

  it('does not apply the stranger rule while the policy is in a list mode', () => {
    // 名单模式已经表达了"谁能进"，再用 contacts 二次判定会互相矛盾
    const p = policy({ mode: 'allowlist', allowlist: ['@a:b'], allowStrangers: false, contacts: [] })
    expect(shouldRejectInvite('@a:b', p)).toBe(false)
  })

  it('keeps allow_all permissive when stranger invites are allowed', () => {
    const p = policy({ mode: 'allow_all', allowStrangers: true })
    expect(shouldRejectInvite('@anyone:server', p)).toBe(false)
  })
})

describe('load / cache round trip', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('returns defaults when nothing is cached', () => {
    expect(loadInvitePolicy()).toEqual(DEFAULT_INVITE_POLICY)
  })

  it('round-trips a policy', () => {
    const p = policy({
      mode: 'allowlist',
      allowlist: ['@a:b'],
      blocklist: ['@c:d'],
      allowStrangers: false,
      contacts: ['@e:f']
    })
    cacheInvitePolicy(p)
    expect(loadInvitePolicy()).toEqual(p)
  })

  it('writes under the account-data type key', () => {
    cacheInvitePolicy(policy({ mode: 'blocklist' }))
    expect(localStorage.getItem(INVITE_POLICY_ACCOUNT_DATA_TYPE)).toBeTruthy()
  })

  it('recovers from corrupt JSON', () => {
    localStorage.setItem(INVITE_POLICY_ACCOUNT_DATA_TYPE, '{broken')
    expect(loadInvitePolicy()).toEqual(DEFAULT_INVITE_POLICY)
  })

  it('normalizes before caching', () => {
    cacheInvitePolicy({ mode: 'bogus' } as unknown as InvitePolicy)
    expect(loadInvitePolicy().mode).toBe('allow_all')
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
    expect(loadInvitePolicy(throwingRead)).toEqual(DEFAULT_INVITE_POLICY)
    expect(() => cacheInvitePolicy(policy(), throwingWrite)).not.toThrow()
  })

  it('does not silently drop allowStrangers on a full round trip', () => {
    cacheInvitePolicy(policy({ allowStrangers: false }))
    expect(loadInvitePolicy().allowStrangers).toBe(false)
  })
})
