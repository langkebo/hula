import { createLogger } from '@/utils/Logger'
import { safeJsonParse, validateObject } from '@/utils/typeGuard'

const logger = createLogger('InvitePermissionPolicy')

/**
 * 邀请权限策略（方案 4.4 隐私设置）。
 *
 * 从 `useInvitePermissionFilter` 中抽出纯决策逻辑，原因：
 * 1. 该 composable 直接依赖 `MatrixClient`，无法在没有客户端的移动端/测试里复用；
 * 2. `shouldRejectInvite` 是纯粹的集合判定，混在 composable 里只能靠 mock 客户端来测；
 * 3. 桌面与移动端必须给出**完全相同**的判定结果，共用一份实现才不会分叉。
 *
 * 三种模式（与桌面 InvitePermissionPanel 一致；方案文档写的
 * 「所有人/仅联系人/nobody」是文档先于实现拟定的旧模型，代码实际是名单模型，
 * 这里以代码为准，不新造一套并行配置）：
 * - `allow_all`: 不拒绝任何邀请（默认）
 * - `blocklist`: 拒绝黑名单中的用户
 * - `allowlist`: 只允许白名单中的用户，其余全部拒绝
 */
export const INVITE_PERMISSION_ACCOUNT_DATA_TYPE = 'im.hula.invite_blocklist'

export const INVITE_PERMISSION_MODES = ['allow_all', 'blocklist', 'allowlist'] as const

export type InvitePermissionMode = (typeof INVITE_PERMISSION_MODES)[number]

export interface InvitePermissionConfig {
  mode: InvitePermissionMode
  blocklist: string[]
  allowlist: string[]
}

export const DEFAULT_INVITE_PERMISSION_CONFIG: InvitePermissionConfig = {
  mode: 'allow_all',
  blocklist: [],
  allowlist: []
}

export function isInvitePermissionMode(value: unknown): value is InvitePermissionMode {
  return typeof value === 'string' && (INVITE_PERMISSION_MODES as readonly string[]).includes(value)
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

export function normalizeInvitePermissionConfig(input: unknown): InvitePermissionConfig {
  if (!input || typeof input !== 'object') {
    return { ...DEFAULT_INVITE_PERMISSION_CONFIG, blocklist: [], allowlist: [] }
  }

  const candidate = input as Partial<InvitePermissionConfig>

  return {
    mode: isInvitePermissionMode(candidate.mode) ? candidate.mode : DEFAULT_INVITE_PERMISSION_CONFIG.mode,
    blocklist: normalizeUserIdList(candidate.blocklist),
    allowlist: normalizeUserIdList(candidate.allowlist)
  }
}

/**
 * 是否应自动拒绝来自 `inviterUserId` 的邀请。
 *
 * 空白 inviter 一律拒绝：拿不到邀请人身份时不能默认放行（allow_all 除外）。
 */
export function shouldRejectInvite(inviterUserId: unknown, config: InvitePermissionConfig): boolean {
  const normalized = normalizeInvitePermissionConfig(config)

  if (normalized.mode === 'allow_all') {
    return false
  }

  const inviter = normalizeUserId(inviterUserId)
  if (!inviter) {
    return true
  }

  if (normalized.mode === 'blocklist') {
    return normalized.blocklist.includes(inviter)
  }

  return !normalized.allowlist.includes(inviter)
}

export function loadInvitePermissionConfig(storage: Pick<Storage, 'getItem'> = localStorage): InvitePermissionConfig {
  let stored: string | null = null
  try {
    stored = storage.getItem(INVITE_PERMISSION_ACCOUNT_DATA_TYPE)
  } catch (err) {
    logger.warn('读取本地邀请权限缓存失败:', err)
    return normalizeInvitePermissionConfig(null)
  }

  if (!stored) {
    return normalizeInvitePermissionConfig(null)
  }

  const isValidShape = (val: unknown): val is Partial<InvitePermissionConfig> =>
    validateObject<Record<string, unknown>>(val, [], {
      mode: (v) => v === undefined || isInvitePermissionMode(v),
      blocklist: (v) => v === undefined || Array.isArray(v),
      allowlist: (v) => v === undefined || Array.isArray(v)
    })

  return normalizeInvitePermissionConfig(safeJsonParse(stored, isValidShape, {}))
}

/**
 * 本地缓存邀请权限配置。
 *
 * account data 是权威来源，但 account data 读取需要已登录客户端；
 * 这里缓存一份，让未登录/离线时也能沿用上次的策略而不是退回 allow_all。
 */
export function cacheInvitePermissionConfig(
  config: InvitePermissionConfig,
  storage: Pick<Storage, 'setItem'> = localStorage
): void {
  try {
    storage.setItem(INVITE_PERMISSION_ACCOUNT_DATA_TYPE, JSON.stringify(normalizeInvitePermissionConfig(config)))
  } catch (err) {
    logger.warn('缓存邀请权限配置失败:', err)
  }
}
