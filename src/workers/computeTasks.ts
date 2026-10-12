import type { Config as DOMPurifyConfig } from 'dompurify'
import { installSafeHtmlHooks, resolveSafeHtmlConfig } from '@/utils/safeHtml'
import { createTask, registerTask } from './workerRegistry'

interface SanitizeInput {
  html: string
  config?: DOMPurifyConfig
}

interface SanitizeOutput {
  result: string
}

const sanitizeTask = createTask<SanitizeInput, SanitizeOutput>('sanitize-html', async (input) => {
  const DOMPurify = (await import('dompurify')).default
  // 与主线程降级路径共享同一份白名单与钩子，避免两条路径行为不一致（SC-08）
  installSafeHtmlHooks(DOMPurify)
  const config = resolveSafeHtmlConfig(input?.config)
  const result = String(DOMPurify.sanitize(String(input?.html ?? ''), config))
  return { result }
})

registerTask(sanitizeTask)
