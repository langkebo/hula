import {
  getSettingsTabLabel,
  type LegacySettingsTabType,
  SETTINGS_CANONICAL_ROUTE_SEGMENTS,
  SETTINGS_LEGACY_TAB_MAP,
  SETTINGS_TABS,
  type SettingsTab,
  type SettingsTabTranslator,
  type SettingsTabType
} from '@/stores/domains/settings/settingsSchema'

/** 页签内的二级锚点：用于命中具体设置分区并滚动定位 */
interface SettingsSearchAnchor {
  anchorId: string
  /** 分区标题的 i18n key，与组件内可见标题保持同源 */
  labelKey: string
  /** 翻译缺失时的回退文案 */
  fallbackLabel: string
  terms: string[]
}

interface SettingsSearchEntry {
  id: SettingsTabType
  terms: string[]
  anchors: SettingsSearchAnchor[]
}

export interface SettingsSearchResult {
  tabId: SettingsTabType
  /** 命中二级锚点时存在；仅命中页签标题时省略 */
  anchorId?: string
  /** 展示用路径：设置 > 页签 > 分区 */
  path: string[]
  /** 页签在当前服务器是否可用（能力缺失时为 false） */
  available: boolean
}

export type SettingsSearchKeywordResolver = (tabId: SettingsTabType) => string[]

const ROUTE_TERMS: Partial<Record<SettingsTabType, string[]>> = {
  notifications: [SETTINGS_CANONICAL_ROUTE_SEGMENTS.notifications],
  securityPrivacy: [SETTINGS_CANONICAL_ROUTE_SEGMENTS.securityPrivacy],
  helpAbout: [SETTINGS_CANONICAL_ROUTE_SEGMENTS.helpAbout]
}

/**
 * 二级锚点注册表。anchorId 必须与组件上的 `data-settings-anchor` 一致，
 * 未登记的页签仍保留页签标题命中的降级路径。
 */
