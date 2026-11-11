// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest'
import { measureLocalStorageUsage } from '../localStorageUsage'

const clear = () => {
  window.localStorage.clear()
}

afterEach(clear)

describe('measureLocalStorageUsage', () => {
  it('空存储返回全零', () => {
    const usage = measureLocalStorageUsage()
    expect(usage).toEqual({ totalBytes: 0, byPrefix: [], keyCount: 0 })
  })

  it('按 UTF-16 估算字节数（key + value 各 2 字节/字符）', () => {
    window.localStorage.setItem('a', '1234') // (1 + 4) * 2 = 10
    const usage = measureLocalStorageUsage()
    expect(usage.keyCount).toBe(1)
    expect(usage.totalBytes).toBe(10)
  })

  it('按「:」前的顶层前缀分桶，且降序', () => {
    window.localStorage.setItem('tjg:theme', 'dark') // 前缀 tjg
    window.localStorage.setItem('tjg:locale', 'zh-CN') // 前缀 tjg
    window.localStorage.setItem('guide', '1') // 前缀 guide（无冒号时取全键）

    const usage = measureLocalStorageUsage()
    expect(usage.byPrefix.map((x) => x.prefix)).toEqual(['tjg', 'guide'])
    const tjg = usage.byPrefix.find((x) => x.prefix === 'tjg')
    expect(tjg?.keys).toBe(2)
    // tjg 桶字节 = ('tjg:theme'+'dark')*2 + ('tjg:locale'+'zh-CN')*2
    expect(tjg?.bytes).toBe(('tjg:theme'.length + 4) * 2 + ('tjg:locale'.length + 5) * 2)
  })

  it('总额等于各桶之和', () => {
    window.localStorage.setItem('x:1', 'aa')
    window.localStorage.setItem('y:2', 'bbb')
    const usage = measureLocalStorageUsage()
    expect(usage.byPrefix.reduce((sum, bucket) => sum + bucket.bytes, 0)).toBe(usage.totalBytes)
  })
})
