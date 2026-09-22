import { createLogger } from '@/utils/Logger'

const logger = createLogger('BubbleStyle')

/** 可选的圆角档位。rounded 为默认。 */
export const BUBBLE_STYLES = ['rounded', 'square'] as const

export type BubbleStyle = (typeof BUBBLE_STYLES)[number]

const STORAGE_KEY = 'tjg-bubble-style'
const ROOT_ATTR = 'data-bubble-style'
const DEFAULT_BUBBLE_STYLE: BubbleStyle = 'rounded'

/**
 * 旧 UI 写的是布尔字符串：'true' 表示圆角、'false' 表示方形。
 * 迁移方向由「开关 checked = 圆角」的既有语义决定。
 */
export function normalizeBubbleStyle(value: unknown): BubbleStyle {
  switch (value) {
    case 'rounded':
    case 'square':
      return value
    case 'true':
      return 'rounded'
    case 'false':
      return 'square'
    default:
      return DEFAULT_BUBBLE_STYLE
  }
}

/** 写到根元素的 data 属性上，由 render-message.scss 的 [data-bubble-style='square'] 规则消费。 */
export function applyBubbleStyle(style: string, root: HTMLElement = document.documentElement): void {
  root.setAttribute(ROOT_ATTR, normalizeBubbleStyle(style))
}

export function loadBubbleStyle(storage: Pick<Storage, 'getItem'> = localStorage): BubbleStyle {
  try {
    const raw = storage.getItem(STORAGE_KEY)
    return raw === null ? DEFAULT_BUBBLE_STYLE : normalizeBubbleStyle(raw)
  } catch (err) {
    logger.warn('读取气泡样式失败:', err)
    return DEFAULT_BUBBLE_STYLE
  }
}

export function saveBubbleStyle(style: string, storage: Pick<Storage, 'setItem'> = localStorage): void {
  try {
    storage.setItem(STORAGE_KEY, normalizeBubbleStyle(style))
  } catch (err) {
    logger.warn('保存气泡样式失败:', err)
  }
}
