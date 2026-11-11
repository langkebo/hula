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

  it('曾登记的 XHR 债务已清偿（Batch 3.1）⇒ 同一份源码现在必须判违规', () => {
    const result = evaluateBypasses([
      {
        path: 'src/services/matrix/media/mediaUploadHelpers.ts',
        content: 'const xhr = new XMLHttpRequest()'
      }
    ])

    // Batch 3.1 已把该文件迁到 matrixHttpClient.uploadRaw，并清空了 xhr-bypass 白名单。
    // 若有人把 XHR 写回这里，必须判红 —— 而不是被历史白名单豁免。
    expect(result.violations).toHaveLength(1)
    expect(result.violations[0]).toMatchObject({
      file: 'src/services/matrix/media/mediaUploadHelpers.ts',
      ruleId: 'xhr-bypass'
    })
  })

  it('扫不到白名单文件 ⇒ 报 stale（提醒删条目）；xhr-bypass 侧已无条目故不参与', () => {
    const result = evaluateBypasses([{ path: 'src/App.vue', content: 'const x = 1' }])
    const staleFiles = result.staleAllowlist.map((s) => s.file)

    // 既有语义：raw-fetch 白名单里的文件本次一个都没扫到 ⇒ 全部报 stale
    expect(staleFiles.sort()).toEqual([...RULES['raw-fetch'].allowlist.keys()].sort())
    // Batch 3.1 之后 xhr-bypass 白名单为空 ⇒ 不可能再出现它的历史条目
    expect(staleFiles).not.toContain('src/services/matrix/media/mediaUploadHelpers.ts')
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

    // 基数断言：白名单只允许随债务清偿收缩（S8 workerProbeHandlers、O5 src/App.vue 均已清偿），
    // 这里锁住「仍然存在若干经批准的例外」，避免这个自洽测试在空列表上变成空转。
    expect(sources.length).toBeGreaterThanOrEqual(3)
    expect(result.violations).toEqual([])
    expect(result.staleAllowlist).toEqual([])
  })

  it('回归锁：xhr-bypass 白名单必须保持为空（Batch 3.1 已清偿，不许再加回豁免）', () => {
    // 这条锁的是「不许用加白名单的方式把 XHR 重新放行」：
    // 需要 XHR 的场景应走 matrixHttpClient.uploadRaw（MatrixRawUploadChannel）。
    expect(RULES['xhr-bypass'].allowlist.size).toBe(0)
  })
})
