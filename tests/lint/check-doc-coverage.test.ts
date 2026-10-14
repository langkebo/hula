import { describe, expect, it } from 'vitest'
import { hasJsDocAbove, stripJsDocNoise } from '../../scripts/check-doc-coverage.mjs'

/**
 * Treats the final line of `src` as the declaration and asks whether a valid
 * JSDoc block sits above it — mirrors how `scanFile` probes method lines.
 */
function documented(src: string): boolean {
  const lines = src.split('\n')
  return hasJsDocAbove(lines, lines.length - 1)
}

describe('check-doc-coverage: hasJsDocAbove 判据', () => {
  it('多行 JSDoc + 正文 -> 视为已文档化', () => {
    const src = ['/**', ' * 查询文件的 Tauri 命令', ' */', 'export function query() {}'].join('\n')
    expect(documented(src)).toBe(true)
  })

  it('单行 JSDoc + 正文 -> 视为已文档化', () => {
    expect(documented(['/** Summary */', 'export function f() {}'].join('\n'))).toBe(true)
  })

  it('JSDoc 与声明间有空行仍视为已文档化', () => {
    const src = ['/**', ' * Summary', ' */', '', '', 'export function f() {}'].join('\n')
    expect(documented(src)).toBe(true)
  })

  it('JSDoc 正文内出现 `/_matrix/**` 不被误判为注释开头', () => {
    const src = [
      '/**',
      ' * 把 dev 域名的 `/_matrix/**` 绝对 URL 改写到同源 Vite proxy。',
      ' *',
      ' * 导出给 `MatrixHttpClient` 复用。',
      ' */',
      'export function rewriteToDevProxyUrl(url: string): string {'
    ].join('\n')
    expect(documented(src)).toBe(true)
  })

  it('单行空 JSDoc `/** */` -> 未文档化', () => {
    expect(documented(['/** */', 'export function f() {}'].join('\n'))).toBe(false)
  })

  it('多行空 JSDoc（只有星号）-> 未文档化', () => {
    expect(documented(['/**', ' *', ' */', 'export function f() {}'].join('\n'))).toBe(false)
  })

  it('普通块注释 `/* ... */`（非 JSDoc）-> 未文档化', () => {
    expect(documented(['/* not a jsdoc */', 'export function f() {}'].join('\n'))).toBe(false)
    expect(documented(['/*', ' * not jsdoc', ' */', 'export function f() {}'].join('\n'))).toBe(false)
  })

  it('上方无注释（仅代码）-> 未文档化', () => {
    expect(documented(['const x = 1', 'export function f() {}'].join('\n'))).toBe(false)
    expect(documented('export function f() {}')).toBe(false)
  })
})

describe('check-doc-coverage: stripJsDocNoise', () => {
  it('剔除标记符与空白后保留正文文本', () => {
    expect(stripJsDocNoise('/**\n * Summary\n */')).toBe('Summary')
    expect(stripJsDocNoise('/**\n *\n */')).toBe('')
    expect(stripJsDocNoise(' Content ')).toBe('Content')
  })
})
