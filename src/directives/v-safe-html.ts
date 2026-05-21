import type { Config as DOMPurifyConfig } from 'dompurify'
import DOMPurify from 'dompurify'
import type { DirectiveBinding } from 'vue'
import { renderWorker } from '@/services/renderWorker'

const DEFAULT_CONFIG = {
  ALLOWED_TAGS: [
    'b',
    'i',
    'em',
    'strong',
    'a',
    'p',
    'br',
    'ul',
    'ol',
    'li',
    'code',
    'pre',
    'blockquote',
    'span',
    'div',
    'h1',
    'h2',
    'h3',
    'h4',
    'h5',
    'h6',
    'table',
    'thead',
    'tbody',
    'tr',
    'th',
    'td',
    'img',
    'hr',
    'del',
    'sup',
    'sub',
    'details',
    'summary',
    'mark'
  ],
  ALLOWED_ATTR: [
    'href',
    'target',
    'rel',
    'class',
    'src',
    'alt',
    'title',
    'colspan',
    'rowspan',
    'data-mx-bg-color',
    'data-mx-color',
    'data-mx-spoiler',
    'data-mx-ping',
    'data-mx-room'
  ],
  ALLOW_DATA_ATTR: false,
  FORBID_TAGS: ['script', 'style', 'iframe', 'object', 'embed', 'form', 'input'],
  FORBID_ATTR: ['onerror', 'onload', 'onclick', 'onmouseover', 'style']
} as const

DOMPurify.addHook('afterSanitizeAttributes', (node) => {
  if (node.tagName === 'A') {
    node.setAttribute('target', '_blank')
    node.setAttribute('rel', 'noopener noreferrer')
  }

  // Convert Matrix custom color attributes to inline styles (safe subset: color/background-color only)
  const el = node as HTMLElement
  const fgColor = el.getAttribute('data-mx-color')
  const bgColor = el.getAttribute('data-mx-bg-color')
  if (fgColor || bgColor) {
    const parts: string[] = []
    if (fgColor) parts.push(`color:${fgColor}`)
    if (bgColor) parts.push(`background-color:${bgColor}`)
    el.setAttribute('style', parts.join(';'))
  }
})

async function sanitizeAsync(el: HTMLElement, html: string, config?: DOMPurifyConfig) {
  if (!html) {
    el.innerHTML = ''
    return
  }

  try {
    const { result } = await renderWorker.execute<{ html: string; config?: DOMPurifyConfig }, { result: string }>(
      'sanitize-html',
      {
        html,
        config
      }
    )
    el.innerHTML = result
  } catch (_error) {
    // 降级使用主线程清洗
    el.innerHTML = String(DOMPurify.sanitize(html, (config || DEFAULT_CONFIG) as DOMPurifyConfig))
  }
}

export const vSafeHtml = {
  mounted(el: HTMLElement, binding: DirectiveBinding<string>) {
    void sanitizeAsync(
      el,
      binding.value,
      binding.arg ? undefined : (DEFAULT_CONFIG as unknown as Record<string, unknown>)
    )
  },
  updated(el: HTMLElement, binding: DirectiveBinding<string>) {
    if (binding.value !== binding.oldValue) {
      void sanitizeAsync(
        el,
        binding.value,
        binding.arg ? undefined : (DEFAULT_CONFIG as unknown as Record<string, unknown>)
      )
    }
  }
}
