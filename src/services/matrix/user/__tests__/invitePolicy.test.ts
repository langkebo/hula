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

/**
 * 测试替身：显式放开 allowStrangers。
 *
 * DEFAULT_INVITE_POLICY 现在是「仅允许联系人」（allowStrangers: false），
 * 而本文件大部分用例在验证**名单模式**本身，不该被联系人规则干扰；
 * 联系人相关的用例自己显式覆盖 allowStrangers。
 */
function policy(overrides: Partial<InvitePolicy> = {}): InvitePolicy {
  return { ...DEFAULT_INVITE_POLICY, allowStrangers: true, ...overrides }
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
  it('never rejects in allow_all when strangers are allowed', () => {
    expect(shouldRejectInvite('@anyone:server', policy({ mode: 'allow_all', allowStrangers: true }))).toBe(false)
    expect(shouldRejectInvite('', policy({ mode: 'allow_all', allowStrangers: true }))).toBe(false)
  })

  it('rejects a confirmed non-contact in allow_all when strangers are disallowed', () => {
    const p = policy({ mode: 'allow_all', allowStrangers: false })
    expect(shouldRejectInvite('@anyone:server', p, 'stranger')).toBe(true)
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

  it('rejects an unknown inviter unless strangers are explicitly allowed', () => {
    // 空 id 在"仅允许联系人"下不能默认放行（拿不到身份 → 拒），
    // 而显式放开陌生人时连空 id 也放行。
    expect(shouldRejectInvite('   ', policy({ mode: 'blocklist', allowStrangers: false }))).toBe(true)
    expect(shouldRejectInvite(undefined, policy({ mode: 'blocklist', allowStrangers: false }))).toBe(true)
    expect(shouldRejectInvite('', policy({ mode: 'allowlist', allowlist: ['@a:b'] }))).toBe(true)
    expect(shouldRejectInvite('   ', policy({ mode: 'blocklist' }))).toBe(false)
  })

  it('trims the inviter before comparing', () => {
    const p = policy({ mode: 'blocklist', blocklist: ['@spam:evil.org'] })
    expect(shouldRejectInvite('  @spam:evil.org  ', p)).toBe(true)
  })

  it('normalizes a malformed policy instead of throwing', () => {
    // 未知 mode 归一化为 allow_all；此时 allowStrangers 落到默认值（false）。
    // 联系人状态缺省 → fail-open，所以确认的陌生人才会被拒。
    expect(shouldRejectInvite('@a:b', { mode: 'bogus' } as unknown as InvitePolicy, 'stranger')).toBe(true)
    expect(shouldRejectInvite('@a:b', { mode: 'bogus' } as unknown as InvitePolicy)).toBe(false)
  })

  it('treats a non-array blocklist as empty (so nobody is rejected by it)', () => {
    // 归一化把非法 blocklist 变成 []，因此它不会拒任何人；此时是否拒绝由
    // allowStrangers 决定（放开陌生人 → 放行）。旧实现里 mode === 'blocklist'
    // 会无条件拒绝，与"名单为空"矛盾。
    const p = { mode: 'blocklist', blocklist: 'nope', allowStrangers: true } as unknown as InvitePolicy
    expect(shouldRejectInvite('@a:b', p)).toBe(false)
  })

  it('treats a non-array allowlist as empty (so everyone is rejected)', () => {
    const p = { mode: 'allowlist', allowlist: 'nope' } as unknown as InvitePolicy
    expect(shouldRejectInvite('@a:b', p)).toBe(true)
  })
})

describe('shouldRejectInvite — 非联系人私聊（allow_strangers）', () => {
  it('rejects a confirmed stranger when stranger invites are disallowed', () => {
    const p = policy({ mode: 'allow_all', allowStrangers: false, contacts: [] })
    expect(shouldRejectInvite('@stranger:server', p, 'stranger')).toBe(true)
  })

  it('lets a confirmed contact through when stranger invites are disallowed', () => {
    const p = policy({ mode: 'allow_all', allowStrangers: false, contacts: [] })
    expect(shouldRejectInvite('@friend:server', p, 'contact')).toBe(false)
  })

  it('allows strangers when the toggle is on', () => {
    const p = policy({ mode: 'allow_all', allowStrangers: true, contacts: [] })
    expect(shouldRejectInvite('@stranger:server', p, 'stranger')).toBe(false)
  })

  it('fails open when the contact state is unknown', () => {
    // `unknown` = 查询失败，与"确认不是好友"不可区分；拒了就会在后端抖动时误拒好友
    const p = policy({ mode: 'allow_all', allowStrangers: false, contacts: [] })
    expect(shouldRejectInvite('@stranger:server', p, 'unknown')).toBe(false)
  })

  it('fails open when no contact state was supplied at all', () => {
    const p = policy({ mode: 'allow_all', allowStrangers: false, contacts: [] })
    expect(shouldRejectInvite('@stranger:server', p)).toBe(false)
  })

  it('never decides from the static contacts snapshot', () => {
    // contacts 是 account data 里的静态快照，查询失败时是空的；判定只认动态三态。
    // 快照里写着"是好友"也不等于确认过，反之亦然。
    const p = policy({ mode: 'allow_all', allowStrangers: false, contacts: ['@stranger:server'] })
    expect(shouldRejectInvite('@stranger:server', p)).toBe(false)
    expect(shouldRejectInvite('@stranger:server', p, 'stranger')).toBe(true)
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

  it('blocklist is orthogonal to mode and does not disable the only-contacts baseline', () => {
    // 回归（整分支评审）：旧实现里 mode === 'blocklist' 提前 return，绕过 allowStrangers。
    // 于是"屏蔽某人"这一步会把"仅允许联系人"静默关掉——屏蔽 X 之后非联系人 Y 反而能进来。
    const p: InvitePolicy = {
      ...DEFAULT_INVITE_POLICY,
      mode: 'allow_all',
      allowStrangers: false,
      blocklist: ['@x:evil.org'],
      contacts: []
    }
    expect(shouldRejectInvite('@x:evil.org', p, 'contact')).toBe(true)
    // 基线仍然生效：确认的陌生人被拒，确认的联系人照常放行
    expect(shouldRejectInvite('@y:server', p, 'stranger')).toBe(true)
    expect(shouldRejectInvite('@friend:server', p, 'contact')).toBe(false)
  })

  it('honours the blocklist in allowlist mode too', () => {
    // 黑名单是叠加在显式白名单之上的拒绝维度：白名单也救不回来
    const p: InvitePolicy = {
      ...DEFAULT_INVITE_POLICY,
      mode: 'allowlist',
      allowStrangers: true,
      allowlist: ['@x:evil.org', '@friend:server'],
      blocklist: ['@x:evil.org'],
      contacts: []
    }
    expect(shouldRejectInvite('@x:evil.org', p)).toBe(true)
    expect(shouldRejectInvite('@friend:server', p)).toBe(false)
  })

  it('honours the blocklist when strangers are explicitly allowed in allow_all mode', () => {
    // 正交维度：连 allowStrangers: true 也压不过黑名单
    expect(shouldRejectInvite('@x:evil.org', policy({ mode: 'allow_all', blocklist: ['@x:evil.org'] }))).toBe(true)
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

  it('list modes are decided by the list alone, not by the stranger rule', () => {
    // 名单模式已经表达了"谁能进"，不该再被 allowStrangers 二次判定
    const p = policy({ mode: 'allowlist', allowlist: ['@a:b'], allowStrangers: false, contacts: [] })
    expect(shouldRejectInvite('@a:b', p)).toBe(false)
  })

  it('keeps allow_all permissive when stranger invites are allowed', () => {
    const p = policy({ mode: 'allow_all', allowStrangers: true })
    expect(shouldRejectInvite('@anyone:server', p)).toBe(false)
  })
})

/**
 * 评审 Critical #1 的端到端语义矩阵。
 *
 * 旧实现只在 `allow_all` 下解析动态联系人状态，`blocklist` 模式拿不到
 * contactState，于是默认 `allowStrangers: false` 时**好友的邀请也会被自动拒掉**。
 * 这里逐行钉死修复后的语义。
 */
describe('shouldRejectInvite — blocklist 模式与联系人规则正交', () => {
  const restricted = policy({
    mode: 'blocklist',
    blocklist: ['@blocked:evil.org'],
    allowStrangers: false,
    contacts: []
  })

  it('does not reject a confirmed contact', () => {
    expect(shouldRejectInvite('@friend:server', restricted, 'contact')).toBe(false)
  })

  it('rejects a confirmed stranger', () => {
    expect(shouldRejectInvite('@stranger:server', restricted, 'stranger')).toBe(true)
  })

  it('rejects a blocklisted user whatever the contact state says', () => {
    for (const state of ['contact', 'stranger', 'unknown', undefined] as const) {
      expect(shouldRejectInvite('@blocked:evil.org', restricted, state)).toBe(true)
    }
  })

  it('allows any non-blocklisted inviter when strangers are allowed', () => {
    const open = policy({ mode: 'blocklist', blocklist: ['@blocked:evil.org'], allowStrangers: true })
    expect(shouldRejectInvite('@stranger:server', open, 'stranger')).toBe(false)
    expect(shouldRejectInvite('@friend:server', open, 'contact')).toBe(false)
  })

  it('fails open when the contact state is unknown or missing', () => {
    expect(shouldRejectInvite('@stranger:server', restricted, 'unknown')).toBe(false)
    expect(shouldRejectInvite('@stranger:server', restricted)).toBe(false)
  })
})

describe('shouldRejectInvite — allowlist 模式', () => {
  const p = policy({
    mode: 'allowlist',
    allowlist: ['@friend:server'],
    allowStrangers: false,
    contacts: []
  })

  it('is decided by the list alone, regardless of the contact state', () => {
    expect(shouldRejectInvite('@friend:server', p, 'stranger')).toBe(false)
    expect(shouldRejectInvite('@stranger:server', p, 'contact')).toBe(true)
    expect(shouldRejectInvite('@stranger:server', p, 'unknown')).toBe(true)
    expect(shouldRejectInvite('@stranger:server', p)).toBe(true)
  })

  it('honours an explicit blocklist entry even when strangers are allowed', () => {
    const strict = policy({
      mode: 'allowlist',
      allowlist: ['@blocked:evil.org'],
      blocklist: ['@blocked:evil.org'],
      allowStrangers: true
    })
    expect(shouldRejectInvite('@blocked:evil.org', strict, 'contact')).toBe(true)
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
