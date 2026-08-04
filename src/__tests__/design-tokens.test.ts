/**
 * Design Tokens 完整性守卫
 *
 * 验证 design-tokens.css 中所有被引用的 token 都有定义，
 * 防止未定义变量导致渲染异常（如 fallback 误用蓝色而非品牌绿）。
 *
 * 对应重构优化方案 P0 任务 2.1.1-2.1.3
 */

import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join, relative, resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const ROOT = resolve(__dirname, '..', '..')
const SRC_DIR = resolve(ROOT, 'src')
const TOKENS_FILE = resolve(SRC_DIR, 'styles', 'css', 'design-tokens.css')

const SCANNABLE_EXTENSIONS = new Set(['.vue', '.ts', '.css', '.scss'])
const TEST_FILE_PATTERNS = [/\.test\.ts$/, /\.spec\.ts$/, /__tests__\//]

function isScannable(filePath: string): boolean {
  const ext = filePath.slice(filePath.lastIndexOf('.'))
  if (!SCANNABLE_EXTENSIONS.has(ext)) return false
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

describe('Design Tokens 完整性守卫', () => {
  const tokensContent = readFileSync(TOKENS_FILE, 'utf-8')

  describe('2.1.1 — -50 色阶定义存在', () => {
    it('design-tokens.css 应定义 --tjg-color-primary-50', () => {
      expect(
        tokensContent,
        '--tjg-color-primary-50 未在 design-tokens.css 中定义，导致 fallback 误用蓝色 #3b82f6'
      ).toContain('--tjg-color-primary-50:')
    })

    it('design-tokens.css 应定义 --tjg-color-danger-50', () => {
      expect(
        tokensContent,
        '--tjg-color-danger-50 未在 design-tokens.css 中定义'
      ).toContain('--tjg-color-danger-50:')
    })
  })

  describe('2.1.2 — 禁止未定义的裸变量引用', () => {
    it('src/ 中不应引用未定义的 var(--tjg-surface-panel-muted)', () => {
      const violations = collectViolations(/var\(--bg-secondary(?![\w-])/)
      expect(
        violations,
        `发现 ${violations.length} 处未定义的 var(--tjg-surface-panel-muted)，应改为 var(--tjg-surface-panel-muted)\n${violations.map((v) => `  ${v.file}:${v.line}`).join('\n')}`
      ).toEqual([])
    })

    it('src/ 中不应引用未定义的 var(--tjg-surface-app)', () => {
      const violations = collectViolations(/var\(--bg-main(?![\w-])/)
      expect(
        violations,
        `发现 ${violations.length} 处未定义的 var(--tjg-surface-app)，应改为 var(--tjg-surface-app)\n${violations.map((v) => `  ${v.file}:${v.line}`).join('\n')}`
      ).toEqual([])
    })

    it('src/ 中不应引用未定义的 var(--primary-color-rgb)', () => {
      const violations = collectViolations(/var\(--primary-color-rgb(?![\w-])/)
      expect(
        violations,
        `发现 ${violations.length} 处未定义的 var(--primary-color-rgb)\n${violations.map((v) => `  ${v.file}:${v.line}`).join('\n')}`
      ).toEqual([])
    })
  })

  describe('2.1.3 — 其他未定义 token 应有定义或替换', () => {
    it('design-tokens.css 应定义 --tjg-fill-default 或 src/ 中不应引用它', () => {
      const isDefined = tokensContent.includes('--tjg-fill-default')
      const violations = collectViolations(/var\(--tjg-fill-default(?![\w-])/)
      expect(
        isDefined || violations.length === 0,
        `--tjg-fill-default 既未定义也未被清除，${violations.length} 处引用悬空\n${violations.map((v) => `  ${v.file}:${v.line}`).join('\n')}`
      ).toBe(true)
    })

    it('design-tokens.css 应定义 --tjg-surface-input 或 src/ 中不应引用它', () => {
      const isDefined = tokensContent.includes('--tjg-surface-input')
      const violations = collectViolations(/var\(--tjg-surface-input(?![\w-])/)
      expect(
        isDefined || violations.length === 0,
        `--tjg-surface-input 既未定义也未被清除，${violations.length} 处引用悬空\n${violations.map((v) => `  ${v.file}:${v.line}`).join('\n')}`
      ).toBe(true)
    })

    it('design-tokens.css 应定义 --tjg-color-success-bg 或 src/ 中不应引用它', () => {
      const isDefined = tokensContent.includes('--tjg-color-success-bg')
      const violations = collectViolations(/var\(--tjg-color-success-bg(?![\w-])/)
      expect(
        isDefined || violations.length === 0,
        `--tjg-color-success-bg 既未定义也未被清除，${violations.length} 处引用悬空\n${violations.map((v) => `  ${v.file}:${v.line}`).join('\n')}`
      ).toBe(true)
    })

    it('design-tokens.css 应定义 --tjg-color-warning-bg 或 src/ 中不应引用它', () => {
      const isDefined = tokensContent.includes('--tjg-color-warning-bg')
      const violations = collectViolations(/var\(--tjg-color-warning-bg(?![\w-])/)
      expect(
        isDefined || violations.length === 0,
        `--tjg-color-warning-bg 既未定义也未被清除，${violations.length} 处引用悬空\n${violations.map((v) => `  ${v.file}:${v.line}`).join('\n')}`
      ).toBe(true)
    })
  })

  describe('2.1.4 — 禁止蓝色 fallback 污染品牌色', () => {
    it('src/ 中不应在 --tjg-color-primary-50 引用中使用蓝色 fallback rgba(59, 130, 246, ...)', () => {
      const violations = collectViolations(/--tjg-color-primary-50.*rgba\(59,\s*130,\s*246/)
      expect(
        violations,
        `发现 ${violations.length} 处 --tjg-color-primary-50 使用蓝色 fallback（#3b82f6），品牌色应为 #13987f\n${violations.map((v) => `  ${v.file}:${v.line}`).join('\n')}`
      ).toEqual([])
    })

    it('src/ 中不应在 --tjg-color-danger-50 引用中使用错误的红色 fallback', () => {
      const violations = collectViolations(/--tjg-color-danger-50.*rgba\(239,\s*68,\s*68/)
      expect(
        violations,
        `发现 ${violations.length} 处 --tjg-color-danger-50 使用错误 fallback\n${violations.map((v) => `  ${v.file}:${v.line}`).join('\n')}`
      ).toEqual([])
    })
  })
})

  describe('2.1.4 — 禁止硬编码品牌绿色（#13987f / rgba(19,152,127) / rgba(29,163,134)）', () => {
    // 排除：design-tokens.css（权威来源）、NaiveProvider.vue（JS 主题配置）、Console.ts（console.log 不支持 CSS 变量）、测试文件
    const EXCLUDE_FILES = ['design-tokens.css', 'NaiveProvider.vue', 'Console.ts']
    const BRAND_GREEN_PATTERNS = [
      /#13987f/i,
      /rgba?\(\s*19\s*,\s*152\s*,\s*127/,
      /rgba?\(\s*29\s*,\s*163\s*,\s*134/,
    ]

    it('src/ 的 .vue/.scss/.css 文件中不应硬编码品牌绿色', () => {
      const files = walkDir(SRC_DIR).filter(
        (f) => !EXCLUDE_FILES.some((ex) => f.endsWith(ex)) && !TEST_FILE_PATTERNS.some((p) => p.test(f))
      )
      const violations: { file: string; line: number; text: string }[] = []

      for (const file of files) {
        const source = readFileSync(file, 'utf-8')
        const lines = source.split('\n')
        for (let i = 0; i < lines.length; i++) {
          if (BRAND_GREEN_PATTERNS.some((p) => p.test(lines[i]))) {
            violations.push({
              file: relative(ROOT, file),
              line: i + 1,
              text: lines[i].trim(),
            })
          }
        }
      }

      expect(
        violations,
        `发现 ${violations.length} 处硬编码品牌绿色，应改用 --tjg-color-primary-* token\n${violations.map((v) => `  ${v.file}:${v.line}`).join('\n')}`
      ).toEqual([])
    })
  })
