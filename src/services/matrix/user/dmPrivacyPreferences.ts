import { createLogger } from '@/utils/Logger'
import { safeJsonParse, validateObject } from '@/utils/typeGuard'

const logger = createLogger('DmPrivacyPreferences')

/**
 * 私聊（DM）的非机密偏好。
 *
 * 与 `invitePolicy` 分开存放的原因：邀请策略是**隐私控制**（谁能找到我），
 * 这里是**会话默认值**（新私聊怎么建）。两者生命周期与权威来源不同，
 * 混在一个 account data 里会让任一侧的迁移牵动另一侧。
 *
 * 注意：这个 key 只存本地偏好（与 `tjg-notification-display-preferences` 同类），
 * 不参与 account data 同步——它是"本机偏好"而不是"账号策略"。
 */
export const DM_PRIVACY_PREFERENCES_STORAGE_KEY = 'tjg-dm-privacy-preferences'

export interface DmPrivacyPreferences {
  /** 新建私聊时默认开启端到端加密。默认开启（安全方向）。 */
  encryptByDefault: boolean
}

export const DEFAULT_DM_PRIVACY_PREFERENCES: DmPrivacyPreferences = {
  encryptByDefault: true
}

export function normalizeDmPrivacyPreferences(input: unknown): DmPrivacyPreferences {
  if (!input || typeof input !== 'object') {
    return { ...DEFAULT_DM_PRIVACY_PREFERENCES }
  }

  const candidate = input as Partial<DmPrivacyPreferences>

  return {
    encryptByDefault:
      typeof candidate.encryptByDefault === 'boolean'
        ? candidate.encryptByDefault
        : DEFAULT_DM_PRIVACY_PREFERENCES.encryptByDefault
  }
}

/**
 * 决定新私聊是否加密。
 *
 * 优先级：调用方的显式请求 > 本地默认偏好。
 *
 * 之所以需要显式请求这一层：`CreateDmDialog` 允许用户当场勾选/取消加密，
 * 该意图必须能覆盖默认值。而 `MatrixContactService` 这类"顺带建私聊"的调用
 * 不传参数，此时才落到默认偏好——此前它默认落到 `false`，
 * 导致从联系人发起的私聊全是明文。
 */
export function resolveDmEncryption(
  requested: boolean | undefined,
  preferences: Pick<DmPrivacyPreferences, 'encryptByDefault'> | null | undefined
): boolean {
  if (typeof requested === 'boolean') {
    return requested
  }
  return normalizeDmPrivacyPreferences(preferences).encryptByDefault
}

export function loadDmPrivacyPreferences(storage: Pick<Storage, 'getItem'> = localStorage): DmPrivacyPreferences {
  let stored: string | null = null
  try {
    stored = storage.getItem(DM_PRIVACY_PREFERENCES_STORAGE_KEY)
  } catch (err) {
    logger.warn('读取私聊偏好失败:', err)
    return { ...DEFAULT_DM_PRIVACY_PREFERENCES }
  }

  if (!stored) {
    return { ...DEFAULT_DM_PRIVACY_PREFERENCES }
  }

  const isValidShape = (val: unknown): val is Partial<DmPrivacyPreferences> =>
    validateObject<Record<string, unknown>>(val, [], {
      encryptByDefault: (v) => v === undefined || typeof v === 'boolean'
    })

  return normalizeDmPrivacyPreferences(safeJsonParse(stored, isValidShape, {}))
}

export function cacheDmPrivacyPreferences(
  preferences: DmPrivacyPreferences,
  storage: Pick<Storage, 'setItem'> = localStorage
): void {
  try {
    storage.setItem(DM_PRIVACY_PREFERENCES_STORAGE_KEY, JSON.stringify(normalizeDmPrivacyPreferences(preferences)))
  } catch (err) {
    logger.warn('保存私聊偏好失败:', err)
  }
}
