import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { evaluateBypasses, isExcludedSource, RULES, scanSourceText } from '../../scripts/check-no-raw-fetch.mjs'

/**
 * 守卫单测：`check-no-raw-fetch`。
 *
 * 关键点（图谱 §8 ⑪）：XHR 旁路原先**完全在守卫视野之外** —— 正则只认 `fetch(`，
 * 而 `mediaUploadHelpers.ts` 用 `XMLHttpRequest` 直连 media/upload。本测试锁住
 * 「XHR 必须被看见」这一行为，避免扩展被回退。
 */

describe('check-no-raw-fetch: scanSourceText', () => {
  it('识别 fetch( 与 new XMLHttpRequest(，并给出 1-based 行号', () => {
    const text = ["await fetch('/x')", 'const req = new XMLHttpRequest()', 'myFetch()'].join('\n')

    const found = scanSourceText(text)

    expect(found['raw-fetch']).toEqual([1])
    expect(found['xhr-bypass']).toEqual([2])
  })

  it('自定义函数名（myFetch）不算裸 fetch', () => {
    expect(scanSourceText('myFetch()')['raw-fetch']).toEqual([])
  })

  it('测试/生成物路径被排除', () => {
    expect(isExcludedSource('src/a/b.test.ts')).toBe(true)
    expect(isExcludedSource('src/a/b.spec.ts')).toBe(true)
    expect(isExcludedSource('src/services/matrix/media/mediaUploadHelpers.ts')).toBe(false)
  })
})

describe('check-no-raw-fetch: evaluateBypasses（合成源码）', () => {
  it('白名单外的 XHR ⇒ 违规（扩展前此文件对守卫完全不可见）', () => {
    const result = evaluateBypasses([
      { path: 'src/services/matrix/whatever.ts', content: 'const x = new XMLHttpRequest()' }
    ])

    expect(result.violations).toHaveLength(1)
    expect(result.violations[0]).toMatchObject({ file: 'src/services/matrix/whatever.ts', ruleId: 'xhr-bypass' })
  })

  it('已登记的 XHR 债务（mediaUploadHelpers）⇒ 不违规但可见', () => {
    const result = evaluateBypasses([
      {
        path: 'src/services/matrix/media/mediaUploadHelpers.ts',
        content: 'const xhr = new XMLHttpRequest()'
      }
    ])

    expect(result.violations).toEqual([])
    expect(result.findings[0]).toMatchObject({ ruleId: 'xhr-bypass', approved: true })
  })

  it('白名单条目不再命中 ⇒ 报 stale（提醒迁移完成后删除条目）', () => {
    const result = evaluateBypasses([{ path: 'src/App.vue', content: 'const x = 1' }])

    const stale = result.staleAllowlist.map((s) => s.file)
    expect(stale).toContain('src/services/matrix/media/mediaUploadHelpers.ts')
  })

  it('两条规则各自独立判定（fetch 白名单不豁免 XHR）', () => {
    const result = evaluateBypasses([
      { path: 'src/services/matrix/network/runtimeFetch.ts', content: 'fetch("/x")\nnew XMLHttpRequest()' }
    ])

    // runtimeFetch.ts 在 raw-fetch 白名单里，但不在 xhr-bypass 白名单里
    expect(result.violations).toHaveLength(1)
    expect(result.violations[0].ruleId).toBe('xhr-bypass')
  })

  it('空输入不抛错、violations 为空（调用方靠基数断言拦「空扫」）', () => {
    const result = evaluateBypasses([])
    expect(result.violations).toEqual([])
    expect(result.scannedFiles).toBe(0)
  })
})

describe('check-no-raw-fetch: 真实仓库自洽', () => {
  const repoRoot = join(__dirname, '..', '..')

  it('白名单账实相符（无未登记裸请求，也无 stale 条目）', () => {
    const sources = [...RULES['raw-fetch'].allowlist.keys(), ...RULES['xhr-bypass'].allowlist.keys()].map((rel) => ({
      path: rel,
      content: readFileSync(join(repoRoot, rel), 'utf8')
    }))

    const result = evaluateBypasses(sources)

    expect(sources.length).toBeGreaterThanOrEqual(5)
    expect(result.violations).toEqual([])
    expect(result.staleAllowlist).toEqual([])
  })

  it('回归锁：XHR 债务条目带 TODO 且指向优化方案（迁完必须删）', () => {
    const entry = RULES['xhr-bypass'].allowlist.get('src/services/matrix/media/mediaUploadHelpers.ts')
    expect(entry).toBeTruthy()
    expect(entry).toContain('TODO(Batch 3.1)')
  })
})
