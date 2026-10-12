/**
 * 安全 HTML 清洗的共享配置与钩子（SC-08）
 *
 * `v-safe-html` 指令（主线程降级路径）与 `sanitize-html` compute task（worker 路径）
 * 此前各自维护一份白名单/钩子，且键名大小写不一致（worker 读 camelCase，指令传
 * DOMPurify 大写键），导致 worker 路径静默丢弃白名单并回落到 DOMPurify 默认的
 * 更宽松标签集。本模块作为唯一来源，保证两条路径等价。
 *
 * 约束：仅 type-only 引入 dompurify，不引入运行时依赖，可安全用于 worker。
 */

import type { Config as DOMPurifyConfig, DOMPurify as DOMPurifyInstance } from 'dompurify'

/**
 * 默认白名单配置。未显式传入配置时，主线程与 worker 路径均使用此配置。
 */
export const DEFAULT_SAFE_HTML_CONFIG: DOMPurifyConfig = {
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
}

/**
 * 解析清洗配置：非普通对象一律回落到默认配置，
 * 避免 worker 收到 `undefined` 时静默使用 DOMPurify 默认的宽松标签集。
 */
export function resolveSafeHtmlConfig(config?: unknown): DOMPurifyConfig {
  if (config && typeof config === 'object' && !Array.isArray(config)) {
    return config as DOMPurifyConfig
  }
  return DEFAULT_SAFE_HTML_CONFIG
}

const hookedPurifiers = new WeakSet<object>()

/**
 * `afterSanitizeAttributes` 钩子：为外链补 target/rel，
 * 并把 Matrix 自定义颜色属性转换为安全的内联样式（仅 color/background-color）。
 */
function applySafeHtmlAttributesHook(node: Element): void {
  if (node.tagName === 'A') {
    node.setAttribute('target', '_blank')
    node.setAttribute('rel', 'noopener noreferrer')
  }

  const fgColor = node.getAttribute('data-mx-color')
  const bgColor = node.getAttribute('data-mx-bg-color')
  if (fgColor || bgColor) {
    const parts: string[] = []
    if (fgColor) parts.push(`color:${fgColor}`)
    if (bgColor) parts.push(`background-color:${bgColor}`)
    node.setAttribute('style', parts.join(';'))
  }
}

/**
 * 为指定 DOMPurify 实例安装共享钩子（幂等，重复调用不会重复注册）。
 */
export function installSafeHtmlHooks(purifier: DOMPurifyInstance): void {
  if (hookedPurifiers.has(purifier)) return
  hookedPurifiers.add(purifier)
  purifier.addHook('afterSanitizeAttributes', applySafeHtmlAttributesHook)
}
