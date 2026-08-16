import { ThemeEnum } from '@/enums'
import { isMac } from '@/utils/PlatformConstants'

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
  sendTypingNotifications: true
})

export const normalizeNotificationVolume = (volume?: number) => {
  if (typeof volume !== 'number') return 80
  return Math.min(100, Math.max(0, Math.round(volume)))
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
  sendReadReceipts: 'tjg-send-read-receipts',
  sendTypingNotifications: 'tjg-send-typing-notifications'
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
  const hashBuffer = await crypto.subtle.digest('SHA-256', data)
  const hashArray = Array.from(new Uint8Array(hashBuffer))
  const hashHex = hashArray.map((b) => b.toString(16).padStart(2, '0')).join('')
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
