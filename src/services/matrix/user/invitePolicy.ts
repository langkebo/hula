import { createLogger } from '@/utils/Logger'
import { safeJsonParse, validateObject } from '@/utils/typeGuard'

const logger = createLogger('InvitePolicy')

/**
 * 邀请 / 非联系人私聊策略（账号级）。
 *
 * ## 为什么必须有强制点
 *
 * 后端 `synapse-rust` 确实有邀请名单能力，但**是房间级且没有强制**：
 * - `room_invite_blocklist` / `room_invite_allowlist` 两张表 +
 *   `GET|POST` 形式的房间级 invite_blocklist / invite_allowlist 读写端点
 * - `InviteBlocklistStorage::is_user_blocked()` 全仓只有定义与它自己的存储测试，
 *   **零调用点**；邀请授权路径 `authorize_inbound_member_transition` 只校验
 *   ban / join_rule / 状态机，没有策略钩子
 * - 实测线上 homeserver 不支持 MSC3873 / MSC4155（账号级邀请策略相关 MSC）
 *
 * 因此账号级策略只能在客户端强制：监听 `Room.member`，若被邀请者是自己且策略命中，
 * 立即 `leave()` 拒邀。见 `InvitePolicyEnforcer`。
 *
 * ## 与后端命名的关系（重要）
 *
 * 原先这里用的 account data key 是 `im.hula.invite_blocklist`，与后端**房间级**
 * 表名/端点同名，但语义是账号级——改账号设置的人会以为改了房间。
 * 现改为 `im.hula.invite_policy`，避免与房间级概念混淆。
 */
export const INVITE_POLICY_ACCOUNT_DATA_TYPE = 'im.hula.invite_policy'

export const INVITE_POLICY_MODES = ['allow_all', 'blocklist', 'allowlist'] as const

export type InvitePolicyMode = (typeof INVITE_POLICY_MODES)[number]

export interface InvitePolicy {
  /** `allow_all` 不按名单拒绝；`blocklist` 拒绝名单内；`allowlist` 仅放行名单内。 */
  mode: InvitePolicyMode
  /** mode === 'blocklist' 时生效。 */
  blocklist: string[]
  /** mode === 'allowlist' 时生效。 */
  allowlist: string[]
  /**
   * 是否允许非联系人发起的私聊（房间邀请）。
   *
   * 仅在 `mode === 'allow_all'` 时参与判定：名单模式已经表达了「谁能进」，
   * 再用 contacts 二次判定会互相矛盾。
   */
  allowStrangers: boolean
  /**
   * 联系人（好友）user id 快照。
   *
   * 仅用于展示/调试：**不再参与判定**。判定改用 `ContactStateResolver` 的三态结果，
   * 因为这份静态快照在查询失败时是空的，会让"仅允许联系人"退化成"谁都不认识"。
   */
  contacts: string[]
}

/**
 * 默认策略：不按名单拒绝，但**只允许联系人发起私聊**。
 *
 * 为什么默认开启「仅允许联系人」：私聊是陌生人触达用户最直接的通道，
 * 默认放开等于默认接受任意人建立加密会话。默认收紧、由用户显式放开，
 * 是更合理的安全基线。
 *
 * 这个默认值只在「从未保存过策略」时生效（`loadInvitePolicy` 的兜底分支）：
 * 已有本地策略的用户保留自己的选择，不会被静默改写。
 * 详见本文件关于迁移的说明。
 */
export const DEFAULT_INVITE_POLICY: InvitePolicy = {
  mode: 'allow_all',
  blocklist: [],
  allowlist: [],
  allowStrangers: false,
  contacts: []
}

export function isInvitePolicyMode(value: unknown): value is InvitePolicyMode {
  return typeof value === 'string' && (INVITE_POLICY_MODES as readonly string[]).includes(value)
}

/** 归一化 Matrix 用户 id：去空白。不做大小写折叠——Matrix id 局部部分大小写敏感。 */
export function normalizeUserId(userId: unknown): string {
  return typeof userId === 'string' ? userId.trim() : ''
}

