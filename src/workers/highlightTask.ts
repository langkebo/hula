import type { Highlighter } from 'shiki'
import { createTask, registerTask } from './workerRegistry'

interface HighlightInput {
  code: string
  language: string
  theme: string
}

interface HighlightOutput {
  html: string
}

const highlighters: Record<string, Highlighter> = {}

const highlightTask = createTask<HighlightInput, HighlightOutput>('highlight-code', async (input) => {
  // 动态导入 shiki 以保持 worker 轻量
  const { createHighlighter } = await import('shiki')

  const themeKey = input.theme || 'vitesse-dark'

  if (!highlighters[themeKey]) {
    highlighters[themeKey] = await createHighlighter({
      themes: [themeKey],
      langs: [input.language || 'javascript', 'typescript', 'rust', 'python', 'json', 'yaml', 'bash', 'sql']
    })
  }

  const highlighter = highlighters[themeKey]
  const html = highlighter.codeToHtml(input.code, {
    lang: input.language || 'text',
    theme: themeKey
  })

  return { html }
})

registerTask(highlightTask)

export { highlightTask }
