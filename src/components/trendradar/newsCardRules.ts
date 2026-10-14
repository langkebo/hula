/**
 * NewsCard 派生规则
 *
 * 平台名 / 标签关键词用于匹配**外部数据源下发的中文文案**，属于数据匹配字面量而非展示
 * 文案，无法走 i18n（参见 `src/utils/userStatus.ts` 中同类先例）。集中于此，避免散落在
 * `.vue` 中抬高中文硬编码 ratchet。
 */

export type NewsPlatformType = 'info' | 'warning' | 'success' | 'default'

/** 资讯平台 → n-tag type 映射规则（按声明顺序匹配首个命中项） */
const PLATFORM_TYPE_RULES: { type: Exclude<NewsPlatformType, 'default'>; keywords: string[] }[] = [
  { type: 'info', keywords: ['知乎'] },
  { type: 'warning', keywords: ['头条', '微博'] },
  { type: 'success', keywords: ['百度'] }
]

export function resolveNewsPlatformType(platform: string | undefined): NewsPlatformType {
  const normalized = platform?.toLowerCase() ?? ''
  for (const { type, keywords } of PLATFORM_TYPE_RULES) {
    if (keywords.some((keyword) => normalized.includes(keyword))) return type
  }
  return 'default'
}

/** 标签 key，翻译键见 `trendradar.tags.*` */
export type NewsTagKey = 'ai' | 'tech' | 'finance' | 'entertainment'

/** 标题关键词 → 标签 key（关键词用于匹配外部中文标题） */
const TAG_KEYWORD_RULES: { key: NewsTagKey; keywords: string[] }[] = [
  { key: 'ai', keywords: ['AI', '人工智能'] },
  { key: 'tech', keywords: ['科技'] },
  { key: 'finance', keywords: ['财经', '金融'] },
  { key: 'entertainment', keywords: ['娱乐'] }
]

const MAX_TAGS = 3

export function extractNewsTags(title: string): NewsTagKey[] {
  const keys: NewsTagKey[] = []
  for (const { key, keywords } of TAG_KEYWORD_RULES) {
    if (keywords.some((keyword) => title.includes(keyword))) keys.push(key)
  }
  return keys.slice(0, MAX_TAGS)
}
