import { ThemeEnum } from '@/enums'
import { isMac } from '@/utils/PlatformConstants'
import { bytesToHex } from '@/utils/StringUtils'
import { requireSubtleCrypto } from '@/utils/webCompat'

// 获取平台对应的默认快捷键
export const getDefaultShortcuts = () => {
  return {
    screenshot: isMac() ? 'Cmd+Ctrl+H' : 'Ctrl+Alt+H',
    openMainPanel: isMac() ? 'Cmd+Ctrl+P' : 'Ctrl+Alt+P',
    globalEnabled: false // 默认关闭全局快捷键
  }
}

export const getDefaultNotificationSettings = () => ({
  messageSound: true,
  volume: 80
})

export const getDefaultPreferenceSettings = (): STO.Setting['preferences'] => ({
  messageConfirm: false,
  linkPreview: true,
  emojiConvert: true,
  emojiSize: 'medium' as 'small' | 'medium' | 'large',
  burnDefaultEnabled: false,
  burnDefaultDuration: 60,
  burnShowCountdown: true,
  threadAutoSubscribe: true,
  threadShowInRoom: true,
  threadNotificationLevel: 'participate' as 'all' | 'participate' | 'none',
  spaceAutoJoinRooms: false,
  spaceShowSubspaces: true,
  spaceDefaultNotification: 'all_messages' as 'all_messages' | 'mentions_only' | 'none',
  sendReadReceipts: true,
  sendTypingNotifications: true,
  showOnlineStatus: true,
  uploadCompressEnabled: true,
  uploadCompressQuality: 0.8 as 0.6 | 0.8 | 0.9,
  uploadChunkEnabled: true,
  // R-1（2026-10-12）：默认**不**开启严格模式 —— 这是 SDK/Element 的互操作默认，
  // 默认开启会让未验证设备（新设备 / 未完成交叉签名）完全收不到消息且无任何解释。
  // 用户可通过加密房间内提示或加密设置页显式开启。
  blockUnverifiedDevices: false,
  strictUnverifiedRooms: [],
  burnRooms: []
})

/**
 * 页面字体默认值：与 design-tokens.css 的 --tjg-font-family 对齐的系统字体栈。
 * 历史默认值 'PingFang' 不是浏览器可识别的字体家族名（macOS 实际为 'PingFang SC'），
 * 全局 @font-face 移除后继续使用会让全站退化为 generic sans-serif，并丢失 500 字重。
 */
export const DEFAULT_PAGE_FONT_FAMILY =
  "-apple-system, BlinkMacSystemFont, 'PingFang SC', 'Hiragino Sans GB', 'Microsoft YaHei', Roboto, sans-serif"

/** 旧版本已持久化的非法字体名 → 当前有效值 */
const LEGACY_PAGE_FONT_FAMILIES: Record<string, string> = {
  PingFang: DEFAULT_PAGE_FONT_FAMILY
}

/** 读取时迁移：兼容升级用户已落盘的旧字体名，避免页面字体失效 */
export function normalizePageFontFamily(font?: string | null): string {
  if (!font) return DEFAULT_PAGE_FONT_FAMILY
  return LEGACY_PAGE_FONT_FAMILIES[font] ?? font
}

/** 页面外观默认值：state 初始化与 ensurePageSettings 复用同一份，避免默认值漂移 */
export const createDefaultPageSettings = (): STO.Setting['page'] => ({
  shadow: true,
  fonts: DEFAULT_PAGE_FONT_FAMILY,
  blur: true,
  lang: 'zh-CN'
})

export const normalizeNotificationVolume = (volume?: number) => {
  if (typeof volume !== 'number') return 80
  return Math.min(100, Math.max(0, Math.round(volume)))
}

/** R-1：逐房间严格模式列表的容错归一（非字符串 / 空串 / 非数组一律丢弃） */
export const normalizeStrictUnverifiedRooms = (value: unknown): string[] =>
  Array.isArray(value) ? value.filter((id): id is string => typeof id === 'string' && id.length > 0) : []

/** 图片压缩质量只接受 0.6 / 0.8 / 0.9，其余（含缺失）回落到标准 0.8 */
export const normalizeUploadCompressQuality = (value?: number): 0.6 | 0.8 | 0.9 => {
  if (value === 0.6 || value === 0.9) return value
  return 0.8
}

