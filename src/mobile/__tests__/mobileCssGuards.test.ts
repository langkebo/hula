import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const ROOT = join(process.cwd(), 'src/mobile')

function collect(dir: string, acc: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry)
    if (statSync(full).isDirectory()) {
      collect(full, acc)
    } else if (entry.endsWith('.vue')) {
      acc.push(full)
    }
  }
  return acc
}

describe('mobile css guards', () => {
  const files = collect(ROOT)

  it('不使用缺运算符的 calc 嵌套', () => {
    const offenders = files.filter((file) => readFileSync(file, 'utf8').includes('calc(100vh_-_calc('))
    expect(offenders).toEqual([])
  })

  it('不使用不存在的 l-0 工具类', () => {
    const offenders = files.filter((file) => /\bl-0\b/.test(readFileSync(file, 'utf8')))
    expect(offenders).toEqual([])
  })
})
