import { describe, expect, it, vi } from 'vitest'
import { DEFAULT_INVITE_POLICY, type InvitePolicy } from '@/services/matrix/user/invitePolicy'
import type { InvitePolicyEnforcerOptions } from '@/services/matrix/user/invitePolicyEnforcer'
import { useInvitePolicyEnforcement } from '../useInvitePolicyEnforcement'

/**
 * 邀请策略的挂载层：把强制点接到连接生命周期上。
 *
 * 关键行为（都曾是想当然就会漏掉的点）：
 * 1. 只在连接建立后启动——客户端没起来时 on/off 是空操作
 * 2. 启动时把好友列表同步进策略的 contacts，否则"允许非联系人私聊"关闭后
 *    会把所有好友的邀请也拒掉
 * 3. 断开时停止，避免登出后仍持有旧客户端
 */

interface Harness {
  start: ReturnType<typeof vi.fn>
  stop: ReturnType<typeof vi.fn>
  undo: ReturnType<typeof vi.fn>
  canUndo: ReturnType<typeof vi.fn>
}

function harness() {
  const enforcer: Harness = {
    start: vi.fn(),
    stop: vi.fn(),
    undo: vi.fn(async () => true),
    canUndo: vi.fn(() => true)
  }
  const policyRef: { value: InvitePolicy } = { value: { ...DEFAULT_INVITE_POLICY } }
  const getPolicy = vi.fn((): InvitePolicy => policyRef.value)
  const getPolicyStrict = vi.fn(async (): Promise<InvitePolicy | null> => policyRef.value)
  const savePolicy = vi.fn(async (_policy: InvitePolicy) => true)
  const getContacts = vi.fn(async (): Promise<string[]> => ['@friend:server'])
  const captured: { options?: InvitePolicyEnforcerOptions } = {}

  const deps = {
    createEnforcer: vi.fn((options: InvitePolicyEnforcerOptions) => {
      captured.options = options
      return enforcer as never
    }),
    getCurrentUserId: vi.fn((): string | undefined => '@me:example.org'),
    getPolicy,
    getPolicyStrict,
    savePolicy,
    getContacts,
    onDeclined: vi.fn()
  }
  return { enforcer, deps, getPolicy, getPolicyStrict, savePolicy, getContacts, policyRef, captured }
}

