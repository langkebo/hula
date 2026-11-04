import { type ComputedRef, computed, type Ref, ref, type WritableComputedRef } from 'vue'
import {
  formatNotificationKeywords,
  loadNotificationDisplayPreferences,
  type NotificationDisplayPreferences,
  type NotificationPriority,
  parseNotificationKeywords,
  saveNotificationDisplayPreferences
} from '@/services/matrix/notifications/notificationDisplayPreferences'

/**
 * 通知展示偏好的共享逻辑层（桌面 NotificationSettings 与移动 NotificationSettings 共用）。
 *
 * 两份界面各自只拥有部分字段：
 * - 桌面：keywordNotifications + keywords
 * - 移动：contentSummary + keywordHighlight + keywords + priority
 *
 * 因此写入必须是「读-合并-写」：先读回存储里的最新值，再只覆盖本次提交的字段，
 * 避免一端保存时把另一端拥有的开关重置成默认值。
 */
export interface UseNotificationDisplayPreferencesResult {
  preferences: Ref<NotificationDisplayPreferences>
  contentSummary: WritableComputedRef<boolean>
  keywordHighlight: WritableComputedRef<boolean>
  keywordNotifications: WritableComputedRef<boolean>
  keywords: ComputedRef<string[]>
  keywordsText: ComputedRef<string>
  priority: WritableComputedRef<NotificationPriority>
  reload: () => void
  commit: (patch: Partial<NotificationDisplayPreferences>) => void
  /** 归一化输入框文本并落库，返回归一化后的文本。 */
  normalizeKeywords: (raw: string) => string
  /** 追加关键词（去重）。返回是否真的写入。 */
  addKeyword: (raw: string) => boolean
  /** 删除关键词。返回是否真的写入。 */
  removeKeyword: (keyword: string) => boolean
}

export function useNotificationDisplayPreferences(): UseNotificationDisplayPreferencesResult {
  const preferences = ref(loadNotificationDisplayPreferences())

  function reload() {
    preferences.value = loadNotificationDisplayPreferences()
  }

  function commit(patch: Partial<NotificationDisplayPreferences>) {
    const next = { ...loadNotificationDisplayPreferences(), ...patch }
    preferences.value = next
    saveNotificationDisplayPreferences(next)
  }

  function field<K extends keyof NotificationDisplayPreferences>(key: K) {
    return computed({
      get: () => preferences.value[key],
      set: (value: NotificationDisplayPreferences[K]) =>
        commit({ [key]: value } as Partial<NotificationDisplayPreferences>)
    })
  }

  const contentSummary = field('contentSummary')
  const keywordHighlight = field('keywordHighlight')
  const keywordNotifications = field('keywordNotifications')
  const priority = field('priority')

  const keywords = computed(() => preferences.value.keywords)
  const keywordsText = computed(() => formatNotificationKeywords(preferences.value.keywords))

  function normalizeKeywords(raw: string): string {
    const normalized = formatNotificationKeywords(parseNotificationKeywords(raw))
    commit({ keywords: parseNotificationKeywords(normalized) })
    return normalized
  }

  function addKeyword(raw: string): boolean {
    const keyword = raw.trim()
    if (!keyword) {
      return false
    }

    const current = preferences.value.keywords
    const next = parseNotificationKeywords([...current, keyword].join(','))
    if (next.length === current.length) {
      return false
    }

    commit({ keywords: next })
    return true
  }

  function removeKeyword(keyword: string): boolean {
    const current = preferences.value.keywords
    const next = current.filter((item) => item !== keyword)
    if (next.length === current.length) {
      return false
    }

    commit({ keywords: next })
    return true
  }

  return {
    preferences,
    contentSummary,
    keywordHighlight,
    keywordNotifications,
    keywords,
    keywordsText,
    priority,
    reload,
    commit,
    normalizeKeywords,
    addKeyword,
    removeKeyword
  }
}
