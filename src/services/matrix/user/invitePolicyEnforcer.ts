import { createLogger } from '@/utils/Logger'
import matrixClientService from '../MatrixClientService'
import { matrixRoomMembershipService } from '../room/MembershipService'
import type { ContactState } from './contactStateResolver'
import type { InvitePolicy } from './invitePolicy'
import { decideInviteAction } from './invitePolicyDecision'

const logger = createLogger('InvitePolicyEnforcer')

/** `Room.member` 的客户端级事件名（与 RealtimeService 中的常量一致）。 */
const ROOM_MEMBER_EVENT = 'Room.member'

/** 自动拒邀后允许撤回的时间窗。 */
export const INVITE_DECLINE_UNDO_WINDOW_MS = 60_000

/**
 * 只描述本模块真正用到的字段。
 *
 * 用结构化接口而不是 `import type { RoomMember } from 'matrix-js-sdk'`：
 * SDK 边界守卫（check:sdk-boundary）只允许白名单文件直接 import matrix-js-sdk；
 * 这里需要的字段极少，本地声明反而更清楚，也更好构造测试替身。
 */
export interface InviteMemberLike {
  roomId: string
  userId: string
  membership?: string
  events?: {
    /** 该成员的 m.room.member 事件；邀请人就是它的 sender。 */
    member?: { getSender?: () => string | undefined }
  }
}

export interface InviteDeclinedInfo {
  roomId: string
  inviterUserId: string
  /** 撤回截止时间戳（毫秒），便于 UI 判断。 */
  undoDeadline: number
}

export interface InvitePolicyEnforcerOptions {
  getCurrentUserId: () => string | undefined
  getPolicy: () => InvitePolicy
  onDeclined: (info: InviteDeclinedInfo) => void
  /**
   * 解析邀请人是否为联系人（三态）。
   *
   * 省略时按 `unknown` 处理——即「仅允许联系人私聊」在缺少该依赖时不会误拒。
   */
  resolveContactState?: (userId: string) => Promise<ContactState>
}

interface EventTarget {
  on(event: string, handler: (event: unknown, member: InviteMemberLike) => void): void
  off(event: string, handler: (event: unknown, member: InviteMemberLike) => void): void
}

interface AcceptingClient {
  joinRoom?: (roomId: string) => Promise<unknown>
}

interface DeclinedInvite {
  inviterUserId: string
  declinedAt: number
}

/**
 * 账号级邀请策略的强制点。
 *
 * 监听 `Room.member`：当被邀请者是自己且策略命中时，立即离开房间完成"拒邀"。
 *
 * 为什么走 `membershipService.leaveRoom` 而不是直接 `client.leave`：
 * 该服务已处理离线入队与错误日志，直接调 SDK 会绕过这些路径。
 *
 * 为什么记录已拒房间：一次邀请可能触发多条 member 事件，重复 `leave` 会
 * 产生无意义的请求与重复提示。
 */
export class InvitePolicyEnforcer {
  private handler: ((event: unknown, member: InviteMemberLike) => void) | null = null
  private client: EventTarget | null = null
  private readonly declined = new Map<string, DeclinedInvite>()

  constructor(private readonly options: InvitePolicyEnforcerOptions) {}

  start(): void {
    if (this.handler) {
      return
    }

    const client = matrixClientService.getClient()
    if (!client) {
      logger.warn('无法启动邀请策略强制：客户端未初始化')
      return
    }

    this.client = client as unknown as EventTarget
    this.handler = (_event: unknown, member: InviteMemberLike) => {
      void this.handleMember(member)
    }
    this.client.on(ROOM_MEMBER_EVENT, this.handler)
    logger.info('邀请策略强制已启动')
  }

  stop(): void {
    if (this.handler && this.client) {
      this.client.off(ROOM_MEMBER_EVENT, this.handler)
    }
    this.handler = null
    this.client = null
  }

