/**
 * Fallback chat-role category values.
 *
 * These Chinese strings are protocol payload values (sent to / received from the
 * backend `chatRoleCategoryList` endpoint); they must NOT be translated. The
 * authoritative list is provided by the backend and replaces this fallback when
 * available. Kept in a module so view files stay free of hardcoded literals.
 */
export const CHAT_ROLE_CATEGORY_VALUES = {
  aiAssistant: 'AI助手',
  writing: '写作',
  programming: '编程开发',
  education: '学习教育',
  entertainment: '生活娱乐',
  business: '商务办公',
  creative: '创意设计',
  dataAnalysis: '数据分析',
  translation: '翻译',
  other: '其他'
} as const