export const LEGACY_PREFERENCE_STORAGE_KEYS = {
  messageConfirm: 'tjg-message-confirm',
  linkPreview: 'tjg-link-preview',
  emojiConvert: 'tjg-emoji-convert',
  emojiSize: 'tjg-emoji-size',
  burnDefaultEnabled: 'tjg-burn-default-enabled',
  burnDefaultDuration: 'tjg-burn-default-duration',
  burnShowCountdown: 'tjg-burn-show-countdown',
  threadAutoSubscribe: 'tjg-thread-auto-subscribe',
  threadShowInRoom: 'tjg-thread-show-in-room',
  threadNotificationLevel: 'tjg-thread-notification-level',
  spaceAutoJoinRooms: 'tjg-space-auto-join',
  spaceShowSubspaces: 'tjg-space-show-subspaces',
  spaceDefaultNotification: 'tjg-space-default-notification',
  // 旧隐私设置页（base 的 PrivacySettingsSection.vue）实际写入的 key：
  // 注意不是 tjg-send-read-receipts / tjg-send-typing-notifications——那两个从没有
  // 任何 UI 写过，按它们迁移只会制造"迁移了假 key"的假信心。
  sendReadReceipts: 'tjg-send-receipts',
  sendTypingNotifications: 'tjg-show-typing',
  showOnlineStatus: 'tjg-show-online'
} as const

export const readLegacyBooleanPreference = (key: string) => {
  if (typeof localStorage === 'undefined') return undefined
  const raw = localStorage.getItem(key)
  if (raw === null) return undefined
  return raw === 'true'
}

export const normalizeThreadNotificationLevel = (value?: string): 'all' | 'participate' | 'none' => {
  if (value === 'all' || value === 'none') return value
  return 'participate'
}

export const normalizeEmojiSize = (value?: string): 'small' | 'medium' | 'large' => {
  if (value === 'small' || value === 'large') return value
  return 'medium'
}

export const normalizeBurnDefaultDuration = (value?: number): 30 | 60 | 300 | 3600 | 86400 => {
  if (value === 30 || value === 300 || value === 3600 || value === 86400) return value
  return 60
}

export const normalizeSpaceDefaultNotification = (value?: string): 'all_messages' | 'mentions_only' | 'none' => {
  if (value === 'mentions_only' || value === 'none') return value
  return 'all_messages'
}

export const normalizeTheme = (theme: string) => {
  if (theme === ThemeEnum.DARK) return ThemeEnum.DARK
  if (theme === ThemeEnum.LIGHT) return ThemeEnum.LIGHT
  if (theme === ThemeEnum.OS) return ThemeEnum.OS
  return ThemeEnum.OS
}

export const resolveOsTheme = () => {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return ThemeEnum.LIGHT
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? ThemeEnum.DARK : ThemeEnum.LIGHT
}

export const setDocumentTheme = (theme: string) => {
  if (typeof document === 'undefined') return
  document.documentElement.dataset.theme = theme
}

// Older persisted settings may still carry a removed `versatile` field.
// Strip it during theme normalization so restored state converges to the
// current single-theme runtime model without breaking existing local data.
type LegacyThemeState = STO.Setting['themes'] & {
  versatile?: string
}

export const stripLegacyThemeVariant = (themes: STO.Setting['themes']) => {
  const legacyThemes = themes as LegacyThemeState
  if ('versatile' in legacyThemes) {
    delete legacyThemes.versatile
  }
}

const SHA256_PREFIX = 'sha256:'

const legacyHashPassword = (password: string): string => {
  let hash = 0
  for (let i = 0; i < password.length; i++) {
    const char = password.charCodeAt(i)
    hash = (hash << 5) - hash + char
    hash = hash & hash
  }
  return hash.toString(16)
}

export async function hashPasswordWithSHA256(password: string): Promise<string> {
  const encoder = new TextEncoder()
  const data = encoder.encode(password)
  const hashBuffer = await requireSubtleCrypto().digest('SHA-256', data)
  const hashHex = bytesToHex(hashBuffer)
  return `${SHA256_PREFIX}${hashHex}`
}

export async function verifyPasswordHash(
  password: string,
  storedHash: string
): Promise<{ valid: boolean; upgradedHash?: string }> {
  if (storedHash.startsWith(SHA256_PREFIX)) {
    const expectedHash = await hashPasswordWithSHA256(password)
    return { valid: storedHash === expectedHash }
  }
  // Legacy DJB2 hash — verify and upgrade
  if (storedHash === legacyHashPassword(password)) {
    const upgradedHash = await hashPasswordWithSHA256(password)
    return { valid: true, upgradedHash }
  }
  return { valid: false }
}
