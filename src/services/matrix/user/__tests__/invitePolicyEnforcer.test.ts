import { beforeEach, describe, expect, it, vi } from 'vitest'
import { DEFAULT_INVITE_POLICY, type InvitePolicy } from '../invitePolicy'
import { INVITE_DECLINE_UNDO_WINDOW_MS, InvitePolicyEnforcer } from '../invitePolicyEnforcer'

/**
 * 自动拒邀的强制点。
 *
 * 这是唯一的生效路径：后端没有账号级策略强制（见 invitePolicy.ts 顶部说明），
 * 因此"判错了"会直接表现为用户莫名丢失邀请，测试必须覆盖误拒与漏拒两个方向。
 */

type MemberHandler = (event: unknown, member: Record<string, unknown>) => void

const { getClientMock, state } = vi.hoisted(() => ({
  getClientMock: vi.fn(),
  state: {
    handlers: [] as Array<{ event: string; handler: MemberHandler }>,
    offCalls: [] as Array<{ event: string; handler: MemberHandler }>,
    leaveCalls: [] as string[]
  }
}))

vi.mock('../../MatrixClientService', () => ({
  default: { getClient: (...args: any[]) => getClientMock(...args) }
}))

vi.mock('../../room/MembershipService', () => ({
  matrixRoomMembershipService: {
    leaveRoom: vi.fn(async (roomId: string) => {
      state.leaveCalls.push(roomId)
    })
  }
}))

function makeClient() {
  return {
    on: vi.fn((event: string, handler: MemberHandler) => {
      state.handlers.push({ event, handler })
    }),
    off: vi.fn((event: string, handler: MemberHandler) => {
      state.offCalls.push({ event, handler })
    }),
    getRoom: vi.fn(() => ({
      getMember: vi.fn(() => ({ userId: '@spam:evil.org' }))
    }))
  }
}

/**
 * 测试替身：默认放开 allowStrangers，避免"仅允许联系人"默认值干扰名单模式用例；
 * only-contacts 用例自己构造策略。
 */
function policy(overrides: Partial<InvitePolicy> = {}): InvitePolicy {
  return { ...DEFAULT_INVITE_POLICY, allowStrangers: true, ...overrides }
}

function enforcer(overrides: { currentUserId?: string; policy?: InvitePolicy; onDeclined?: (info: any) => void } = {}) {
  return new InvitePolicyEnforcer({
    getCurrentUserId: () => overrides.currentUserId ?? '@me:example.org',
    getPolicy: () => overrides.policy ?? policy(),
    onDeclined: overrides.onDeclined ?? vi.fn()
  })
}

/** `m.room.member` 事件的 sender 是邀请人来源（事件本身没有 inviter 字段）。 */
function memberWithInviter(overrides: Record<string, unknown> = {}) {
  return {
    roomId: '!r:example.org',
    userId: '@me:example.org',
    membership: 'invite',
    events: { member: { getSender: () => '@spam:evil.org' } },
    ...overrides
  }
}

function fireMember(member: Record<string, unknown>) {
  for (const { event, handler } of state.handlers) {
    if (event === 'Room.member') {
      handler({}, member)
    }
  }
}

