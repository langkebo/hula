/**
 * 服务层隐私偏好注入点。
 *
 * 背景：`MatrixTypingService` / `MatrixPresenceService` 原先直接 `useSettingStore()`
 * 读取偏好，形成 store → service → store 的静态循环依赖。改为由应用入口
 * （`main.ts`）在 pinia 激活后注入取值函数，服务层不再 import Pinia，
 * 既能脱离 store 单测，也消除了依赖环。
 *
 * 缺省值与设置项默认值保持一致（两项默认开启）：未注册的调用方
 * （worker、脚本、单测）不会静默改变上报行为。
 */
let typingPreferenceProvider: () => boolean = () => true
let onlineStatusPreferenceProvider: () => boolean = () => true

export interface PrivacyPreferenceHooks {
  /** 「发送输入中提示」是否开启 */
  isSendTypingNotificationsEnabled: () => boolean
  /** 「允许其他用户看到您的在线状态」是否开启 */
  isShowOnlineStatusEnabled: () => boolean
}

/** 注入隐私偏好的取值函数（应用入口在 pinia 激活后调用一次）。 */
export function registerPrivacyPreferenceHooks(hooks: PrivacyPreferenceHooks): void {
  typingPreferenceProvider = hooks.isSendTypingNotificationsEnabled
  onlineStatusPreferenceProvider = hooks.isShowOnlineStatusEnabled
}

/** 读取「发送输入中提示」偏好；未注入时默认开启。 */
export function isSendTypingNotificationsEnabled(): boolean {
  return typingPreferenceProvider()
}

/** 读取「展示在线状态」偏好；未注入时默认开启。 */
export function isShowOnlineStatusEnabled(): boolean {
  return onlineStatusPreferenceProvider()
}
