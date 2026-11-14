import { isPermissionGranted, requestPermission } from '@tauri-apps/plugin-notification'
import { openUrl } from '@tauri-apps/plugin-opener'
import { createLogger } from '@/utils/Logger'
import { isMac, isWindows } from '@/utils/PlatformConstants'

const logger = createLogger('SystemNotificationPermission')

/** 系统通知权限状态（插件只区分是否已授权，其余情况统一视为未授权）。 */
export type SystemNotificationPermissionStatus = 'granted' | 'denied' | 'unsupported'

/**
 * 发送系统通知前的权限门。
 *
 * `@tauri-apps/plugin-notification` 的 `sendNotification` 返回 `void`（实现是
 * `new window.Notification(...)`），没有 Promise 可以 await，插件内部的 invoke 失败也接不住，
 * 因此调用点唯一能做的失败隔离就是「发之前先判权限」。
 *
 * **这里只检查、不申请**：系统权限的申请入口是设置页（`NotificationSettings.vue`
 * 的 `requestSystemNotificationPermission()` 路径）。后台消息到达时弹权限框既打断用户，又容易在
 * 首条消息时被误拒，通知热路径不该承担这个交互。
 *
 * 非 Tauri 运行时 / 插件不可用时 `isPermissionGranted()` 会抛错：降级为「无权限」并记日志。
 */
export async function isSystemNotificationPermissionGranted(): Promise<boolean> {
  try {
    return await isPermissionGranted()
  } catch (err) {
    logger.warn(`[MatrixNotification] 系统通知权限检查失败（视为无权限）: ${err}`)
    return false
  }
}

/**
 * 读取系统通知权限状态，供设置页展示真实状态（C-12）。
 *
 * 插件没有「未决定」概念：未授权即 `denied`，用户只能通过系统设置或再次触发申请改变。
 */
export async function getSystemNotificationPermissionStatus(): Promise<SystemNotificationPermissionStatus> {
  try {
    return (await isPermissionGranted()) ? 'granted' : 'denied'
  } catch (err) {
    logger.warn(`[MatrixNotification] 系统通知权限状态不可用: ${err}`)
    return 'unsupported'
  }
}

/**
 * 申请系统通知权限（C-12）。仅在用户主动打开通知开关时调用。
 */
export async function requestSystemNotificationPermission(): Promise<boolean> {
  try {
    if (await isPermissionGranted()) return true
    return (await requestPermission()) === 'granted'
  } catch (err) {
    logger.warn(`[MatrixNotification] 申请系统通知权限失败: ${err}`)
    return false
  }
}

/** 当前平台是否支持跳转系统通知设置页。 */
export function canOpenSystemNotificationSettings(): boolean {
  return isMac() || isWindows()
}

const SYSTEM_NOTIFICATION_SETTINGS_URI = {
  macos: 'x-apple.systempreferences:com.apple.preference.notifications',
  windows: 'ms-settings:notifications'
} as const

/**
 * 跳转系统通知设置页（C-12）。
 *
 * Linux 没有统一 URI，返回 `false` 由调用方给出文案引导，不静默失败。
 */
export async function openSystemNotificationSettings(): Promise<boolean> {
  const uri = isMac()
    ? SYSTEM_NOTIFICATION_SETTINGS_URI.macos
    : isWindows()
      ? SYSTEM_NOTIFICATION_SETTINGS_URI.windows
      : null
  if (!uri) return false

  try {
    await openUrl(uri)
    return true
  } catch (err) {
    logger.warn(`[MatrixNotification] 打开系统通知设置失败: ${err}`)
    return false
  }
}
