import { setTheme } from '@tauri-apps/api/app'
import type { Theme } from '@tauri-apps/api/window'
import { ThemeEnum } from '@/enums'
import { normalizeTheme, resolveOsTheme, setDocumentTheme, stripLegacyThemeVariant } from './settings-helpers'

/**
 * 主题相关的副作用（store 外置部分）。
 *
 * 从 `setting.ts` 抽出（该文件已超 600 行）：这些函数只读写传入的 `themes` 分区，
 * 直接改状态字段即可触发 pinia 响应式（与 store 内其它 action 的直接赋值一致）。
 */

/** 设置侧边栏主题 */
function applyNativeTheme(theme: string): void {
  setTheme(Object.is(theme, 'os') ? null : (theme as Theme))
}

/** 初始化主题：写入 pattern/content 并同步文档与原生外观 */
export function initTheme(themes: STO.Setting['themes'], theme: string): void {
  const nextPattern = theme === ThemeEnum.OS ? ThemeEnum.OS : normalizeTheme(theme)
  const nextContent = theme === ThemeEnum.OS ? resolveOsTheme() : normalizeTheme(theme)
  themes.pattern = nextPattern
  themes.content = nextContent
  stripLegacyThemeVariant(themes)
  setDocumentTheme(nextContent)
  applyNativeTheme(theme)
}

/** 切换主题 */
export function toggleTheme(themes: STO.Setting['themes'], theme: string): void {
  applyNativeTheme(theme)
  if (theme === ThemeEnum.OS) {
    const os = resolveOsTheme()
    themes.pattern = ThemeEnum.OS
    themes.content = os
    stripLegacyThemeVariant(themes)
    setDocumentTheme(os)
    return
  }
  const nextTheme = normalizeTheme(theme)
  themes.pattern = nextTheme
  themes.content = nextTheme
  stripLegacyThemeVariant(themes)
  setDocumentTheme(nextTheme)
}

/** 同步系统主题到内容（仅在跟随系统时生效） */
export function syncOsTheme(themes: STO.Setting['themes']): void {
  if (themes.pattern !== ThemeEnum.OS) return
  const os = resolveOsTheme()
  if (themes.content !== os) themes.content = os
  setDocumentTheme(os)
}

/** 兜底修正主题状态 */
export function normalizeThemeState(themes: STO.Setting['themes']): void {
  stripLegacyThemeVariant(themes)

  if (themes.pattern === ThemeEnum.OS) {
    syncOsTheme(themes)
    return
  }
  const nextTheme = normalizeTheme(themes.pattern || themes.content)
  if (themes.pattern !== nextTheme || themes.content !== nextTheme) {
    themes.pattern = nextTheme
    themes.content = nextTheme
  }
  stripLegacyThemeVariant(themes)
  setDocumentTheme(nextTheme)
}

/** 确保主题状态已初始化且可安全使用 */
export function ensureThemeReady(themes: STO.Setting['themes'], preferredTheme?: string): void {
  if (!themes.content) {
    initTheme(themes, preferredTheme || themes.pattern || ThemeEnum.OS)
    return
  }
  normalizeThemeState(themes)
}
