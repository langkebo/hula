import { isPermissionGranted } from '@tauri-apps/plugin-notification'
import { createLogger } from '@/utils/Logger'

const logger = createLogger('SystemNotificationPermission')

/**
 * 发送系统通知前的权限门。
 *
 * `@tauri-apps/plugin-notification` 的 `sendNotification` 返回 `void`（实现是
 * `new window.Notification(...)`），没有 Promise 可以 await，插件内部的 invoke 失败也接不住，
 * 因此调用点唯一能做的失败隔离就是「发之前先判权限」。
 *
 * **这里只检查、不申请**：系统权限的申请入口是设置页（`NotificationSettings.vue`
 * 的 `requestPermission()` 路径）。后台消息到达时弹权限框既打断用户，又容易在
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
