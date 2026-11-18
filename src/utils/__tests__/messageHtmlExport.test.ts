import { describe, expect, it } from 'vitest'
import { buildExportFileName, buildMessageHtml, escapeHtml, formatExportTime } from '../messageHtmlExport'

/**
 * 消息 → HTML 导出的判据。
 *
 * 核心风险不是排版，而是**注入**：消息正文是对端可控的不可信内容，
 * 拼进 HTML 前必须全量转义，否则导出的文件在浏览器里打开会执行脚本。
 * 因此下面把「转义」和「结构完整性」当作硬断言，排版细节只做存在性检查。
 */
describe('escapeHtml', () => {
  it('转义全部五个 HTML 敏感字符', () => {
    expect(escapeHtml(`<img src=x onerror="alert('x')">&`)).toBe(
      '&lt;img src=x onerror=&quot;alert(&#39;x&#39;)&quot;&gt;&amp;'
    )
  })

  it('普通文本原样返回', () => {
    expect(escapeHtml('普通文本 + emoji 🙂')).toBe('普通文本 + emoji 🙂')
  })
})

describe('formatExportTime', () => {
  it('无效时间返回空串（不渲染 1970）', () => {
    expect(formatExportTime(null)).toBe('')
    expect(formatExportTime(undefined)).toBe('')
    expect(formatExportTime(0)).toBe('')
    expect(formatExportTime(Number.NaN)).toBe('')
  })

  it('有效时间格式化为 YYYY-MM-DD HH:mm:ss', () => {
    const ts = new Date(2026, 10, 18, 9, 5, 3).getTime()
    expect(formatExportTime(ts)).toBe('2026-11-18 09:05:03')
  })
})

describe('buildMessageHtml', () => {
  const base = { sender: '@alice:hs', timestamp: new Date(2026, 10, 18, 9, 5, 3).getTime(), content: 'hello' }

  it('输出完整 HTML 文档结构', () => {
    const html = buildMessageHtml(base)
    expect(html.startsWith('<!DOCTYPE html>')).toBe(true)
    expect(html).toContain('<meta charset="utf-8" />')
    expect(html).toContain('hello')
    expect(html).toContain('@alice:hs')
    expect(html.trimEnd().endsWith('</html>')).toBe(true)
  })

  it('正文里的脚本与标签被转义，不产生可执行节点', () => {
    const html = buildMessageHtml({ ...base, content: '<script>alert(1)</script>' })
    expect(html).not.toContain('<script>alert(1)</script>')
    expect(html).toContain('&lt;script&gt;alert(1)&lt;/script&gt;')
  })

  it('发件人与房间名同样转义（属性/标题注入面）', () => {
    const html = buildMessageHtml({ ...base, sender: '"><svg onload=alert(1)>', roomName: '<b>房</b>' })
    expect(html).not.toContain('<svg onload=alert(1)>')
    expect(html).toContain('&lt;svg onload=alert(1)&gt;')
    expect(html).toContain('&lt;b&gt;房&lt;/b&gt;')
  })

  it('缺时间时不渲染时间行（不留空行）', () => {
    const html = buildMessageHtml({ ...base, timestamp: null })
    expect(html).not.toContain('时间：')
  })

  it('不引用任何外部资源（离线可打开）', () => {
    const html = buildMessageHtml(base)
    expect(html).not.toMatch(/https?:\/\//)
    expect(html).not.toContain('<link')
    expect(html).not.toContain('<script')
  })
})

describe('buildExportFileName', () => {
  it('用时间戳生成可读文件名', () => {
    const ts = new Date(2026, 10, 18, 9, 5, 3).getTime()
    expect(buildExportFileName('$evt', ts)).toBe('消息-20261118090503.html')
  })

  it('无时间戳时回退事件 ID 片段，且不含路径分隔符', () => {
    const name = buildExportFileName('$a/b\\c:d', null)
    expect(name.endsWith('.html')).toBe(true)
    expect(name).not.toContain('/')
    expect(name).not.toContain('\\')
  })
})
