import { createTask, registerTask } from './workerRegistry'

interface SanitizeInput {
  html: string
  config?: {
    allowedTags?: string[]
    allowedAttr?: string[]
  }
}

interface SanitizeOutput {
  result: string
}

const sanitizeTask = createTask<SanitizeInput, SanitizeOutput>('sanitize-html', async (input) => {
  const DOMPurify = (await import('dompurify')).default
  const config: Record<string, unknown> = {
    ALLOWED_TAGS: input.config?.allowedTags,
    ALLOWED_ATTR: input.config?.allowedAttr,
    ALLOW_DATA_ATTR: false,
    FORBID_TAGS: ['script', 'style', 'iframe', 'object', 'embed', 'form'],
    FORBID_ATTR: ['onerror', 'onload', 'onclick', 'onmouseover']
  }
  const result = String(DOMPurify.sanitize(input.html, config as Record<string, unknown>))
  return { result }
})

registerTask(sanitizeTask)
