/**
 * 邀请策略测试夹具。
 *
 * 契约来源：`src/services/matrix/user/invitePolicy.ts` 的 `InvitePolicy`
 * （`im.hula.invite_policy` account data 的归一化形状）。
 */
import type { InvitePolicy } from '@/services/matrix/user/invitePolicy'

export function makeInvitePolicy(overrides: Partial<InvitePolicy> = {}): InvitePolicy {
  return {
    mode: 'allow_all',
    blocklist: [],
    allowlist: [],
    allowStrangers: false,
    allowFriendRequests: true,
    autoAcceptFriends: false,
    requireFriendRequestMessage: false,
    contacts: [],
    ...overrides
  }
}