const SETTINGS_ANCHOR_DEFINITIONS: Partial<Record<SettingsTabType, SettingsSearchAnchor[]>> = {
  appearance: [
    {
      anchorId: 'appearance-theme',
      labelKey: 'setting.appearance.theme_section',
      fallbackLabel: 'Theme',
      terms: ['主题', '壁纸', '配色', '暗色', '亮色', 'theme', 'wallpaper', 'color', 'dark', 'light']
    },
    {
      anchorId: 'appearance-font',
      labelKey: 'setting.appearance.font_section',
      fallbackLabel: 'Font Settings',
      terms: ['字体', '字号', 'font', 'typeface', 'size']
    },
    {
      anchorId: 'appearance-effects',
      labelKey: 'setting.appearance.effects_section',
      fallbackLabel: 'Visual Effects',
      terms: ['特效', '阴影', '模糊', 'effect', 'shadow', 'blur']
    },
    {
      anchorId: 'appearance-bubble',
      labelKey: 'setting.appearance.bubble_section',
      fallbackLabel: 'Message Bubbles',
      terms: ['气泡', '圆角', '方角', 'bubble', 'rounded', 'square']
    }
  ],
  preferences: [
    {
      anchorId: 'preferences-language',
      labelKey: 'setting.preferences.language_section',
      fallbackLabel: 'Language',
      terms: ['语言', 'language', 'locale']
    },
    {
      anchorId: 'preferences-startup-storage',
      labelKey: 'setting.preferences.startup_storage_section',
      fallbackLabel: 'Startup & Storage',
      terms: ['启动', '存储', '目录', '缓存', '扫描', 'autostart', 'startup', 'storage', 'directory', 'scan']
    },
    {
      anchorId: 'preferences-messaging',
      labelKey: 'setting.preferences.messaging_section',
      fallbackLabel: 'Messaging',
      terms: ['发送', '回车', '撤回', '确认', 'send', 'enter', 'recall', 'confirm']
    },
    {
      anchorId: 'preferences-link-preview',
      labelKey: 'setting.preferences.link_preview_section',
      fallbackLabel: 'Link Preview',
      terms: ['链接', '预览', 'link', 'preview']
    },
    {
      anchorId: 'preferences-emoji',
      labelKey: 'setting.preferences.emoji_section',
      fallbackLabel: 'Emoji',
      terms: ['表情', 'emoji', 'emoticon']
    },
    {
      anchorId: 'preferences-burn-defaults',
      labelKey: 'setting.preferences.burn_defaults_section',
      fallbackLabel: 'Burn After Read Defaults',
      terms: ['阅后即焚', '焚毁', 'burn']
    },
    {
      anchorId: 'preferences-thread',
      labelKey: 'setting.preferences.thread_section',
      fallbackLabel: 'Threads',
      terms: ['线程', '话题', 'thread']
    },
    {
      anchorId: 'preferences-space',
      labelKey: 'setting.preferences.space_section',
      fallbackLabel: 'Spaces',
      terms: ['空间', '子空间', 'space']
    },
    {
      anchorId: 'preferences-privacy',
      labelKey: 'setting.preferences.privacy_section',
      fallbackLabel: 'Privacy',
      terms: ['已读回执', '输入状态', '隐私', 'read', 'receipt', 'typing', 'privacy']
    }
  ],
  account: [
    {
      anchorId: 'account-profile',
      labelKey: 'setting.account.profile',
      fallbackLabel: 'Profile',
      terms: ['个人资料', '昵称', '头像', '简介', 'profile', 'nickname', 'avatar', 'about']
    },
    {
      anchorId: 'account-security',
      labelKey: 'setting.account.security',
      fallbackLabel: 'Security',
      terms: ['密码', '安全', 'password', 'security']
    },
    {
      anchorId: 'account-danger',
      labelKey: 'setting.account.danger_zone',
      fallbackLabel: 'Danger Zone',
      terms: ['注销', '危险', 'deactivate', 'danger']
    }
  ],
  notifications: [
    {
      anchorId: 'notifications-desktop',
      labelKey: 'setting.notification.desktop.title',
      fallbackLabel: 'Desktop Notifications',
      terms: ['桌面通知', '声音', '音量', 'desktop', 'notification', 'sound', 'volume']
    },
    {
      anchorId: 'notifications-content',
      labelKey: 'setting.notification.content.title',
      fallbackLabel: 'Notification Content',
      terms: ['消息内容', '发送者', 'content', 'sender']
    },
    {
      anchorId: 'notifications-keyword',
      labelKey: 'setting.notification.keyword.title',
      fallbackLabel: 'Keywords',
      terms: ['关键词', 'keyword']
    },
    {
      anchorId: 'notifications-thread',
      labelKey: 'setting.notification.thread.title',
      fallbackLabel: 'Thread Notifications',
      terms: ['线程通知', 'thread', 'mention']
    },
    {
      anchorId: 'notifications-push',
      labelKey: 'setting.notification.push_section.title',
      fallbackLabel: 'Push Notifications',
      terms: ['推送', '规则', 'push', 'pusher', 'rule']
    }
  ]
}

const SETTINGS_SEARCH_ROOT_KEY = 'setting.dialog.search_root'

function normalizeSearchTerm(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[\s\-_]+/g, '')
}

function uniqueTerms(values: string[]): string[] {
  const seen = new Set<string>()
  const result: string[] = []

  for (const value of values) {
    const normalizedValue = normalizeSearchTerm(value)
    if (!normalizedValue || seen.has(normalizedValue)) continue
    seen.add(normalizedValue)
    result.push(normalizedValue)
  }

  return result
}

function getLegacyTerms(tabId: SettingsTabType): string[] {
  return (Object.entries(SETTINGS_LEGACY_TAB_MAP) as Array<[LegacySettingsTabType, SettingsTabType]>)
    .filter(([, mappedTabId]) => mappedTabId === tabId)
    .map(([legacyTabId]) => legacyTabId)
}

function getKeywordTerms(tabId: SettingsTabType, keywordResolver?: SettingsSearchKeywordResolver): string[] {
  return keywordResolver?.(tabId) ?? []
}

function translateOrFallback(translator: SettingsTabTranslator | undefined, key: string, fallback: string): string {
  const translated = translator?.(key)
  return translated && translated !== key ? translated : fallback
}