describe('InvitePolicyEnforcer', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    state.handlers = []
    state.offCalls = []
    state.leaveCalls = []
    getClientMock.mockReturnValue(makeClient())
  })

  it('subscribes to Room.member on start', () => {
    const e = enforcer()
    e.start()
    expect(state.handlers.some((h) => h.event === 'Room.member')).toBe(true)
  })

  it('declines an invite that matches the policy', async () => {
    const e = enforcer({ policy: policy({ mode: 'blocklist', blocklist: ['@spam:evil.org'] }) })
    e.start()
    fireMember(memberWithInviter())
    await vi.waitFor(() => expect(state.leaveCalls).toContain('!r:example.org'))
  })

  it('does not decline when the policy allows the inviter', async () => {
    const e = enforcer({ policy: policy({ mode: 'blocklist', blocklist: ['@other:evil.org'] }) })
    e.start()
    fireMember(memberWithInviter())
    await new Promise((r) => setTimeout(r, 20))
    expect(state.leaveCalls).toEqual([])
  })

  it('does not decline an invite addressed to someone else', async () => {
    const e = enforcer({ policy: policy({ mode: 'allowlist' }) })
    e.start()
    fireMember(memberWithInviter({ userId: '@other:example.org' }))
    await new Promise((r) => setTimeout(r, 20))
    expect(state.leaveCalls).toEqual([])
  })

  it('does not decline non-invite membership changes', async () => {
    const e = enforcer({ policy: policy({ mode: 'allowlist' }) })
    e.start()
    fireMember(memberWithInviter({ membership: 'join' }))
    await new Promise((r) => setTimeout(r, 20))
    expect(state.leaveCalls).toEqual([])
  })

  it('declines a given room only once even if the event repeats', async () => {
    const e = enforcer({ policy: policy({ mode: 'blocklist', blocklist: ['@spam:evil.org'] }) })
    e.start()
    for (let i = 0; i < 3; i++) {
      fireMember(memberWithInviter())
    }
    await vi.waitFor(() => expect(state.leaveCalls.length).toBe(1))
    await new Promise((r) => setTimeout(r, 30))
    expect(state.leaveCalls.length).toBe(1)
  })

  it('reports the decline through onDeclined with undo metadata', async () => {
    const onDeclined = vi.fn()
    const e = enforcer({ policy: policy({ mode: 'blocklist', blocklist: ['@spam:evil.org'] }), onDeclined })
    e.start()
    fireMember(memberWithInviter())
    await vi.waitFor(() => expect(onDeclined).toHaveBeenCalled())
    expect(onDeclined.mock.calls[0][0]).toMatchObject({
      roomId: '!r:example.org',
      inviterUserId: '@spam:evil.org'
    })
  })

  it('routes the decline through MembershipService (offline queue aware)', async () => {
    const e = enforcer({ policy: policy({ mode: 'allowlist' }) })
    e.start()
    fireMember(memberWithInviter({ roomId: '!r:offline.org' }))
    await vi.waitFor(() => expect(state.leaveCalls).toContain('!r:offline.org'))
  })

  it('resolves the inviter from the member event sender', async () => {
    // 邀请人来自该成员 m.room.member 事件的 sender。
    // 不能用 RoomMember.getDMInviter()：它依赖 is_direct，普通房间邀请返回 undefined。
    const e = enforcer({ policy: policy({ mode: 'blocklist', blocklist: ['@sender:evil.org'] }) })
    e.start()
    fireMember(
      memberWithInviter({
        events: { member: { getSender: () => '@sender:evil.org' } }
      })
    )
    await vi.waitFor(() => expect(state.leaveCalls).toContain('!r:example.org'))
  })

  it('does not decline when the member event has no sender', async () => {
    const e = enforcer({ policy: policy({ mode: 'allowlist' }) })
    e.start()
    fireMember(memberWithInviter({ events: { member: {} } }))
    await new Promise((r) => setTimeout(r, 20))
    expect(state.leaveCalls).toEqual([])
  })

  it('does not decline when the member has no event at all', async () => {
    const e = enforcer({ policy: policy({ mode: 'allowlist' }) })
    e.start()
    fireMember(memberWithInviter({ events: undefined }))
    await new Promise((r) => setTimeout(r, 20))
    expect(state.leaveCalls).toEqual([])
  })

  describe('only-contacts mode', () => {
    const onlyContacts = policy({ mode: 'allow_all', allowStrangers: false })

    it('declines a confirmed stranger', async () => {
      const e = new InvitePolicyEnforcer({
        getCurrentUserId: () => '@me:example.org',
        getPolicy: () => onlyContacts,
        onDeclined: vi.fn(),
        resolveContactState: async () => 'stranger'
      })
      e.start()
      fireMember(memberWithInviter())
      await vi.waitFor(() => expect(state.leaveCalls).toContain('!r:example.org'))
    })

    it('allows a confirmed contact', async () => {
      const e = new InvitePolicyEnforcer({
        getCurrentUserId: () => '@me:example.org',
        getPolicy: () => onlyContacts,
        onDeclined: vi.fn(),
        resolveContactState: async () => 'contact'
      })
      e.start()
      fireMember(memberWithInviter())
      await new Promise((r) => setTimeout(r, 20))
      expect(state.leaveCalls).toEqual([])
    })

    it('fails open when the contact state is unknown', async () => {
      const e = new InvitePolicyEnforcer({
        getCurrentUserId: () => '@me:example.org',
        getPolicy: () => onlyContacts,
        onDeclined: vi.fn(),
        resolveContactState: async () => 'unknown'
      })
      e.start()
      fireMember(memberWithInviter())
      await new Promise((r) => setTimeout(r, 20))
      expect(state.leaveCalls).toEqual([])
    })

    it('fails open when no resolver is wired at all', async () => {
      const e = new InvitePolicyEnforcer({
        getCurrentUserId: () => '@me:example.org',
        getPolicy: () => onlyContacts,
        onDeclined: vi.fn()
      })
      e.start()
      fireMember(memberWithInviter())
      await new Promise((r) => setTimeout(r, 20))
      expect(state.leaveCalls).toEqual([])
    })

    it('does not query contacts in blocklist mode while strangers are allowed', async () => {
      const resolveContactState = vi.fn(async () => 'stranger' as const)
      const e = new InvitePolicyEnforcer({
        getCurrentUserId: () => '@me:example.org',
        getPolicy: () => policy({ mode: 'blocklist', blocklist: ['@spam:evil.org'] }),
        onDeclined: vi.fn(),
        resolveContactState
      })
      e.start()
      fireMember(memberWithInviter())
      await vi.waitFor(() => expect(state.leaveCalls).toContain('!r:example.org'))
      expect(resolveContactState).not.toHaveBeenCalled()
    })

    /**
     * 评审 Critical #1：旧实现只在 allow_all 下解析联系人状态，blocklist 模式下
     * `contactState` 恒为 undefined，判定退回不可靠的静态 contacts 快照——
     * 默认 allowStrangers=false 时好友的邀请也会被自动拒掉。
     */
    it('does not decline a confirmed contact when a blocklist is in use', async () => {
      const resolveContactState = vi.fn(async () => 'contact' as const)
      const e = new InvitePolicyEnforcer({
        getCurrentUserId: () => '@me:example.org',
        getPolicy: () => policy({ mode: 'blocklist', blocklist: ['@x:evil.org'], allowStrangers: false }),
        onDeclined: vi.fn(),
        resolveContactState
      })
      e.start()
      fireMember(memberWithInviter())
      await vi.waitFor(() => expect(resolveContactState).toHaveBeenCalledWith('@spam:evil.org'))
      await new Promise((r) => setTimeout(r, 20))
      expect(state.leaveCalls).toEqual([])
    })

    it('still declines a confirmed stranger when a blocklist is in use', async () => {
      const resolveContactState = vi.fn(async () => 'stranger' as const)
      const e = new InvitePolicyEnforcer({
        getCurrentUserId: () => '@me:example.org',
        getPolicy: () => policy({ mode: 'blocklist', blocklist: ['@x:evil.org'], allowStrangers: false }),
        onDeclined: vi.fn(),
        resolveContactState
      })
      e.start()
      fireMember(memberWithInviter())
      await vi.waitFor(() => expect(state.leaveCalls).toContain('!r:example.org'))
    })

    it('declines a blocklisted user even when the contact state says contact', async () => {
      const resolveContactState = vi.fn(async () => 'contact' as const)
      const e = new InvitePolicyEnforcer({
        getCurrentUserId: () => '@me:example.org',
        getPolicy: () => policy({ mode: 'blocklist', blocklist: ['@spam:evil.org'], allowStrangers: false }),
        onDeclined: vi.fn(),
        resolveContactState
      })
      e.start()
      fireMember(memberWithInviter())
      await vi.waitFor(() => expect(state.leaveCalls).toContain('!r:example.org'))
    })

    it('allows a non-blocklisted inviter in blocklist mode when strangers are allowed', async () => {
      const resolveContactState = vi.fn(async () => 'stranger' as const)
      const e = new InvitePolicyEnforcer({
        getCurrentUserId: () => '@me:example.org',
        getPolicy: () => policy({ mode: 'blocklist', blocklist: ['@x:evil.org'], allowStrangers: true }),
        onDeclined: vi.fn(),
        resolveContactState
      })
      e.start()
      fireMember(memberWithInviter())
      await new Promise((r) => setTimeout(r, 20))
      expect(state.leaveCalls).toEqual([])
      expect(resolveContactState).not.toHaveBeenCalled()
    })

    it('fails open in blocklist mode when the contact state is unknown', async () => {
      const resolveContactState = vi.fn(async () => 'unknown' as const)
      const e = new InvitePolicyEnforcer({
        getCurrentUserId: () => '@me:example.org',
        getPolicy: () => policy({ mode: 'blocklist', blocklist: ['@x:evil.org'], allowStrangers: false }),
        onDeclined: vi.fn(),
        resolveContactState
      })
      e.start()
      fireMember(memberWithInviter())
      await new Promise((r) => setTimeout(r, 20))
      expect(state.leaveCalls).toEqual([])
    })

    it('does not query contacts when strangers are allowed', async () => {
      const resolveContactState = vi.fn(async () => 'stranger' as const)
      const e = new InvitePolicyEnforcer({
        getCurrentUserId: () => '@me:example.org',
        getPolicy: () => policy({ mode: 'allow_all', allowStrangers: true }),
        onDeclined: vi.fn(),
        resolveContactState
      })
      e.start()
      fireMember(memberWithInviter())
      await new Promise((r) => setTimeout(r, 20))
      expect(resolveContactState).not.toHaveBeenCalled()
      expect(state.leaveCalls).toEqual([])
    })
  })

  it('unsubscribes on stop', () => {
    const e = enforcer()
    e.start()
    e.stop()
    expect(state.offCalls.some((c) => c.event === 'Room.member')).toBe(true)
  })

  it('does not double-subscribe when start is called twice', () => {
    const e = enforcer()
    e.start()
    e.start()
    expect(state.handlers.filter((h) => h.event === 'Room.member').length).toBe(1)
  })

  it('does nothing when there is no client', () => {
    getClientMock.mockReturnValue(null)
    const e = enforcer()
    expect(() => e.start()).not.toThrow()
  })

  it('exposes a bounded undo window', () => {
    expect(INVITE_DECLINE_UNDO_WINDOW_MS).toBeGreaterThan(0)
    expect(INVITE_DECLINE_UNDO_WINDOW_MS).toBeLessThanOrEqual(5 * 60 * 1000)
  })

  describe('undo', () => {
    it('rejoins a room that was auto-declined within the window', async () => {
      const joinRoom = vi.fn(async () => {})
      getClientMock.mockReturnValue({ ...makeClient(), joinRoom })
      const e = enforcer({ policy: policy({ mode: 'blocklist', blocklist: ['@spam:evil.org'] }) })
      e.start()
      fireMember(memberWithInviter())
      await vi.waitFor(() => expect(state.leaveCalls).toContain('!r:example.org'))

      const ok = await e.undo('!r:example.org')
      expect(ok).toBe(true)
      expect(joinRoom).toHaveBeenCalledWith('!r:example.org')
    })

    it('refuses to undo a room that was never auto-declined', async () => {
      const e = enforcer()
      e.start()
      expect(await e.undo('!never:example.org')).toBe(false)
    })

    it('refuses to undo twice', async () => {
      const joinRoom = vi.fn(async () => {})
      getClientMock.mockReturnValue({ ...makeClient(), joinRoom })
      const e = enforcer({ policy: policy({ mode: 'blocklist', blocklist: ['@spam:evil.org'] }) })
      e.start()
      fireMember(memberWithInviter())
      await vi.waitFor(() => expect(state.leaveCalls).toContain('!r:example.org'))

      expect(await e.undo('!r:example.org')).toBe(true)
      expect(await e.undo('!r:example.org')).toBe(false)
    })

    it('returns false when the rejoin fails', async () => {
      const joinRoom = vi.fn(async () => {
        throw new Error('forbidden')
      })
      getClientMock.mockReturnValue({ ...makeClient(), joinRoom })
      const e = enforcer({ policy: policy({ mode: 'blocklist', blocklist: ['@spam:evil.org'] }) })
      e.start()
      fireMember(memberWithInviter())
      await vi.waitFor(() => expect(state.leaveCalls).toContain('!r:example.org'))
      expect(await e.undo('!r:example.org')).toBe(false)
    })
  })
})
