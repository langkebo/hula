#!/usr/bin/env node
// biome-ignore-all lint/suspicious/noConsole: This CLI script intentionally writes results to the terminal.
/**
 * Guard: 仅图标按钮必须有无障碍名称。
 *
 * 问题：桌面端大量操作按钮只渲染一个 `<svg>` / `<n-icon>`（关闭、更多、返回、刷新等），
 * 视觉上依赖 title 或位置提示，屏幕阅读器读不到任何名称；`title` 属性在部分辅助技术下
 * 也不作为可访问名称的可靠来源。审计项 V-05 要求批量补 `aria-label` 并建立守门，
 * 防止新增图标按钮再次漏掉名称。
 *
 * 判据（本守卫）：
 *   1. `<button>` / `<n-button>` 内部去除图标（svg / n-icon / use / img / template#icon）与注释后
 *      没有任何文本节点（文本、`{{ }}`、slot 内容都算文本）⇒ 视为「仅图标按钮」；
 *   2. 仅图标按钮必须带 `aria-label` 或 `aria-labelledby`，否则违规；
 *   3. 无文本但带 `aria-hidden="true"` 的按钮视为刻意隐藏（如遮罩点击层），跳过。
 *
 * Exit code：
 *   0  全部仅图标按钮都有无障碍名称
 *   1  存在缺少名称的仅图标按钮
 *   2  扫描异常（扫到的 .vue 文件数量低于基数断言）
 *
 * Usage:
 *   node scripts/check-icon-button-aria.mjs
 *   node scripts/check-icon-button-aria.mjs --json
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
const BUTTON_PATTERN = /<(button|n-button)\b([^>]*)>([\s\S]*?)<\/\1>/g

/**
 * 纯函数：把按钮内部内容裁剪成「是否还有可读文本」。
 * 图标元素被移除后仍残留文本 ⇒ 不是仅图标按钮。
 *
 * @param {string} inner
 * @returns {string}
 */
export function stripIcons(inner) {
  return String(inner ?? '')
    .replace(/<template\s+#icon[\s\S]*?<\/template>/g, '')
    .replace(/<svg\b[\s\S]*?<\/svg>/g, '')
    .replace(/<n-icon\b[\s\S]*?<\/n-icon>/g, '')
    .replace(/<use\b[^>]*\/?>/g, '')
    .replace(/<img\b[^>]*\/?>/g, '')
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/\s+/g, '')
}

/**
 * 纯函数：扫描一段 .vue 文本，返回缺少无障碍名称的仅图标按钮。
 *
 * @param {string} content
 * @param {string} file
 * @returns {Array<{file: string, line: number, tag: string}>}
 */
export function collectViolations(content, file) {
  const violations = []
  const source = String(content ?? '')
  BUTTON_PATTERN.lastIndex = 0
  let match
  while ((match = BUTTON_PATTERN.exec(source)) !== null) {
    const [, tag, attrs, inner] = match
    if (/aria-label|aria-labelledby/.test(attrs)) continue
    if (/aria-hidden\s*=\s*["']true["']/.test(attrs)) continue
    if (stripIcons(inner).length > 0) continue
    const line = source.slice(0, match.index).split('\n').length
    violations.push({ file, line, tag: `<${tag} ${attrs.trim().slice(0, 120)}>` })
  }
  return violations
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
    } else if (entry.endsWith('.vue')) {
      out.push(full)
    }
  }
  return out
}

function main() {
  const emitJson = process.argv.includes('--json')
  const files = walk(resolve(repoRoot, SOURCE_ROOT))

  // 基数断言：必须真的扫到一批组件，避免路径错导致「0 违规」假绿
  if (files.length < 500) {
    console.error(`[icon-button-aria] scan failed: 仅扫到 ${files.length} 个 .vue 文件（基数断言 <500）`)
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
    console.log(`[icon-button-aria] OK — 扫描 ${files.length} 个 .vue 文件，仅图标按钮均有无障碍名称`)
  } else {
    console.error(`[icon-button-aria] FAIL — ${violations.length} 个仅图标按钮缺少 aria-label/aria-labelledby:`)
    for (const v of violations) {
      console.error(`  ${v.file}:${v.line}  ${v.tag}`)
    }
    console.error('    → 图标按钮必须补 :aria-label="t(\'...\')"（或 aria-labelledby 指向可见标签）')
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
