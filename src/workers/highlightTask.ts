import type { HighlighterCore, LanguageRegistration, ThemeRegistration } from '@shikijs/core'
import { createTask, registerTask } from './workerRegistry'

interface HighlightInput {
  code: string
  language: string
  theme: string
}

interface HighlightOutput {
  html: string
}

let highlighter: HighlighterCore | null = null
const loadedLangs = new Set<string>()
const loadedThemes = new Set<string>()

const COMMON_LANGS = [
  'javascript',
  'typescript',
  'rust',
  'python',
  'json',
  'yaml',
  'bash',
  'sql',
  'html',
  'css',
  'markdown'
]

async function getHighlighter(): Promise<HighlighterCore> {
  if (highlighter) return highlighter

  const [{ createHighlighterCore }, { createOnigurumaEngine }] = await Promise.all([
    import('@shikijs/core'),
    import('shiki/engine/oniguruma')
  ])

  highlighter = await createHighlighterCore({
    themes: [],
    langs: [],
    engine: createOnigurumaEngine(() => import.meta.resolve)
  })

  return highlighter
}

async function ensureLanguage(lang: string): Promise<void> {
  const normalizedLang = normalizeLang(lang)
  if (loadedLangs.has(normalizedLang)) return

  const hl = await getHighlighter()
  try {
    const { bundledLanguages } = await import('shiki/langs')
    const loader = bundledLanguages[normalizedLang as keyof typeof bundledLanguages]
    if (loader) {
      const langModule = (await loader()) as { default?: LanguageRegistration | LanguageRegistration[] }
      const langDefs = langModule.default || (langModule as unknown as LanguageRegistration | LanguageRegistration[])
      const langs = Array.isArray(langDefs) ? langDefs : [langDefs]
      for (const langDef of langs) {
        await hl.loadLanguage(langDef)
      }
      loadedLangs.add(normalizedLang)
    }
  } catch {
    // skip unavailable languages
  }
}

async function ensureTheme(theme: string): Promise<void> {
  if (loadedThemes.has(theme)) return

  const hl = await getHighlighter()
  try {
    const { bundledThemes } = await import('shiki/themes')
    const loader = bundledThemes[theme as keyof typeof bundledThemes]
    if (loader) {
      const themeModule = (await loader()) as { default?: ThemeRegistration }
      const themeDef = themeModule.default || (themeModule as unknown as ThemeRegistration)
      await hl.loadTheme(themeDef)
      loadedThemes.add(theme)
    }
  } catch {
    // skip unavailable themes
  }
}

function normalizeLang(lang: string): string {
  const aliases: Record<string, string> = {
    js: 'javascript',
    ts: 'typescript',
    py: 'python',
    yml: 'yaml',
    sh: 'bash',
    shell: 'bash',
    zsh: 'bash',
    md: 'markdown',
    rb: 'ruby',
    go: 'go',
    kt: 'kotlin',
    rs: 'rust',
    c: 'c',
    cpp: 'cpp',
    java: 'java',
    jsx: 'jsx',
    tsx: 'tsx',
    vue: 'vue',
    sql: 'sql',
    dockerfile: 'docker',
    makefile: 'make'
  }
  const lower = lang.toLowerCase().trim()
  return aliases[lower] || lower
}

async function preloadCommon(): Promise<void> {
  const hl = await getHighlighter()
  const { bundledLanguages } = await import('shiki/langs')
  const { bundledThemes } = await import('shiki/themes')

  const langPromises = COMMON_LANGS.map(async (lang) => {
    if (loadedLangs.has(lang)) return
    try {
      const loader = bundledLanguages[lang as keyof typeof bundledLanguages]
      if (loader) {
        const langModule = (await loader()) as { default?: LanguageRegistration | LanguageRegistration[] }
        const langDefs = langModule.default || (langModule as unknown as LanguageRegistration | LanguageRegistration[])
        const langs = Array.isArray(langDefs) ? langDefs : [langDefs]
        for (const langDef of langs) {
          await hl.loadLanguage(langDef)
        }
        loadedLangs.add(lang)
      }
    } catch {
      // skip unavailable languages
    }
  })

  const themePromises = ['vitesse-dark', 'vitesse-light'].map(async (theme) => {
    if (loadedThemes.has(theme)) return
    try {
      const loader = bundledThemes[theme as keyof typeof bundledThemes]
      if (loader) {
        const themeModule = (await loader()) as { default?: ThemeRegistration }
        const themeDef = themeModule.default || (themeModule as unknown as ThemeRegistration)
        await hl.loadTheme(themeDef)
        loadedThemes.add(theme)
      }
    } catch {
      // skip unavailable themes
    }
  })

  await Promise.allSettled([...langPromises, ...themePromises])
}

let preloaded = false

const highlightTask = createTask<HighlightInput, HighlightOutput>('highlight-code', async (input) => {
  const themeKey = input.theme || 'vitesse-dark'
  const langKey = normalizeLang(input.language || 'text')

  const hl = await getHighlighter()

  if (!preloaded) {
    preloaded = true
    await preloadCommon()
  }

  await Promise.allSettled([ensureLanguage(langKey), ensureTheme(themeKey)])

  const resolvedLang = loadedLangs.has(langKey) ? langKey : Array.from(loadedLangs)[0]
  const resolvedTheme = loadedThemes.has(themeKey)
    ? themeKey
    : loadedThemes.has('vitesse-dark')
      ? 'vitesse-dark'
      : Array.from(loadedThemes)[0]

  if (!resolvedTheme || !resolvedLang) {
    return { html: `<pre><code>${escapeHtml(input.code)}</code></pre>` }
  }

  try {
    const html = hl.codeToHtml(input.code, {
      lang: resolvedLang,
      theme: resolvedTheme
    })
    return { html }
  } catch {
    return { html: `<pre><code>${escapeHtml(input.code)}</code></pre>` }
  }
})

function escapeHtml(str: string): string {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

registerTask(highlightTask)
