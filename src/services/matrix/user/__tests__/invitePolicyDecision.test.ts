import { describe, expect, it } from 'vitest'
import { DEFAULT_INVITE_POLICY, type InvitePolicy } from '../invitePolicy'
import { decideInviteAction, type InviteEventLike, type InvitePolicyDecision } from '../invitePolicyDecision'

const ME = '@me:example.org'

function policy(overrides: Partial<InvitePolicy> = {}): InvitePolicy {
  return { ...DEFAULT_INVITE_POLICY, ...overrides }
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

  it('does not act when there is no inviter to evaluate', () => {
    expect(
      decideInviteAction(
        event({ inviterUserId: undefined }),
        policy({ mode: 'blocklist', blocklist: ['@spam:evil.org'] }),
        ME
      )
    ).toBeNull()
  })

  it('honours the non-contact DM rule', () => {
    const p = policy({ mode: 'allow_all', allowStrangers: false, contacts: [] })
    expect(decideInviteAction(event(), p, ME)?.action).toBe('decline')
    expect(
      decideInviteAction(
        event({ inviterUserId: '@friend:server' }),
        policy({ mode: 'allow_all', allowStrangers: false, contacts: ['@friend:server'] }),
        ME
      )
    ).toBeNull()
  })

  it('returns the room id so the caller can leave it', () => {
    const decision = decideInviteAction(event({ roomId: '!abc:example.org' }), policy({ mode: 'allowlist' }), ME)
    expect(decision?.roomId).toBe('!abc:example.org')
  })

  it('does not act without a room id', () => {
    expect(decideInviteAction(event({ roomId: '' }), policy({ mode: 'allowlist' }), ME)).toBeNull()
  })
})
