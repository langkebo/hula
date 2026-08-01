/**
 * CSS 命名规范 lint 守卫
 *
 * 对应 docs/ui/optimization-plan.md §十二.2 可选项：
 * 禁止在 src/ 中使用旧别名，强制统一 --hula-* 命名空间。
 *
 * 守卫规则：
 * 1. 禁止 var(--color-primary)（旧全局别名）— 应使用 var(--hula-color-primary-500)
 *    例外：design-tokens.css 中的 --color-primary 定义本身（不是 var() 引用）不受此规则约束
 * 2. 禁止 --fgColor-accent（组件本地别名）— 应使用 var(--hula-color-primary-500)
 *
 * wave2-visual-consistency.test.ts 仅覆盖 ThreadPanel.vue 和 Bot.vue 两个文件，
 * 本测试扫描全部 src/ 目录，提供全量守卫。
 */

import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative, resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const ROOT = resolve(__dirname, '..', '..', '..', '..')
const SRC_DIR = resolve(ROOT, 'src')

const SCANNABLE_EXTENSIONS = new Set(['.vue', '.ts', '.css', '.scss'])
const TEST_FILE_PATTERNS = [/\.test\.ts$/, /\.spec\.ts$/, /__tests__\//]

function isScannable(filePath: string): boolean {
  const ext = filePath.slice(filePath.lastIndexOf('.'))
  if (!SCANNABLE_EXTENSIONS.has(ext)) return false
  // 排除测试文件（测试描述中可能包含被禁模式字符串）
  return !TEST_FILE_PATTERNS.some((p) => p.test(filePath))
}

function walkDir(dir: string): string[] {
  const results: string[] = []
  for (const entry of readdirSync(dir)) {
    const fullPath = join(dir, entry)
    const stat = statSync(fullPath)
    if (stat.isDirectory()) {
      results.push(...walkDir(fullPath))
    } else if (isScannable(fullPath)) {
      results.push(fullPath)
    }
  }
  return results
}

function collectViolations(pattern: RegExp): { file: string; line: number; text: string }[] {
  const files = walkDir(SRC_DIR)
  const violations: { file: string; line: number; text: string }[] = []

  for (const file of files) {
    const source = readFileSync(file, 'utf-8')
    const lines = source.split('\n')
    for (let i = 0; i < lines.length; i++) {
      if (pattern.test(lines[i])) {
        violations.push({
          file: relative(ROOT, file),
          line: i + 1,
          text: lines[i].trim()
        })
      }
    }
  }

  return violations
}

describe('CSS 命名规范 lint 守卫', () => {
  describe('禁止 var(--color-primary) 旧别名引用', () => {
    // 匹配 var(--color-primary) 或 var(--color-primary, fallback)
    // 不匹配 var(--hula-color-primary-500) — 因为 --hula- 前缀阻断了匹配
    const LEGACY_VAR_PATTERN = /var\(--color-primary(?![\w-])/

    it('src/ 中不应使用 var(--color-primary) 旧别名', () => {
      const violations = collectViolations(LEGACY_VAR_PATTERN)
      expect(
        violations,
        `发现 ${violations.length} 处 var(--color-primary) 旧别名引用，应改为 var(--hula-color-primary-500)\n${violations.map((v) => `  ${v.file}:${v.line}`).join('\n')}`
      ).toEqual([])
    })
  })

  describe('禁止 --fgColor-accent 组件本地别名', () => {
    const LOCAL_ALIAS_PATTERN = /--fgColor-accent/

    it('src/ 中不应定义或使用 --fgColor-accent', () => {
      const violations = collectViolations(LOCAL_ALIAS_PATTERN)
      expect(
        violations,
        `发现 ${violations.length} 处 --fgColor-accent，应改为 var(--hula-color-primary-500)\n${violations.map((v) => `  ${v.file}:${v.line}`).join('\n')}`
      ).toEqual([])
    })
  })
})