function getSearchRootLabel(t?: SettingsTabTranslator): string {
  return translateOrFallback(t, SETTINGS_SEARCH_ROOT_KEY, 'Settings')
}

function buildAnchorTerms(anchor: SettingsSearchAnchor, t?: SettingsTabTranslator): string[] {
  return uniqueTerms([
    translateOrFallback(t, anchor.labelKey, anchor.fallbackLabel),
    anchor.fallbackLabel,
    ...anchor.terms
  ])
}

function buildSettingsSearchIndex(
  tabs: SettingsTab[],
  t?: SettingsTabTranslator,
  keywordResolver?: SettingsSearchKeywordResolver
): SettingsSearchEntry[] {
  return tabs.map((tab) => ({
    id: tab.id,
    terms: uniqueTerms([
      tab.id,
      getSettingsTabLabel(tab.id, t),
      ...getLegacyTerms(tab.id),
      ...getKeywordTerms(tab.id, keywordResolver),
      ...(ROUTE_TERMS[tab.id] ?? [])
    ]),
    anchors: (SETTINGS_ANCHOR_DEFINITIONS[tab.id] ?? []).map((anchor) => ({
      ...anchor,
      terms: buildAnchorTerms(anchor, t)
    }))
  }))
}

const SETTINGS_SEARCH_INDEX = buildSettingsSearchIndex(SETTINGS_TABS)

function matchesTerms(terms: string[], normalizedQuery: string): boolean {
  return terms.some((term) => term.includes(normalizedQuery))
}

function isTabAvailable(tabId: SettingsTabType, predicate?: (tab: SettingsTab) => boolean): boolean {
  if (!predicate) return true
  const tab = SETTINGS_TABS.find((item) => item.id === tabId)
  return tab ? predicate(tab) : true
}

export function matchesSettingsSearch(
  tabId: SettingsTabType,
  query?: string,
  t?: SettingsTabTranslator,
  keywordResolver?: SettingsSearchKeywordResolver
): boolean {
  const normalizedQuery = normalizeSearchTerm(query || '')
  if (!normalizedQuery) return true

  const searchIndex =
    t || keywordResolver ? buildSettingsSearchIndex(SETTINGS_TABS, t, keywordResolver) : SETTINGS_SEARCH_INDEX
  const entry = searchIndex.find((item) => item.id === tabId)
  if (!entry) return false

  if (matchesTerms(entry.terms, normalizedQuery)) return true
  return entry.anchors.some((anchor) => matchesTerms(anchor.terms, normalizedQuery))
}

/**
 * 两级搜索结果：优先返回二级锚点命中（可定位到具体分区），
 * 页签内无锚点命中时才降级为页签标题命中。
 */
export function findSettingsSearchResults(
  query?: string,
  t?: SettingsTabTranslator,
  keywordResolver?: SettingsSearchKeywordResolver,
  isAvailable?: (tab: SettingsTab) => boolean
): SettingsSearchResult[] {
  const normalizedQuery = normalizeSearchTerm(query || '')
  if (!normalizedQuery) return []

  const searchIndex =
    t || keywordResolver ? buildSettingsSearchIndex(SETTINGS_TABS, t, keywordResolver) : SETTINGS_SEARCH_INDEX
  const rootLabel = getSearchRootLabel(t)

  return searchIndex.flatMap((entry) => {
    const tabLabel = getSettingsTabLabel(entry.id, t)
    const available = isTabAvailable(entry.id, isAvailable)
    const matchedAnchors = entry.anchors.filter((anchor) => matchesTerms(anchor.terms, normalizedQuery))

    if (matchedAnchors.length > 0) {
      return matchedAnchors.map((anchor) => ({
        tabId: entry.id,
        anchorId: anchor.anchorId,
        path: [rootLabel, tabLabel, translateOrFallback(t, anchor.labelKey, anchor.fallbackLabel)],
        available
      }))
    }

    if (!matchesTerms(entry.terms, normalizedQuery)) return []

    return [
      {
        tabId: entry.id,
        path: [rootLabel, tabLabel],
        available
      }
    ]
  })
}
