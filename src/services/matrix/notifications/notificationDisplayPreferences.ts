import { createLogger } from '@/utils/Logger'
import { safeJsonParse, validateObject } from '@/utils/typeGuard'

const logger = createLogger('NotificationDisplayPreferences')

/**
 * 通知优先级。
 *
 * 语义（决定通知内容的可见度，而不只是一个被存起来的值）：
 * - `high`  : 完整显示正文，忽略「内容摘要」开关
 * - `medium`: 由「内容摘要」开关决定
 * - `low`   : 强制折叠正文，只显示标题
 */
export type NotificationPriority = 'low' | 'medium' | 'high'

export const NOTIFICATION_PRIORITIES: readonly NotificationPriority[] = ['low', 'medium', 'high']

export const DEFAULT_NOTIFICATION_PRIORITY: NotificationPriority = 'medium'

/** 与 MatrixNotificationService 的 `tjg-notification-config` 区分：这里是本地展示偏好，不参与 account data 同步。 */
export const NOTIFICATION_DISPLAY_PREFERENCES_STORAGE_KEY = 'tjg-notification-display-preferences'

export interface NotificationDisplayPreferences {
  /** 通知中显示消息内容摘要。 */
  contentSummary: boolean
  /** 命中关键词的通知标记为高亮（由调用方决定具体呈现）。 */
  keywordHighlight: boolean
  /** 关键词列表，大小写不敏感，逗号分隔输入。 */
  keywords: string[]
  priority: NotificationPriority
}

export interface NotificationDisplayInput {
  title: string
  body: string
}

export interface NotificationDisplayDecision {
  title: string
  /** 正文原样返回；是否展示由 `contentVisible` 决定，避免服务层掺入文案。 */
  body: string
  /** 是否隐藏正文。 */
  contentVisible: boolean
  /** 正文是否命中关键词且用户开启了关键词高亮。 */
  highlighted: boolean
}

export const DEFAULT_NOTIFICATION_DISPLAY_PREFERENCES: NotificationDisplayPreferences = {
  contentSummary: true,
  keywordHighlight: true,
  keywords: [],
  priority: DEFAULT_NOTIFICATION_PRIORITY
}

export function isNotificationPriority(value: unknown): value is NotificationPriority {
  return typeof value === 'string' && (NOTIFICATION_PRIORITIES as readonly string[]).includes(value)
}

/**
 * 把用户输入的逗号/中文逗号/换行分隔文本解析成去重后的关键词列表。
 * 空串与纯空白项被丢弃，保持原大小写（匹配时才做大小写归一）。
 */
export function parseNotificationKeywords(raw: string): string[] {
  if (typeof raw !== 'string') {
    return []
  }

  const seen = new Set<string>()
  const result: string[] = []

  for (const piece of raw.split(/[,，\n\r]+/)) {
    const keyword = piece.trim()
    if (!keyword) {
      continue
    }
    const dedupeKey = keyword.toLowerCase()
    if (seen.has(dedupeKey)) {
      continue
    }
    seen.add(dedupeKey)
    result.push(keyword)
  }

  return result
}

/** 关键词序列化为输入框文本。 */
export function formatNotificationKeywords(keywords: readonly string[]): string {
  return keywords.join(', ')
}

export function matchesNotificationKeyword(text: string, keywords: readonly string[]): boolean {
  if (!text || keywords.length === 0) {
    return false
  }

  const haystack = text.toLowerCase()
  return keywords.some((keyword) => keyword.length > 0 && haystack.includes(keyword.toLowerCase()))
}

export function normalizeNotificationDisplayPreferences(input: unknown): NotificationDisplayPreferences {
  if (!input || typeof input !== 'object') {
    return { ...DEFAULT_NOTIFICATION_DISPLAY_PREFERENCES }
  }

  const candidate = input as Partial<NotificationDisplayPreferences>

  return {
    contentSummary:
      typeof candidate.contentSummary === 'boolean'
        ? candidate.contentSummary
        : DEFAULT_NOTIFICATION_DISPLAY_PREFERENCES.contentSummary,
    keywordHighlight:
      typeof candidate.keywordHighlight === 'boolean'
        ? candidate.keywordHighlight
        : DEFAULT_NOTIFICATION_DISPLAY_PREFERENCES.keywordHighlight,
    keywords: Array.isArray(candidate.keywords)
      ? parseNotificationKeywords(candidate.keywords.filter((k) => typeof k === 'string').join(','))
      : [],
    priority: isNotificationPriority(candidate.priority) ? candidate.priority : DEFAULT_NOTIFICATION_PRIORITY
  }
}

export function loadNotificationDisplayPreferences(
  storage: Pick<Storage, 'getItem'> = localStorage
): NotificationDisplayPreferences {
  let stored: string | null = null
  try {
    stored = storage.getItem(NOTIFICATION_DISPLAY_PREFERENCES_STORAGE_KEY)
  } catch (err) {
    logger.warn('读取通知展示偏好失败:', err)
    return { ...DEFAULT_NOTIFICATION_DISPLAY_PREFERENCES }
  }

  if (!stored) {
    return { ...DEFAULT_NOTIFICATION_DISPLAY_PREFERENCES }
  }

  const isValidShape = (val: unknown): val is Partial<NotificationDisplayPreferences> =>
    validateObject<Record<string, unknown>>(val, [], {
      contentSummary: (v) => v === undefined || typeof v === 'boolean',
      keywordHighlight: (v) => v === undefined || typeof v === 'boolean',
      keywords: (v) => v === undefined || Array.isArray(v),
      priority: (v) => v === undefined || isNotificationPriority(v)
    })

  return normalizeNotificationDisplayPreferences(safeJsonParse(stored, isValidShape, {}))
}

export function saveNotificationDisplayPreferences(
  preferences: NotificationDisplayPreferences,
  storage: Pick<Storage, 'setItem'> = localStorage
): void {
  try {
    storage.setItem(
      NOTIFICATION_DISPLAY_PREFERENCES_STORAGE_KEY,
      JSON.stringify(normalizeNotificationDisplayPreferences(preferences))
    )
  } catch (err) {
    logger.warn('保存通知展示偏好失败:', err)
  }
}

/**
 * 依据展示偏好决定通知内容。
 *
 * 优先级是唯一能突破「内容摘要」开关的旋钮：
 * - high 忽略摘要开关，始终显示正文
 * - low 忽略摘要开关，始终隐藏正文
 * - medium 由摘要开关决定
 *
 * 正文被隐藏时关键词不再参与匹配，避免通过 `highlighted` 泄漏内容。
 */
export function materializeNotificationContent(
  input: NotificationDisplayInput,
  preferences: NotificationDisplayPreferences
): NotificationDisplayDecision {
  const effective = normalizeNotificationDisplayPreferences(preferences)

  const contentVisible =
    effective.priority === 'high' ? true : effective.priority === 'low' ? false : effective.contentSummary

  if (!contentVisible) {
    return {
      title: input.title,
      body: input.body,
      contentVisible: false,
      highlighted: false
    }
  }

  return {
    title: input.title,
    body: input.body,
    contentVisible: true,
    highlighted: effective.keywordHighlight && matchesNotificationKeyword(input.body, effective.keywords)
  }
}
