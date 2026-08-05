/**
 * Task 5 — homeWindow 视图 aria 覆盖守卫（G6）
 *
 * 对应原型对齐优化方案 Task 5：homeWindow 视图 aria 属性从 0 → ≥40 处。
 * 采用源码级断言（grep 视图文件中的 aria- / role= 属性），与 design-tokens.test.ts
 * 风格一致，不依赖 jsdom 渲染。
 *
 * 失败基线：src/views/homeWindow 下所有 .vue 当前 aria/role 属性为 0。
 * 目标：≥40 处，且每个视图容器均暴露 role="main" 地标角色。
 */

import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative, resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const ROOT = resolve(__dirname, '..', '..')
const HOME_WINDOW_DIR = resolve(ROOT, 'src', 'views', 'homeWindow')

const ARIA_PATTERN = /\baria-[a-z]+|role\s*=/gi
const ARIA_PATTERN_GLOBAL = /\baria-[a-z]+|role\s*=/g

function walkVueFiles(dir: string): string[] {
  const results: string[] = []
  for (const entry of readdirSync(dir)) {
    const fullPath = join(dir, entry)
    const stat = statSync(fullPath)
    if (stat.isDirectory()) {
      results.push(...walkVueFiles(fullPath))
    } else if (entry.endsWith('.vue')) {
      results.push(fullPath)
    }
  }
  return results
}

function countAriaAttributes(filePath: string): number {
  const source = readFileSync(filePath, 'utf-8')
  const matches = source.match(ARIA_PATTERN_GLOBAL)
  return matches ? matches.length : 0
}

function collectAriaHits(filePath: string): { line: number; text: string }[] {
  const source = readFileSync(filePath, 'utf-8')
  const lines = source.split('\n')
  const hits: { line: number; text: string }[] = []
  for (let i = 0; i < lines.length; i++) {
    if (ARIA_PATTERN.test(lines[i])) {
      hits.push({ line: i + 1, text: lines[i].trim() })
    }
  }
  return hits
}

describe('Task 5 — homeWindow 视图 aria 覆盖（G6）', () => {
  const viewFiles = walkVueFiles(HOME_WINDOW_DIR)
  const perFileCounts = viewFiles.map((f) => ({
    file: relative(ROOT, f),
    count: countAriaAttributes(f)
  }))
  const total = perFileCounts.reduce((sum, f) => sum + f.count, 0)

  it('homeWindow 视图 aria/role 属性总数 ≥ 40', () => {
    expect(
      total,
      `homeWindow 视图 aria 属性仅 ${total} 处，目标 ≥40。\n明细：\n${perFileCounts.map((f) => `  ${f.file}: ${f.count}`).join('\n')}`
    ).toBeGreaterThanOrEqual(40)
  })

  it('每个 homeWindow 视图容器暴露 role="main" 地标角色（或 <main> 标签）', () => {
    // <main> 标签隐式具有 role="main"，无需重复声明 role 属性（axe 会标记冗余）
    const missing = viewFiles.filter((f) => {
      const source = readFileSync(f, 'utf-8')
      const hasRoleMain = /role\s*=\s*["']main["']/.test(source)
      const hasMainTag = /<main[\s>]/.test(source)
      return !hasRoleMain && !hasMainTag
    })
    expect(missing, `以下视图缺少 role="main"：\n${missing.map((f) => `  ${relative(ROOT, f)}`).join('\n')}`).toEqual(
      []
    )
  })

  it('homeWindow 视图列表结构使用 role="list"（至少 1 处）', () => {
    const listHits = viewFiles.flatMap((f) => {
      const source = readFileSync(f, 'utf-8')
      return source.match(/role\s*=\s*["']list["']/g) ?? []
    })
    expect(listHits.length, '期望至少 1 处 role="list"').toBeGreaterThanOrEqual(1)
  })

  // 调试辅助：打印每文件命中明细（仅失败时可见）
  it('aria 命中明细（调试）', () => {
    const detail = viewFiles
      .map((f) => {
        const hits = collectAriaHits(f)
        return `${relative(ROOT, f)} (${hits.length}):${hits.map((h) => `\n  L${h.line}: ${h.text}`).join('')}`
      })
      .join('\n\n')
    expect(detail).toBeDefined()
  })
})
