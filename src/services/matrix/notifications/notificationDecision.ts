import { matchesNotificationKeyword } from './notificationDisplayPreferences'

/**
 * 消息应归属的通知开关类别。
 *
 * - `mention`        : 普通提及，无对应开关（现状始终通知）
 * - `thread_mention` : 线程内提及，受 `events.thread_mention` 控制
 * - `keyword`        : 非提及消息，受关键词通知开关 + 关键词列表控制
 */
export type NotificationMessageKind = 'mention' | 'thread_mention' | 'keyword'

export interface NotificationMessageInput {
  isMention: boolean
  isThread: boolean
  body: string
}

export interface NotificationDecisionPreferences {
  events: Record<string, boolean> | undefined
  keywordNotifications: boolean
  keywords: readonly string[]
  /** 勿扰窗口是否正在生效。为真时抑制全部系统通知（含普通提及）。 */
  dndActive: boolean
}

/**
 * 判定消息由哪个开关负责。非提及消息一律归 `keyword`（是否真正命中关键词由
 * `shouldNotify` 结合关键词列表决定），因此这里只看提及与线程两个维度。
 */
export function classifyNotificationMessage(input: { isMention: boolean; isThread: boolean }): NotificationMessageKind {
  if (!input.isMention) {
    return 'keyword'
  }
  return input.isThread ? 'thread_mention' : 'mention'
}

/**
 * 统一通知决策门（纯函数，不读 Pinia / localStorage）。
 *
 * 语义（缺省必须与接线前一致）：
 * - 勿扰窗口内：一律不通知，优先于其它所有开关；
 * - 普通提及：始终通知，不受任何细粒度开关影响；
 * - 线程内提及：`events.thread_mention` 缺省或 `true` 通知，显式 `false` 不通知；
 * - 非提及：仅在关键词通知开关打开且正文命中关键词时通知（默认关闭）。
 */
export function shouldNotify(input: NotificationMessageInput, preferences: NotificationDecisionPreferences): boolean {
  // 勿扰优先级最高：窗口内连普通提及一并抑制
  if (preferences.dndActive) {
    return false
  }

  const kind = classifyNotificationMessage(input)

  if (kind === 'mention') {
    return true
  }

  if (kind === 'thread_mention') {
    // 字段缺省视为开启，避免旧配置升级后线程提及被静默关闭
    return preferences.events?.thread_mention !== false
  }

  if (!preferences.keywordNotifications) {
    return false
  }

  return matchesNotificationKeyword(input.body, preferences.keywords)
}
