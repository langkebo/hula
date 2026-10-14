import type { Config as DOMPurifyConfig } from 'dompurify'
import DOMPurify from 'dompurify'
import type { DirectiveBinding } from 'vue'
import { renderWorker } from '@/services/renderWorker'
import { DEFAULT_SAFE_HTML_CONFIG, installSafeHtmlHooks } from '@/utils/safeHtml'

installSafeHtmlHooks(DOMPurify)

async function sanitizeAsync(el: HTMLElement, html: string, config?: DOMPurifyConfig) {
  if (!html) {
    el.innerHTML = ''
    return
  }

  try {
    const { result } = await renderWorker.execute<
      { html: string; config?: DOMPurifyConfig | undefined },
      { result: string }
    >('sanitize-html', {
      html,
      config
    })
    el.innerHTML = result
  } catch {
    // 降级使用主线程清洗
    el.innerHTML = String(DOMPurify.sanitize(html, config || DEFAULT_SAFE_HTML_CONFIG))
  }
}

export const vSafeHtml = {
  mounted(el: HTMLElement, binding: DirectiveBinding<string>) {
    void sanitizeAsync(el, binding.value, DEFAULT_SAFE_HTML_CONFIG)
  },
  updated(el: HTMLElement, binding: DirectiveBinding<string>) {
    if (binding.value !== binding.oldValue) {
      void sanitizeAsync(el, binding.value, DEFAULT_SAFE_HTML_CONFIG)
    }
  }
}
