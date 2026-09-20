import { type InvitePolicy, normalizeInvitePolicy, normalizeUserId, shouldRejectInvite } from './invitePolicy'

/**
 * 邀请策略的事件级判定。
 *
 * 从 `InvitePolicyEnforcer` 里抽出成纯函数的原因：真正的强制行为（离开房间）
 * 需要 MatrixClient，但"这条事件该不该处理"是纯粹的判定，必须能独立测试——
 * 强制点一旦判错，用户会莫名丢失别人的邀请，属于高风险逻辑。
 */

export interface InviteEventLike {
  roomId: string
  /** 这条 membership 事件的主体（被邀请/被加入的人）。 */
  targetUserId: string | undefined
  membership: string | undefined
  /** 邀请发起者；`m.room.member` 事件本身通常不含，需回退到房间状态。 */
  inviterUserId?: string | undefined
}

export interface InvitePolicyDecision {
  action: 'decline'
  roomId: string
  inviterUserId: string
}

/**
 * 判定是否要自动拒绝这条邀请。
 *
 * 返回 `null` 表示不动作。**失败方向是"不动作"而不是"拒邀"**：
 * - 拿不到自己的 user id 时无法判断邀请是不是给自己的，此时按策略一律拒邀会误拒他人邀请
 * - 拿不到邀请人时无法评估策略，同样不动作（宁可漏放，不可误拒）
 */
export function decideInviteAction(
  event: InviteEventLike,
  policy: InvitePolicy,
  currentUserId: string | undefined,
  fallbackInviterUserId?: string | undefined
): InvitePolicyDecision | null {
  if (event.membership !== 'invite') {
    return null
  }

  const roomId = typeof event.roomId === 'string' ? event.roomId.trim() : ''
  if (!roomId) {
    return null
  }

  const me = normalizeUserId(currentUserId)
  if (!me) {
    return null
  }

  if (normalizeUserId(event.targetUserId) !== me) {
    return null
  }

  const inviter = normalizeUserId(event.inviterUserId) || normalizeUserId(fallbackInviterUserId)
  if (!inviter) {
    return null
  }

  /**
   * 自己邀请自己（例如把自己拉进自建房间）时，不套用「非联系人私聊」规则：
   * 自己不是陌生人，用 allowlist / contacts 去卡自己的邀请是错的。
   *
   * 但显式把自己写进 blocklist 仍然生效——那是用户的明确意图。
   */
  if (inviter === me) {
    return normalizeInvitePolicy(policy).blocklist.includes(me)
      ? { action: 'decline', roomId, inviterUserId: inviter }
      : null
  }

  if (!shouldRejectInvite(inviter, policy)) {
    return null
  }

  return { action: 'decline', roomId, inviterUserId: inviter }
}
