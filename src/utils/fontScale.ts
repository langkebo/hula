import { createLogger } from '@/utils/Logger'

const logger = createLogger('FontScale')

/** 可选的字体缩放档位。1 为基准。 */
export const FONT_SCALE_STEPS = [0.875, 1, 1.125, 1.25] as const

const STORAGE_KEY = 'tjg-font-scale'

export function normalizeFontScale(value: unknown): number {
  if (typeof value === 'number' && (FONT_SCALE_STEPS as readonly number[]).includes(value)) {
    return value
  }
  return 1
}

export function applyFontScale(scale: number, root: HTMLElement = document.documentElement): void {
  const normalized = normalizeFontScale(scale)
  root.style.setProperty('--tjg-font-scale', String(normalized))
}

export function loadFontScale(storage: Pick<Storage, 'getItem'> = localStorage): number {
  try {
    const raw = storage.getItem(STORAGE_KEY)
    return raw === null ? 1 : normalizeFontScale(Number(raw))
  } catch (err) {
    logger.warn('读取字体缩放失败:', err)
    return 1
  }
}

export function saveFontScale(scale: number, storage: Pick<Storage, 'setItem'> = localStorage): void {
  try {
    storage.setItem(STORAGE_KEY, String(normalizeFontScale(scale)))
  } catch (err) {
    logger.warn('保存字体缩放失败:', err)
  }
}
