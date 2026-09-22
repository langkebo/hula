import {
  type NotificationDecisionPreferences,
  type NotificationMessageInput,
  shouldNotify
} from './notificationDecision'
import {
  loadNotificationDisplayPreferences,
  materializeNotificationContent,
  type NotificationDisplayPreferences
} from './notificationDisplayPreferences'

/**
 * 通知展示文案的取词函数：由服务注入 `t`，纯函数模块不直接依赖 i18n 单例。
 */
export type NotificationTranslator = (key: string, params?: Record<string, unknown>) => string

/**
 * 消息到达时的统一通知决策门：汇总细粒度事件开关、关键词展示偏好与勿扰状态后委托纯函数。
 *
 * 自己发送的消息由调用方先排除（发送路径还持有 userStore 身份）。
 *
 * @param input 消息的提及 / 线程 / 正文三元组
 * @param events 服务的 `config.events` 细粒度事件开关
 * @param dndActive 当前是否处于勿扰窗口
 */
export function shouldNotifyMessage(
  input: NotificationMessageInput,
  events: Record<string, boolean> | undefined,
  dndActive: boolean
): boolean {
  const preferences = loadNotificationDisplayPreferences()
  const decisionPreferences: NotificationDecisionPreferences = {
    events,
    keywordNotifications: preferences.keywordNotifications,
    keywords: preferences.keywords,
    dndActive
  }
  return shouldNotify(input, decisionPreferences)
}

/**
 * 供消息到达时决定通知标题与正文，`messageMutations` 的桌面通知路径消费此处结果。
 *
 * 合并两处偏好：账号级 `showMessageContent` 先并入本地展示偏好，
 * 再由优先级裁定（high 可突破账号级开关，low 强制折叠）。
 *
 * **标题始终保持调用点传入的干净值**（发送者名或 `message.notify.new_messages`）：
 * 系统通知标题不应塞入 `[•]` / `[*]` 这类非 i18n 符号，否则会污染系统通知中心的排版
 * 与无障碍朗读。折叠 / 关键词命中的可见信号改由正文承载
 * （`message.notify.folded` / `message.notify.keyword_hit`），既保留「偏好不静默失效」
 * 的承诺，又不污染标题。
 *
 * @param title 调用点传入的干净标题
 * @param body 正文
 * @param contentSummaryEnabled 账号级「显示消息内容」开关
 * @param t i18n 取词函数（折叠 / 关键词命中信号）
 */
export function renderNotificationDisplay(
  title: string,
  body: string,
  contentSummaryEnabled: boolean,
  t: NotificationTranslator
): { title: string; body: string } {
  const preferences: NotificationDisplayPreferences = loadNotificationDisplayPreferences()
  const decision = materializeNotificationContent(
    { title, body },
    { ...preferences, contentSummary: preferences.contentSummary && contentSummaryEnabled }
  )

  if (!decision.contentVisible) {
    return { title, body: t('message.notify.folded') }
  }

  if (decision.highlighted) {
    return { title, body: t('message.notify.keyword_hit', { body: decision.body }) }
  }

  return { title, body: decision.body }
}
