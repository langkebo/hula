#!/usr/bin/env node
// biome-ignore-all lint/suspicious/noConsole: This CLI script intentionally writes results to the terminal.
/**
 * Guard: 禁止完全空的交互处理器与完全空的 catch 块。
 *
 * 问题（审计项 E-02）：可见入口绑定了空处理器（`@click=""`、`@click="() => {}"`），
 * 或失败路径写成完全空的 `catch {}`，导致「点了没反应」「失败了没有任何反馈」，
 * 且这类占位代码会长期滞留、不易被评审发现。
 *
 * 判据（本守卫收紧到「完全没有内容」）：
 *   1. `@click` / `@dblclick` / `@change` / `@submit` / `@confirm` / `@tap`（含 `v-on:` 写法）
 *      绑定为空字符串或空箭头函数 ⇒ 违规；
 *   2. `catch` 块内完全没有内容 ⇒ 违规。
 *
 * 刻意保留的 best-effort 失败路径（catch 内只有注释说明原因）不视为违规，
 * 这类 catch 属于有意为之，需要注释留痕而不是报错。
 *
 * Exit code：
 *   0  无空处理器/空 catch
 *   1  存在违规
 *   2  扫描异常（扫到的源文件数量低于基数断言）
 *
 * Usage:
 *   node scripts/check-dead-handlers.mjs
 *   node scripts/check-dead-handlers.mjs --json
 */

import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative, resolve, sep } from 'node:path'
import { fileURLToPath } from 'node:url'

const scriptDir = (() => {
  try {
    return fileURLToPath(new URL('.', import.meta.url))
  } catch {
    return process.cwd()
  }
})()
const repoRoot = resolve(scriptDir, '..')
const SOURCE_ROOT = 'src'
const SKIP_DIR = new Set(['node_modules', 'dist', 'coverage', '__tests__'])
const SCAN_EXT = new Set(['.vue', '.ts'])

const INTERACTIVE_EVENTS = 'click|dblclick|change|input|submit|confirm|tap|cancel|close'
const EMPTY_ATTR_PATTERN = new RegExp(`(?:@|v-on:)(${INTERACTIVE_EVENTS})\\s*=\\s*(["'])\\s*\\2`, 'g')
const EMPTY_ARROW_PATTERN = new RegExp(
  `(?:@|v-on:)(${INTERACTIVE_EVENTS})\\s*=\\s*"\\s*(?:\\(\\s*\\)\\s*=>\\s*\\{\\s*\\}|function\\s*\\(\\s*\\)\\s*\\{\\s*\\})\\s*"`,
  'g'
)

/**
 * 纯函数：找出完全空的 catch 块。
 * 仅含注释的 catch 属于刻意的 best-effort 失败路径（需注释说明原因），不视为违规。
 *
 * @param {string} source
 * @returns {Array<{line: number, snippet: string}>}
 */
export function findEmptyCatchBlocks(source) {
  const violations = []
  const text = String(source ?? '')
  const catchPattern = /\bcatch\b/g
  let match
  while ((match = catchPattern.exec(text)) !== null) {
    let cursor = match.index + match[0].length
    while (cursor < text.length && /\s/.test(text[cursor])) cursor++
    // 跳过可选异常参数 `catch (err)`
    if (text[cursor] === '(') {
      let depth = 0
      while (cursor < text.length) {
        if (text[cursor] === '(') depth++
        else if (text[cursor] === ')') {
          depth--
          if (depth === 0) {
            cursor++
            break
          }
        }
        cursor++
      }
      while (cursor < text.length && /\s/.test(text[cursor])) cursor++
    }
    if (text[cursor] !== '{') continue
    const open = cursor
    let depth = 0
    let end = open
    let quote = null
    for (; end < text.length; end++) {
      const ch = text[end]
      if (quote) {
        if (ch === '\\') {
          end++
          continue
        }
        if (ch === quote) quote = null
        continue
      }
      if (ch === '"' || ch === "'" || ch === '`') {
        quote = ch
        continue
      }
      if (ch === '{') depth++
      else if (ch === '}') {
        depth--
        if (depth === 0) break
      }
    }
    const inner = text.slice(open + 1, end)
    // 只有「完全没有内容」才算违规；仅含注释的 catch 是刻意的 best-effort 留痕
    if (inner.trim() === '') {
      const line = text.slice(0, match.index).split('\n').length
      violations.push({
        line,
        snippet: text.slice(match.index, Math.min(end + 1, match.index + 80)).replace(/\s+/g, ' ')
      })
    }
    catchPattern.lastIndex = end
  }
  return violations
}

/**
 * 纯函数：找出空的交互事件绑定。
 *
 * @param {string} source
 * @returns {Array<{line: number, snippet: string}>}
 */
export function findEmptyHandlers(source) {
  const text = String(source ?? '')
  const violations = []
  for (const pattern of [EMPTY_ATTR_PATTERN, EMPTY_ARROW_PATTERN]) {
    pattern.lastIndex = 0
    let match
    while ((match = pattern.exec(text)) !== null) {
      const line = text.slice(0, match.index).split('\n').length
      violations.push({ line, snippet: match[0].replace(/\s+/g, ' ') })
    }
  }
  return violations.sort((a, b) => a.line - b.line)
}

/**
 * 纯函数：收集单个文件的全部违规。
 *
 * @param {string} content
 * @param {string} file
 * @returns {Array<{file: string, line: number, kind: string, snippet: string}>}
 */
export function collectViolations(content, file) {
  return [
    ...findEmptyHandlers(content).map((v) => ({ file, ...v, kind: 'empty-handler' })),
    ...findEmptyCatchBlocks(content).map((v) => ({ file, ...v, kind: 'empty-catch' }))
  ]
}

function walk(dir, out = []) {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry)
    let st
    try {
      st = statSync(full)
    } catch {
      continue
    }
    if (st.isDirectory()) {
      if (SKIP_DIR.has(entry)) continue
      walk(full, out)
    } else if (SCAN_EXT.has(entry.slice(entry.lastIndexOf('.')))) {
      out.push(full)
    }
  }
  return out
}

function main() {
  const emitJson = process.argv.includes('--json')
  const files = walk(resolve(repoRoot, SOURCE_ROOT))

  // 基数断言：必须真的扫到一批源文件，避免路径错导致「0 违规」假绿
  if (files.length < 1000) {
    console.error(`[dead-handlers] scan failed: 仅扫到 ${files.length} 个源文件（基数断言 <1000）`)
    process.exit(2)
  }

  const violations = []
  for (const file of files) {
    const rel = relative(repoRoot, file).split(sep).join('/')
    violations.push(...collectViolations(readFileSync(file, 'utf8'), rel))
  }

  if (emitJson) {
    process.stdout.write(`${JSON.stringify({ scanned: files.length, violations }, null, 2)}\n`)
  } else if (violations.length === 0) {
    console.log(`[dead-handlers] OK — 扫描 ${files.length} 个源文件，未发现空处理器与空 catch`)
  } else {
    console.error(`[dead-handlers] FAIL — ${violations.length} 处空处理器/空 catch:`)
    for (const v of violations) {
      console.error(`  ${v.file}:${v.line}  [${v.kind}] ${v.snippet}`)
    }
    console.error('    → 可见入口必须接线到真实行为；失败路径必须给出用户反馈或注释说明 best-effort 原因')
  }

  process.exit(violations.length === 0 ? 0 : 1)
}

const isDirectRun = (() => {
  try {
    return process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)
  } catch {
    return false
  }
})()

if (isDirectRun) {
  main()
}
