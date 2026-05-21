import DOMPurify from 'dompurify'

const MESSAGE_INPUT_ALLOWED_TAGS = ['div', 'p', 'span', 'img', 'br']
const MESSAGE_INPUT_ALLOWED_ATTR = [
  'id',
  'class',
  'src',
  'alt',
  'contenteditable',
  'data-type',
  'data-path',
  'data-ait-uid',
  'data-server-url'
]

export function sanitizeMessageInputHtml(rawHtml: string): string {
  if (!rawHtml) {
    return ''
  }

  const sanitized = String(
    DOMPurify.sanitize(rawHtml, {
      ALLOWED_TAGS: MESSAGE_INPUT_ALLOWED_TAGS,
      ALLOWED_ATTR: MESSAGE_INPUT_ALLOWED_ATTR,
      ALLOW_DATA_ATTR: true,
      KEEP_CONTENT: true,
      FORBID_TAGS: ['script', 'style']
    })
  )

  const container = document.createElement('div')
  container.innerHTML = sanitized
  container.querySelectorAll('script, style').forEach((node) => node.remove())
  container.querySelectorAll<HTMLElement>('*').forEach((node) => {
    for (const attr of [...node.attributes]) {
      if (attr.name.toLowerCase().startsWith('on')) {
        node.removeAttribute(attr.name)
      }
    }
  })

  return container.innerHTML
}

export function applySanitizedMessageInputHtml(container: HTMLElement, rawHtml: string): string {
  const sanitized = sanitizeMessageInputHtml(rawHtml)
  container.innerHTML = sanitized
  return sanitized
}

export function getPlainTextFromSanitizedHtml(html: string): string {
  if (!html) {
    return ''
  }

  const container = document.createElement('div')
  container.innerHTML = html
  return (container.textContent || '').replace(/\u00A0/g, ' ').trim()
}
