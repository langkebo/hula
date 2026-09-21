import { createLogger } from '@/utils/Logger'
import { safeJsonParse, validateObject } from '@/utils/typeGuard'
import type { ContactState } from './contactStateResolver'

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
  /** `allow_all` 不按名单拒绝；`blocklist` 仅表示「默认放行」（名单本身与 mode 正交）；`allowlist` 仅放行名单内。 */
  mode: InvitePolicyMode
  /**
   * 拒绝名单。与 `mode` 正交：名单内的人在任何 mode 下都被拒绝，
   * 包括 `allow_all`（否则一屏蔽某人就会把「仅允许联系人」基线静默关掉）。
   */
  blocklist: string[]
  /** `mode === 'allowlist'` 时生效。 */
  allowlist: string[]
  /**
   * 是否允许非联系人发起的私聊（房间邀请）。
   *
   * 除 `mode === 'allowlist'` 外都参与判定：名单里没写的人走这条规则，
   * 名单是叠加在它之上的拒绝维度，而不是替代它的模式。
   */
  allowStrangers: boolean
  /**
   * 是否允许接收好友请求。
   *
   * **消费方在 synapse-rust 后端**：它读取同一份 `im.hula.invite_policy`
   * account data 来裁决好友请求。前端只负责读写与归一化，不做本地强制，
   * 因此本仓库无法给出「开关真的生效」的行为证据。
   */
  allowFriendRequests: boolean
  /** 是否自动接受收到的好友请求。消费方同上（后端 account data）。 */
  autoAcceptFriends: boolean
  /** 发送好友请求是否必须附言。消费方同上（后端 account data）。 */
  requireFriendRequestMessage: boolean
  /**
   * 联系人（好友）user id 快照。
   *
   * **不参与判定**，只随 account data 往返保存（展示/调试/兼容旧数据）。
   * 判定一律用 `ContactStateResolver` 的**动态**三态结果，由调用方传给
   * `shouldRejectInvite` / `decideInviteAction`：
   * 这份静态快照在查询失败时是空的，一旦拿它当依据，「仅允许联系人」就会
   * 退化成「谁都不认识」，把好友的邀请一起拒掉。
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
  // 好友请求默认放开接收，但不自动接受；附言是默认要求（与旧 UI 默认一致）
  allowFriendRequests: true,
  autoAcceptFriends: false,
  requireFriendRequestMessage: true,
  contacts: []
}

export function isInvitePolicyMode(value: unknown): value is InvitePolicyMode {
  return typeof value === 'string' && (INVITE_POLICY_MODES as readonly string[]).includes(value)
}

/** 归一化 Matrix 用户 id：去空白。不做大小写折叠——Matrix id 局部部分大小写敏感。 */
export function normalizeUserId(userId: unknown): string {
  return typeof userId === 'string' ? userId.trim() : ''
}

/** 布尔字段归一化：非法输入（缺失 / 字符串 / 数字 / null）一律回落默认值。 */
function normalizeBoolean(value: unknown, fallback: boolean): boolean {
  return typeof value === 'boolean' ? value : fallback
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
    allowStrangers: normalizeBoolean(candidate.allowStrangers, DEFAULT_INVITE_POLICY.allowStrangers),
    allowFriendRequests: normalizeBoolean(candidate.allowFriendRequests, DEFAULT_INVITE_POLICY.allowFriendRequests),
    autoAcceptFriends: normalizeBoolean(candidate.autoAcceptFriends, DEFAULT_INVITE_POLICY.autoAcceptFriends),
    requireFriendRequestMessage: normalizeBoolean(
      candidate.requireFriendRequestMessage,
      DEFAULT_INVITE_POLICY.requireFriendRequestMessage
    ),
    contacts: normalizeUserIdList(candidate.contacts)
  }
}

/**
 * 是否应自动拒绝来自 `inviterUserId` 的邀请。
 *
 * `contactState` 是「仅允许联系人」规则的**唯一**依据，必须是
 * `ContactStateResolver` 的**动态**三态结果：
 * - `stranger` 拒绝
 * - `contact` 放行
 * - `unknown` / 未提供：fail-open 放行——查询失败与「确认不是好友」不可区分，
 *   把失败当陌生人会在后端抖动时误拒所有好友
 *
 * `policy.contacts` 里那份静态快照**不参与判定**（查询失败时它是空的）。
 *
 * 判定顺序：
 * 1. `blocklist` 与 `mode` 正交，先判：名单内的人永远拒绝，任何 mode、任何
 *    `contactState` 都压不过它。这条规则不能落在任何 mode 分支里——
 *    `mode === 'blocklist'` 一旦提前 return，`allowStrangers` 就被绕过，
 *    用户屏蔽一个人就会静默关掉「仅允许联系人」基线。
 * 2. `allowlist` 是显式白名单，只放行名单内的人，不看 `contactState`（显式表达
 *    优先于动态查询，失败也不 fail-open）。
 * 3. 其余模式看 `allowStrangers`：放开则放行。
 * 4. 最后才是「仅允许联系人」：只有确认的 `stranger` 才拒。
 *
 * 拿不到邀请人身份（空白 id）时，只要走到最后一步就拒绝：连身份都读不到，
 * 谈不上"可能的好友"，不能默认放行。
 */
export function shouldRejectInvite(inviterUserId: unknown, policy: InvitePolicy, contactState?: ContactState): boolean {
  const normalized = normalizeInvitePolicy(policy)
  const inviter = normalizeUserId(inviterUserId)

  // blocklist 是与 mode 正交的独立维度：黑名单里的人永远拒绝，
  // 不因为 mode 是 allow_all 就被跳过（否则一屏蔽某人就会关掉"仅联系人"基线）
  if (inviter && normalized.blocklist.includes(inviter)) {
    return true
  }

  if (normalized.mode === 'allowlist') {
    return inviter ? !normalized.allowlist.includes(inviter) : true
  }

  if (normalized.allowStrangers) {
    return false
  }

  // 「仅允许联系人」：fail-open，只有确认的陌生人才拒
  if (contactState === 'stranger') {
    return true
  }
  if (contactState === 'contact') {
    return false
  }

  return !inviter
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
      allowFriendRequests: (v) => v === undefined || typeof v === 'boolean',
      autoAcceptFriends: (v) => v === undefined || typeof v === 'boolean',
      requireFriendRequestMessage: (v) => v === undefined || typeof v === 'boolean',
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
