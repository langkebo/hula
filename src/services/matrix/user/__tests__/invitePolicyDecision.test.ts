import { describe, expect, it } from 'vitest'
import { DEFAULT_INVITE_POLICY, type InvitePolicy } from '../invitePolicy'
import { decideInviteAction, type InviteEventLike, type InvitePolicyDecision } from '../invitePolicyDecision'

const ME = '@me:example.org'

/**
 * 测试替身：默认放开 allowStrangers。
 *
 * DEFAULT_INVITE_POLICY 现在是「仅允许联系人」，而本文件多数用例在验证
 * 名单模式/事件定位逻辑本身；联系人 Fail-open 的用例自己显式覆盖。
 */
function policy(overrides: Partial<InvitePolicy> = {}): InvitePolicy {
  return { ...DEFAULT_INVITE_POLICY, allowStrangers: true, ...overrides }
}

function event(overrides: Partial<InviteEventLike> = {}): InviteEventLike {
  return {
    roomId: '!r:example.org',
    targetUserId: ME,
    membership: 'invite',
    inviterUserId: '@spam:evil.org',
    ...overrides
  }
}

describe('decideInviteAction', () => {
  it('acts when the logged-in user is the invitee and policy matches', () => {
    const decision = decideInviteAction(event(), policy({ mode: 'blocklist', blocklist: ['@spam:evil.org'] }), ME)
    expect(decision).toEqual<InvitePolicyDecision>({
      action: 'decline',
      roomId: '!r:example.org',
      inviterUserId: '@spam:evil.org'
    })
  })

  it('does not act when the membership is not invite', () => {
    expect(
      decideInviteAction(
        event({ membership: 'join' }),
        policy({ mode: 'blocklist', blocklist: ['@spam:evil.org'] }),
        ME
      )
    ).toBeNull()
    expect(
      decideInviteAction(
        event({ membership: 'leave' }),
        policy({ mode: 'blocklist', blocklist: ['@spam:evil.org'] }),
        ME
      )
    ).toBeNull()
    expect(
      decideInviteAction(event({ membership: 'ban' }), policy({ mode: 'blocklist', blocklist: ['@spam:evil.org'] }), ME)
    ).toBeNull()
  })

  it('does not act when someone else is the invitee', () => {
    const decision = decideInviteAction(
      event({ targetUserId: '@someone-else:example.org' }),
      policy({ mode: 'blocklist', blocklist: ['@spam:evil.org'] }),
      ME
    )
    expect(decision).toBeNull()
  })

  it('does not act when the policy allows the inviter', () => {
    expect(decideInviteAction(event(), policy({ mode: 'allow_all' }), ME)).toBeNull()
    expect(
      decideInviteAction(
        event({ inviterUserId: '@friend:server' }),
        policy({ mode: 'blocklist', blocklist: ['@spam:evil.org'] }),
        ME
      )
    ).toBeNull()
  })

  it('does not act when the invitation is from myself', () => {
    const decision = decideInviteAction(event({ inviterUserId: ME }), policy({ mode: 'allowlist', allowlist: [] }), ME)
    expect(decision).toBeNull()
  })

  it('acts on my own invite when I am in the blocklist', () => {
    // 边界：自己把自己拉进房间也会产生 invite 事件。名单模式仍然生效。
    const decision = decideInviteAction(
      event({ inviterUserId: ME }),
      policy({ mode: 'blocklist', blocklist: [ME] }),
      ME
    )
    expect(decision?.action).toBe('decline')
  })

  it('fails safe (no action) when the current user id is unknown', () => {
    // 拿不到自己的 id 就无法判断"这条邀请是不是给我的"。
    // 此时若按策略一律拒邀，会误拒别人的邀请，因此宁可不动作。
    expect(decideInviteAction(event(), policy({ mode: 'allowlist' }), '')).toBeNull()
    expect(decideInviteAction(event(), policy({ mode: 'allowlist' }), undefined)).toBeNull()
  })

  it('normalizes whitespace in the current user id and target id', () => {
    const decision = decideInviteAction(
      event({ targetUserId: '  @me:example.org  ' }),
      policy({ mode: 'blocklist', blocklist: ['@spam:evil.org'] }),
      '  @me:example.org  '
    )
    expect(decision?.action).toBe('decline')
  })

  it('prefers the room state inviter when the member event has none', () => {
    const decision = decideInviteAction(
      event({ inviterUserId: undefined }),
      policy({ mode: 'blocklist', blocklist: ['@spam:evil.org'] }),
      ME,
      '@spam:evil.org'
    )
    expect(decision?.action).toBe('decline')
  })

  it('does not act when there is no inviter to evaluate in permissive modes', () => {
    expect(
      decideInviteAction(
        event({ inviterUserId: undefined }),
        policy({ mode: 'blocklist', blocklist: ['@spam:evil.org'] }),
        ME
      )
    ).toBeNull()
    expect(decideInviteAction(event({ inviterUserId: undefined }), policy({ mode: 'allow_all' }), ME)).toBeNull()
  })

  /**
   * I10 回归：allowlist 是显式白名单，未列出的人一律拒绝（`shouldRejectInvite`）。
   * 拿不到邀请人时提前 return null 会让最严格的模式反而 fail-open。
   */
  it('declines in allowlist mode when the inviter cannot be resolved', () => {
    const decision = decideInviteAction(
      event({ inviterUserId: undefined }),
      policy({ mode: 'allowlist', allowlist: ['@friend:server'] }),
      ME
    )
    expect(decision).toEqual<InvitePolicyDecision>({
      action: 'decline',
      roomId: '!r:example.org',
      inviterUserId: ''
    })
  })

  it('also declines in allowlist mode when a whitespace-only inviter is supplied', () => {
    expect(
      decideInviteAction(
        event({ inviterUserId: '   ' }),
        policy({ mode: 'allowlist', allowlist: ['@friend:server'] }),
        ME
      )?.action
    ).toBe('decline')
  })

  it('honours the non-contact DM rule through the supplied contact state', () => {
    // 判定不再读 policy.contacts 静态快照：那份快照在查询失败时是空的，
    // 会退化成"谁都不认识"→ 误拒所有人。联系人状态改由 ContactStateResolver 提供。
    const p = policy({ mode: 'allow_all', allowStrangers: false, contacts: [] })
    expect(decideInviteAction(event(), p, ME, undefined, 'stranger')?.action).toBe('decline')
    expect(decideInviteAction(event(), p, ME, undefined, 'contact')).toBeNull()
  })

  it('returns the room id so the caller can leave it', () => {
    const decision = decideInviteAction(event({ roomId: '!abc:example.org' }), policy({ mode: 'allowlist' }), ME)
    expect(decision?.roomId).toBe('!abc:example.org')
  })

  describe('contact state (only-contacts mode must fail open)', () => {
    const onlyContacts = policy({ mode: 'allow_all', allowStrangers: false })

    it('declines a confirmed stranger', () => {
      expect(decideInviteAction(event(), onlyContacts, ME, undefined, 'stranger')?.action).toBe('decline')
    })

    it('allows a confirmed contact', () => {
      expect(decideInviteAction(event(), onlyContacts, ME, undefined, 'contact')).toBeNull()
    })

    it('fails open when the contact state is unknown', () => {
      // 关键：联系人查询失败时绝不能当陌生人拒掉，否则后端抖动会误拒所有好友
      expect(decideInviteAction(event(), onlyContacts, ME, undefined, 'unknown')).toBeNull()
    })

    it('fails open when no contact state was supplied', () => {
      expect(decideInviteAction(event(), onlyContacts, ME)).toBeNull()
    })

    it('declines a blocklisted user even with no contact state at all', () => {
      // 回归：默认 allowStrangers=false 时，fail-open 守卫曾把 blocklist 模式
      // 一并拦掉（强制点只在 allow_all 下查联系人，因此 blocklist 拿不到
      // contactState）——结果用户把自己拉黑的人放进了房间。
      const p = policy({ mode: 'blocklist', blocklist: ['@spam:evil.org'], allowStrangers: false })
      expect(decideInviteAction(event(), p, ME)?.action).toBe('decline')
    })

    it('declines a confirmed stranger when a blocklist is in use and strangers are disallowed', () => {
      // 隐私回归：屏蔽只是往黑名单里加人，不该顺手关掉「仅允许联系人」基线。
      // 旧实现里 mode === 'blocklist' 提前 return，非联系人反而被放行。
      const p = policy({ mode: 'blocklist', blocklist: ['@x:evil.org'], allowStrangers: false, contacts: [] })
      expect(decideInviteAction(event({ inviterUserId: '@x:evil.org' }), p, ME, undefined, 'stranger')?.action).toBe(
        'decline'
      )
      expect(
        decideInviteAction(event({ inviterUserId: '@stranger:server' }), p, ME, undefined, 'stranger')?.action
      ).toBe('decline')
    })

    it('declines a blocklisted user in allowlist mode as well', () => {
      const p = policy({
        mode: 'allowlist',
        allowlist: ['@spam:evil.org', '@friend:server'],
        blocklist: ['@spam:evil.org'],
        allowStrangers: false
      })
      expect(decideInviteAction(event(), p, ME)?.action).toBe('decline')
      expect(decideInviteAction(event({ inviterUserId: '@friend:server' }), p, ME)).toBeNull()
    })

    it('declines a non-allowlisted user even with no contact state at all', () => {
      const p = policy({ mode: 'allowlist', allowlist: ['@friend:server'], allowStrangers: false })
      expect(decideInviteAction(event(), p, ME)?.action).toBe('decline')
    })

    it('still declines a blocklisted user regardless of contact state', () => {
      const p = policy({ mode: 'blocklist', blocklist: ['@spam:evil.org'] })
      expect(decideInviteAction(event(), p, ME, undefined, 'contact')?.action).toBe('decline')
      expect(decideInviteAction(event(), p, ME, undefined, 'unknown')?.action).toBe('decline')
    })

    it('does not fail open for allowlist mode when the state is unknown', () => {
      // 名单模式是显式表达，不受联系人查询结果影响
      const p = policy({ mode: 'allowlist', allowlist: ['@friend:server'] })
      expect(decideInviteAction(event(), p, ME, undefined, 'unknown')?.action).toBe('decline')
    })

    it('does not fail open in allow_all when strangers are allowed', () => {
      const p = policy({ mode: 'allow_all', allowStrangers: true })
      expect(decideInviteAction(event(), p, ME, undefined, 'stranger')).toBeNull()
    })
  })

  /**
   * 评审 Critical #1：强制点必须在**每个** contacts 规则生效的模式下解析并使用
   * 动态联系人状态。旧实现的 fail-open 守卫只认 `allow_all`，于是 blocklist 模式下
   * `contactState` 被忽略，默认 `allowStrangers: false` 的用户连好友的邀请都会被拒。
   */
  describe('blocklist mode honours the dynamic contact state', () => {
    const restricted = policy({
      mode: 'blocklist',
      blocklist: ['@blocked:evil.org'],
      allowStrangers: false,
      contacts: []
    })

    it('does not decline a confirmed contact', () => {
      expect(
        decideInviteAction(event({ inviterUserId: '@friend:server' }), restricted, ME, undefined, 'contact')
      ).toBeNull()
    })

    it('declines a confirmed stranger', () => {
      expect(
        decideInviteAction(event({ inviterUserId: '@stranger:server' }), restricted, ME, undefined, 'stranger')?.action
      ).toBe('decline')
    })

    it('declines a blocklisted user whatever the contact state says', () => {
      for (const state of ['contact', 'stranger', 'unknown', undefined] as const) {
        expect(
          decideInviteAction(event({ inviterUserId: '@blocked:evil.org' }), restricted, ME, undefined, state)?.action
        ).toBe('decline')
      }
    })

    it('allows any non-blocklisted inviter when strangers are allowed', () => {
      const open = policy({ mode: 'blocklist', blocklist: ['@blocked:evil.org'], allowStrangers: true })
      expect(
        decideInviteAction(event({ inviterUserId: '@stranger:server' }), open, ME, undefined, 'stranger')
      ).toBeNull()
    })

    it('fails open when the contact state is unknown or missing', () => {
      expect(
        decideInviteAction(event({ inviterUserId: '@stranger:server' }), restricted, ME, undefined, 'unknown')
      ).toBeNull()
      expect(decideInviteAction(event({ inviterUserId: '@stranger:server' }), restricted, ME)).toBeNull()
    })

    it('fails open exactly like allow_all does', () => {
      const onlyContacts = policy({ mode: 'allow_all', allowStrangers: false })
      expect(decideInviteAction(event(), onlyContacts, ME, undefined, 'unknown')).toBeNull()
      expect(decideInviteAction(event(), onlyContacts, ME)).toBeNull()
      expect(decideInviteAction(event(), onlyContacts, ME, undefined, 'stranger')?.action).toBe('decline')
    })
  })

  it('does not act without a room id', () => {
    expect(decideInviteAction(event({ roomId: '' }), policy({ mode: 'allowlist' }), ME)).toBeNull()
  })
})