  /**
   * 撤回一次自动拒邀：重新加入该房间。
   *
   * 返回是否成功撤回。只允许撤回本会话内自动拒过的房间，且只允许一次。
   */
  async undo(roomId: string): Promise<boolean> {
    const record = this.declined.get(roomId)
    if (!record) {
      return false
    }

    if (Date.now() - record.declinedAt > INVITE_DECLINE_UNDO_WINDOW_MS) {
      this.declined.delete(roomId)
      logger.info(`撤回窗口已过，不再撤回: ${roomId}`)
      return false
    }

    // 先移除记录：无论成功与否都不允许对同一房间重复撤回
    this.declined.delete(roomId)

    try {
      const client = matrixClientService.getClient() as unknown as AcceptingClient | null
      if (!client?.joinRoom) {
        logger.error('撤回失败：客户端不支持 joinRoom')
        return false
      }
      await client.joinRoom(roomId)
      logger.info(`已撤回自动拒邀并重新加入: ${roomId}`)
      return true
    } catch (err) {
      logger.error(`撤回自动拒邀失败: ${roomId} ${err}`)
      return false
    }
  }

  /** 该房间是否在撤回窗口内。 */
  canUndo(roomId: string): boolean {
    const record = this.declined.get(roomId)
    if (!record) {
      return false
    }
    return Date.now() - record.declinedAt <= INVITE_DECLINE_UNDO_WINDOW_MS
  }

  private async handleMember(member: InviteMemberLike): Promise<void> {
    const roomId = member?.roomId
    if (!roomId) {
      return
    }

    const policy = this.options.getPolicy()
    const inviterUserId = this.resolveInviter(member)

    /*
     * 只在「仅允许联系人私聊」时才去查联系人状态：这是唯一需要网络查询的判定。
     *
     * 条件必须同时覆盖 `allow_all` 与 `blocklist`——这两个模式下非名单用户都受
     * `allowStrangers` 约束。旧实现只认 `allow_all`，于是 blocklist 模式拿不到
     * `contactState`，判定退回不可靠的静态 contacts 快照，默认 `allowStrangers:
     * false` 时连好友的邀请都会被自动拒掉（评审 Critical #1）。
     * `allowlist` 由名单显式决定，不需要查询。
     */
    let contactState: ContactState | undefined
    if (policy.allowStrangers === false && policy.mode !== 'allowlist' && inviterUserId) {
      contactState = (await this.options.resolveContactState?.(inviterUserId)) ?? 'unknown'
    }

    const decision = decideInviteAction(
      {
        roomId,
        targetUserId: member.userId,
        membership: member.membership,
        inviterUserId
      },
      policy,
      this.options.getCurrentUserId(),
      undefined,
      contactState
    )

    if (!decision) {
      return
    }

    if (this.declined.has(decision.roomId)) {
      return
    }

    const declinedAt = Date.now()
    this.declined.set(decision.roomId, { inviterUserId: decision.inviterUserId, declinedAt })

    try {
      await matrixRoomMembershipService.leaveRoom(decision.roomId)
      logger.info(`已按邀请策略自动拒邀: ${decision.roomId}（邀请人 ${decision.inviterUserId}）`)
      this.options.onDeclined({
        roomId: decision.roomId,
        inviterUserId: decision.inviterUserId,
        undoDeadline: declinedAt + INVITE_DECLINE_UNDO_WINDOW_MS
      })
    } catch (err) {
      // 拒邀失败则移除记录，允许后续事件重试
      this.declined.delete(decision.roomId)
      logger.error(`自动拒邀失败: ${decision.roomId} ${err}`)
    }
  }

  /**
   * 邀请人 = 该成员 `m.room.member` 事件的 sender。
   *
   * 不用 `RoomMember.getDMInviter()`：它依赖邀请事件里的 `is_direct`，
   * 只在私聊场景成立，普通房间邀请会返回 undefined。
   */
  private resolveInviter(member: InviteMemberLike): string | undefined {
    return member.events?.member?.getSender?.()
  }
}

export function createInvitePolicyEnforcer(options: InvitePolicyEnforcerOptions): InvitePolicyEnforcer {
  return new InvitePolicyEnforcer(options)
}
