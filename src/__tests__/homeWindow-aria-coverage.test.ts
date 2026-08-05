/**
 * Task 5 — homeWindow 视图 aria 覆盖守卫（G6）
 *
 * 对应原型对齐优化方案 Task 5：homeWindow 视图 aria 属性从 0 → ≥40 处。
 * 采用源码级断言（grep 视图文件中的 aria- / role= 属性），与 design-tokens.test.ts
 * 风格一致。
 *
 * jsdom 渲染不可行说明：homeWindow 视图组件依赖 Naive UI n-modal/n-list 等组件树、
 * Tauri WebviewWindow / getCurrentWebviewWindow 等运行时 API、以及 Matrix session store
 * (Pinia)。在 jsdom 中挂载这些组件需要 mock 完整 Tauri bridge、Vue Router 嵌套路由和
 * Matrix 客户端，mock 体量远超测试价值。因此本文件采用源码级 grep 守卫作为快速回归门；
 * 渲染级 aria 覆盖由 e2e/a11y-baseline.spec.ts 的 axe-core 扫描覆盖（Task 5 C1/C2）。
 *
 * 失败基线：src/views/homeWindow 下所有 .vue 当前 aria/role 属性为 0。
 * 目标：≥40 处有效属性（不含 aria-label="" 硬编码空值），且每个视图容器均暴露
 * role="main" 地标角色。
 */

import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative, resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const ROOT = resolve(__dirname, '..', '..')
const HOME_WINDOW_DIR = resolve(ROOT, 'src', 'views', 'homeWindow')

const ARIA_PATTERN_GLOBAL = /\baria-[a-z]+|role\s*=/g
const EMPTY_ARIA_LABEL = /aria-label\s*=\s*""/g

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
  const raw = matches ? matches.length : 0
  // 过滤 aria-label="" 字面量空值（不提供辅助信息）
  const emptyLabelMatches = source.match(EMPTY_ARIA_LABEL)
  const empty = emptyLabelMatches ? emptyLabelMatches.length : 0
  return raw - empty
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
})