function normalizeUserIdList(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return []
  }
  const seen = new Set<string>()
  const result: string[] = []
  for (const entry of value) {
    const userId = normalizeUserId(entry)
    if (!userId || seen.has(userId)) {
      continue
    }
    seen.add(userId)
    result.push(userId)
  }
  return result
}

export function normalizeInvitePolicy(input: unknown): InvitePolicy {
  if (!input || typeof input !== 'object') {
    return { ...DEFAULT_INVITE_POLICY, blocklist: [], allowlist: [], contacts: [] }
  }

  const candidate = input as Partial<InvitePolicy>

  return {
    mode: isInvitePolicyMode(candidate.mode) ? candidate.mode : DEFAULT_INVITE_POLICY.mode,
    blocklist: normalizeUserIdList(candidate.blocklist),
    allowlist: normalizeUserIdList(candidate.allowlist),
    allowStrangers:
      typeof candidate.allowStrangers === 'boolean' ? candidate.allowStrangers : DEFAULT_INVITE_POLICY.allowStrangers,
    contacts: normalizeUserIdList(candidate.contacts)
  }
}

/**
 * 是否应自动拒绝来自 `inviterUserId` 的邀请。
 *
 * 判定顺序：
 * 1. 名单模式优先（blocklist / allowlist）——名单是显式表达，优先级最高
 * 2. `allow_all` 下若关闭了「允许非联系人私聊」，非联系人一律拒绝
 *
 * 无法确定邀请人身份（空白 id）时，只要不是 allow_all 就拒绝：
 * 拿不到身份不能默认放行。
 */
export function shouldRejectInvite(inviterUserId: unknown, policy: InvitePolicy): boolean {
  const normalized = normalizeInvitePolicy(policy)
  const inviter = normalizeUserId(inviterUserId)

  if (normalized.mode === 'blocklist') {
    return inviter ? normalized.blocklist.includes(inviter) : true
  }

  if (normalized.mode === 'allowlist') {
    return inviter ? !normalized.allowlist.includes(inviter) : true
  }

  if (normalized.allowStrangers) {
    return false
  }

  // 非联系人私聊未开启：拿不到身份时同样不放行
  return inviter ? !normalized.contacts.includes(inviter) : true
}

export function loadInvitePolicy(storage: Pick<Storage, 'getItem'> = localStorage): InvitePolicy {
  let stored: string | null = null
  try {
    stored = storage.getItem(INVITE_POLICY_ACCOUNT_DATA_TYPE)
  } catch (err) {
    logger.warn('读取本地邀请策略缓存失败:', err)
    return normalizeInvitePolicy(null)
  }

  if (!stored) {
    return normalizeInvitePolicy(null)
  }

  const isValidShape = (val: unknown): val is Partial<InvitePolicy> =>
    validateObject<Record<string, unknown>>(val, [], {
      mode: (v) => v === undefined || isInvitePolicyMode(v),
      blocklist: (v) => v === undefined || Array.isArray(v),
      allowlist: (v) => v === undefined || Array.isArray(v),
      allowStrangers: (v) => v === undefined || typeof v === 'boolean',
      contacts: (v) => v === undefined || Array.isArray(v)
    })

  return normalizeInvitePolicy(safeJsonParse(stored, isValidShape, {}))
}

/**
 * 本地缓存邀请策略。
 *
 * account data 是权威来源，但读取需要已登录客户端；缓存一份可让未登录/离线时
 * 沿用上次策略，而不是退回 allow_all（那会让自动拒邀静默失效）。
 */
export function cacheInvitePolicy(policy: InvitePolicy, storage: Pick<Storage, 'setItem'> = localStorage): void {
  try {
    storage.setItem(INVITE_POLICY_ACCOUNT_DATA_TYPE, JSON.stringify(normalizeInvitePolicy(policy)))
  } catch (err) {
    logger.warn('缓存邀请策略失败:', err)
  }
}
