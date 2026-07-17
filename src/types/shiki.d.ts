declare module '@shikijs/core' {
  export interface HighlighterCore {
    codeToHtml(code: string, options: { lang: string; theme: string }): string
    loadLanguage(lang: LanguageRegistration): Promise<void>
    loadTheme(theme: ThemeRegistration): Promise<void>
    getLoadedLanguages(): string[]
    getLoadedThemes(): string[]
  }

  export interface LanguageRegistration {
    name: string
    scopeName?: string
    patterns?: unknown[]
    repository?: Record<string, unknown>
    aliases?: string[]
  }

  export interface ThemeRegistration {
    name: string
    type?: 'dark' | 'light'
    settings?: unknown[]
    colors?: Record<string, string>
    tokenColors?: unknown[]
  }

  export interface LoadWasmOptions {
    theme?: string
  }

  export function createHighlighterCore(options: {
    themes: ThemeRegistration[]
    langs: LanguageRegistration[]
    engine?: unknown
  }): Promise<HighlighterCore>
}

declare module 'shiki/langs/*.mjs' {
  import type { LanguageRegistration } from '@shikijs/core'

  const lang: LanguageRegistration
  export default lang
}

declare module 'shiki/themes/*.mjs' {
  import type { ThemeRegistration } from '@shikijs/core'

  const theme: ThemeRegistration
  export default theme
}

declare module 'shiki/engine/oniguruma' {
  export function createOnigurumaEngine(loadWasm: unknown): unknown
}