describe('useInvitePolicyEnforcement', () => {
  it('exposes start/stop/undo/canUndo', () => {
    const { deps } = harness()
    const api = useInvitePolicyEnforcement(deps)
    expect(typeof api.start).toBe('function')
    expect(typeof api.stop).toBe('function')
    expect(typeof api.undo).toBe('function')
    expect(typeof api.canUndo).toBe('function')
  })

  it('creates the enforcer with the current user and policy accessors', () => {
    const { deps, captured } = harness()
    const api = useInvitePolicyEnforcement(deps)
    api.start()
    expect(deps.createEnforcer).toHaveBeenCalled()
    expect(captured.options?.getCurrentUserId()).toBe('@me:example.org')
    expect(captured.options?.getPolicy()).toMatchObject({ mode: 'allow_all' })
  })

  it('starts the enforcer on start', () => {
    const { deps, enforcer } = harness()
    useInvitePolicyEnforcement(deps).start()
    expect(enforcer.start).toHaveBeenCalledTimes(1)
  })

  it('is idempotent — start twice only starts once', () => {
    const { deps, enforcer } = harness()
    const api = useInvitePolicyEnforcement(deps)
    api.start()
    api.start()
    expect(enforcer.start).toHaveBeenCalledTimes(1)
  })

  it('stops the enforcer on stop', () => {
    const { deps, enforcer } = harness()
    const api = useInvitePolicyEnforcement(deps)
    api.start()
    api.stop()
    expect(enforcer.stop).toHaveBeenCalledTimes(1)
  })

  it('can be restarted after stop', () => {
    const { deps, enforcer } = harness()
    const api = useInvitePolicyEnforcement(deps)
    api.start()
    api.stop()
    api.start()
    expect(enforcer.start).toHaveBeenCalledTimes(2)
  })

  it('syncs contacts into the policy so friends are not treated as strangers', async () => {
    const { deps, savePolicy } = harness()
    const api = useInvitePolicyEnforcement(deps)
    await api.syncContacts()
    expect(savePolicy).toHaveBeenCalledWith(expect.objectContaining({ contacts: ['@friend:server'] }))
  })

  it('does not write the policy when the contact list is unchanged', async () => {
    const { deps, savePolicy, policyRef } = harness()
    policyRef.value = { ...policyRef.value, contacts: ['@friend:server'] }
    const api = useInvitePolicyEnforcement(deps)
    await api.syncContacts()
    expect(savePolicy).not.toHaveBeenCalled()
  })

  it('writes the policy when a contact is removed', async () => {
    const { deps, savePolicy, policyRef } = harness()
    policyRef.value = { ...policyRef.value, contacts: ['@friend:server', '@gone:server'] }
    const api = useInvitePolicyEnforcement(deps)
    await api.syncContacts()
    expect(savePolicy).toHaveBeenCalledWith(expect.objectContaining({ contacts: ['@friend:server'] }))
  })

  it('preserves all other policy fields while syncing contacts', async () => {
    const { deps, savePolicy, policyRef } = harness()
    policyRef.value = { ...policyRef.value, mode: 'blocklist', blocklist: ['@bad:server'], allowStrangers: false }
    const api = useInvitePolicyEnforcement(deps)
    await api.syncContacts()
    expect(savePolicy).toHaveBeenCalledWith(
      expect.objectContaining({ mode: 'blocklist', blocklist: ['@bad:server'], allowStrangers: false })
    )
  })

  it('does not throw when loading contacts fails', async () => {
    const { deps, getContacts } = harness()
    getContacts.mockRejectedValueOnce(new Error('offline'))
    const api = useInvitePolicyEnforcement(deps)
    await expect(api.syncContacts()).resolves.toBeUndefined()
  })

  /**
   * C1 回归：启动时的 contacts 同步曾用宽松读（localStorage 缓存/默认值）整对象 PUT。
   * 新设备 / 清缓存 / 换账号后，服务端的 mode/blocklist/allowlist/allowStrangers/
   * 好友请求字段会被默认值静默覆盖。现在必须严格重读、只合并 contacts。
   */
  it('writes from the strict server read, preserving every field it does not own', async () => {
    const { deps, savePolicy, getPolicyStrict } = harness()
    getPolicyStrict.mockResolvedValueOnce({
      mode: 'allowlist',
      blocklist: ['@blocked:evil.org'],
      allowlist: ['@boss:corp.org'],
      allowStrangers: false,
      allowFriendRequests: false,
      autoAcceptFriends: true,
      requireFriendRequestMessage: false,
      contacts: []
    })
    const api = useInvitePolicyEnforcement(deps)
    await api.syncContacts()
    expect(savePolicy).toHaveBeenCalledWith({
      mode: 'allowlist',
      blocklist: ['@blocked:evil.org'],
      allowlist: ['@boss:corp.org'],
      allowStrangers: false,
      allowFriendRequests: false,
      autoAcceptFriends: true,
      requireFriendRequestMessage: false,
      contacts: ['@friend:server']
    })
  })

  it('skips the write entirely when the strict read fails', async () => {
    const { deps, savePolicy, getPolicyStrict } = harness()
    getPolicyStrict.mockRejectedValueOnce(new Error('network down'))
    const api = useInvitePolicyEnforcement(deps)
    await expect(api.syncContacts()).resolves.toBeUndefined()
    expect(savePolicy).not.toHaveBeenCalled()
  })

  it('creates from defaults only when the account never stored a policy', async () => {
    const { deps, savePolicy, getPolicyStrict } = harness()
    getPolicyStrict.mockResolvedValueOnce(null)
    const api = useInvitePolicyEnforcement(deps)
    await api.syncContacts()
    expect(savePolicy).toHaveBeenCalledWith({ ...DEFAULT_INVITE_POLICY, contacts: ['@friend:server'] })
  })

  it('delegates undo to the enforcer', async () => {
    const { deps, enforcer } = harness()
    const api = useInvitePolicyEnforcement(deps)
    api.start()
    await expect(api.undo('!r:example.org')).resolves.toBe(true)
    expect(enforcer.undo).toHaveBeenCalledWith('!r:example.org')
  })

  it('returns false from undo before start', async () => {
    const { deps } = harness()
    await expect(useInvitePolicyEnforcement(deps).undo('!r:example.org')).resolves.toBe(false)
  })

  it('reports canUndo as false before start', () => {
    const { deps } = harness()
    expect(useInvitePolicyEnforcement(deps).canUndo('!r:example.org')).toBe(false)
  })
})
