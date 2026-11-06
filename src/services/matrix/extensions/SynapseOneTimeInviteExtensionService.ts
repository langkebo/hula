import { createLogger } from '@/utils/Logger'
import { INVITES } from '../paths/invites'
import { SynapseExtensionHttpBase } from './SynapseExtensionHttpBase'

const logger = createLogger('SynapseOneTimeInvite')

/** 后端 `POST /invites/one-time` 的响应（B-9） */
export interface OneTimeInviteCreated {
  /** 明文 token：**只返回一次**，服务端只存 SHA-256 */
  token: string
  /** 过期时间（毫秒时间戳） */
  expires_at: number
  /** 可分享的凭据载体（POST-only 接口地址，不是可点击落地页） */
  deep_link: string
}

/** 后端 `POST /invites/claim` 的响应 */
interface OneTimeInviteClaimed {
  room_id: string | null
  room_alias: string | null
}

/**
 * 一次性邀请（B-9）前端接入。
 *
 * ## 能力边界（必须对用户说清）
 *
 * 能兑现：**单次 + 带外分享 + 时效**。
 * 不能兑现：claim 之后房间成员表仍暴露双方 MXID ——
 * 「发起者永远不知道对方是谁」是 SimpleX 那种协议级能力，这里做不到。
 * UI 文案不得暗示后者。
 */
class SynapseOneTimeInviteExtensionService extends SynapseExtensionHttpBase {
  /**
   * 铸造一次性邀请 token。
   *
   * @param ttlMs 有效期（毫秒）。不传则用服务端默认（后端默认 24h 量级）。
   */
  async create(ttlMs?: number): Promise<OneTimeInviteCreated> {
    const body = ttlMs && ttlMs > 0 ? JSON.stringify({ ttl_ms: ttlMs }) : JSON.stringify({})
    const response = await this.request<OneTimeInviteCreated | { data?: OneTimeInviteCreated }>(INVITES.ONE_TIME, {
      method: 'POST',
      body
    })
    const data = this.unwrapMaybeWrappedData<OneTimeInviteCreated>(response)
    if (!data?.token) {
      // 后端契约要求一定返回 token；缺失说明版本错配，不能静默当作成功
      logger.error('一次性邀请响应缺少 token', response)
      throw new Error(this.t('friend.one_time_invite.create_failed'))
    }
    return data
  }

  /**
   * 认领邀请（以当前登录用户身份）。
   *
   * 后端错误语义：
   * - 404 token 不存在
   * - 400 已过期
   * - 403 已被使用
   * 三者都应转成可读文案；重放同一 token 第二次必然 403（安全测试的验收点）。
   */
  async claim(token: string): Promise<OneTimeInviteClaimed> {
    const response = await this.request<OneTimeInviteClaimed | { data?: OneTimeInviteClaimed }>(INVITES.CLAIM, {
      method: 'POST',
      body: JSON.stringify({ token })
    })
    const data = this.unwrapMaybeWrappedData<OneTimeInviteClaimed>(response)
    return { room_id: data?.room_id ?? null, room_alias: data?.room_alias ?? null }
  }
}

export const synapseOneTimeInviteService = new SynapseOneTimeInviteExtensionService()
