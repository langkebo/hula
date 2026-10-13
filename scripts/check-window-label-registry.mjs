#!/usr/bin/env node
// biome-ignore-all lint/suspicious/noConsole: This CLI script intentionally writes progress to the terminal.
/**
 * Guard: 窗口 label 必须"有归属"。
 *
 * 问题（图谱 §8.5 B1）：窗口 label 有两个来源 —— `src-tauri/tauri.*.conf.json` 的静态声明，
 * 以及源码里 9 处运行时创建（`new WebviewWindow(...)` / `createWebviewWindow(...)` /
 * Rust `WebviewWindowBuilder::new(app, "<label>", ...)`），外加 1 处动态前缀
 * （`WINDOW_LABEL_PREFIX = 'windowChat--'`）。而 `App.vue` 只按
 * `NON_MATRIX_WINDOW_LABELS` 决定是否跳过 4 项 Matrix 运行时初始化 ⇒ **新增窗口忘记分类时，
 * 会静默多跑一套离线队列 / WebSocket 事件 / 在线状态 / 邀请策略，且没有任何红灯**。
 *
 * 判据（本守卫）：
 *   1. 静态收集到的每个 label 必须出现在 `MATRIX_WINDOW_LABELS`（会跑运行时）或
 *      `NON_MATRIX_WINDOW_LABELS`（跳过运行时）之一；两者都无 ⇒ 违规；
 *   2. 同一 label 不得同时出现在两个名单（互斥）；
 *   3. 每个动态前缀（`xxx--`）必须有以该前缀开头的登记项；
 *   4. 登记项不再被任何静态来源命中 ⇒ 仅**提示**（window 可能已删除，不阻断并行改动）。
 *
 * 名单的唯一来源是 `src/utils/windowLabels.ts`（本脚本按文本解析它的两个 Set 字面量，
 * 以免在 Node 侧加载 TS）。
 *
 * Exit code:
 *   0  全部 label 已分类
 *   1  存在未分类/互斥/前缀未登记
 *   2  环境或自检异常（读不到 windowLabels.ts、扫不到任何 label —— 基数断言）
 *
 * Usage:
 *   node scripts/check-window-label-registry.mjs
 *   node scripts/check-window-label-registry.mjs --json
 */

import { readdirSync, readFileSync, statSync, existsSync } from 'node:fs'
import { join, resolve, relative, sep } from 'node:path'
import { fileURLToPath } from 'node:url'

const scriptDir = (() => {
  try {
    return fileURLToPath(new URL('.', import.meta.url))
  } catch {
    return process.cwd()
  }
})()
const repoRoot = resolve(scriptDir, '..')

export const WINDOW_LABELS_FILE = 'src/utils/windowLabels.ts'
export const TAURI_CONF_GLOB_PREFIX = 'src-tauri/tauri'
export const SOURCE_ROOTS = ['src', 'src-tauri/src']
const SOURCE_EXT = /\.(ts|tsx|vue|rs)$/
const SKIP_DIR = new Set(['node_modules', 'dist', 'coverage', '__tests__'])

/** 动态前缀：`WINDOW_LABEL_PREFIX = 'windowChat--'` 这类 |
 * 前缀必须以 `--` 结尾，登记表用同样的前缀条目承接。 */
export const PREFIX_PATTERN = /(?:WINDOW_LABEL_PREFIX|LABEL_PREFIX)\s*=\s*[`'"]([^`'"$]+)/g
/** 静态创建点：#1 TS 前端 */
export const TS_CREATE_PATTERNS = [
  /new\s+WebviewWindow\(\s*[`'"]([^`'"$]+)/g,
  /createWebviewWindow\(\s*[^,]+,\s*[`'"]([^`'"$]+)/g,
  // tauri.*.conf.json 的静态声明（collectLabels 收到的是规范化后的 `windowLabel:"x"`）
  /windowLabel\s*:\s*["']([^"'$]+)["']/g
]
/** 静态创建点：#2 Rust 侧 */
export const RUST_CREATE_PATTERNS = [/(?:WebviewWindowBuilder|WebviewBuilder|WindowBuilder)::new\(\s*[^,]+,\s*"([^"$]+)"/g]

/**
 * 纯函数：从 `windowLabels.ts` 文本里解析两个 Set 的成员。
 *
 * @param {string} text
 * @returns {{ matrix: string[], nonMatrix: string[] }}
 */
export function parseRegistries(text) {
  // 先去掉注释：否则注释里的示例字符串（如 `'windowChat--${roomId}'`）会被当成登记项 ——
  // 实测踩过（stale 列表里出现 'windowChat--${roomId}' / '可跳过'）。
  const stripped = String(text ?? '')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/\/\/[^\n]*/g, '')
  const pick = (name) => {
    const re = new RegExp(`export\\s+const\\s+${name}\\s*=\\s*new\\s+Set\\(\\[([\\s\\S]*?)\\]\\)`)
    const match = re.exec(stripped)
    if (!match) return []
    return [...match[1].matchAll(/['"`]([^'"`]+)['"`]/g)].map((m) => m[1])
  }
  return { matrix: pick('MATRIX_WINDOW_LABELS'), nonMatrix: pick('NON_MATRIX_WINDOW_LABELS') }
}

/**
 * 纯函数：从一批源码文本里收集静态 label 与动态前缀。
 *
 * @param {Array<{path: string, content: string}>} sources
 * @returns {{ labels: Map<string, string[]>, prefixes: Set<string> }}
 */
export function collectLabels(sources) {
  const labels = new Map()
  const prefixes = new Set()

  const add = (label, from) => {
    if (!label || label.includes('$')) return
    if (!labels.has(label)) labels.set(label, [])
    const list = labels.get(label)
    if (!list.includes(from)) list.push(from)
  }

  for (const source of sources ?? []) {
    const relPath = String(source?.path ?? '')
    const content = String(source?.content ?? '')
    if (!relPath || !content) continue

    for (const pattern of [...TS_CREATE_PATTERNS, ...RUST_CREATE_PATTERNS]) {
      pattern.lastIndex = 0
      for (const match of content.matchAll(pattern)) add(match[1], relPath)
    }

    PREFIX_PATTERN.lastIndex = 0
    for (const match of content.matchAll(PREFIX_PATTERN)) {
      if (match[1]) prefixes.add(match[1])
    }
  }

  return { labels, prefixes }
}

/**
 * 纯函数：判据。
 *
 * @param {{ labels: Map<string,string[]>, prefixes: Set<string>, registries: {matrix: string[], nonMatrix: string[]} }} input
 */
export function evaluateWindowRegistry({ labels, prefixes, registries } = {}) {
  const matrix = new Set(registries?.matrix ?? [])
  const nonMatrix = new Set(registries?.nonMatrix ?? [])
  const violations = []
  const matched = new Set()

  for (const [label, from] of labels ?? new Map()) {
    const inMatrix = matrix.has(label)
    const inNon = nonMatrix.has(label)
    if (inMatrix && inNon) {
      violations.push({ kind: 'both-registries', label, from })
      continue
    }
    if (!inMatrix && !inNon) {
      violations.push({ kind: 'unclassified', label, from })
      continue
    }
    matched.add(label)
  }

  // 直接查两份名单的交集：不依赖"该 label 是否被静态采集到" ——
  // 这样通过间接方式创建（采集不到）的 label 若被同时登记，也拦得住。
  for (const label of matrix) {
    if (nonMatrix.has(label)) violations.push({ kind: 'both-registries', label, from: [] })
  }

  for (const prefix of prefixes ?? new Set()) {
    const found = [...matrix, ...nonMatrix].some((entry) => entry.startsWith(prefix))
    if (!found) violations.push({ kind: 'prefix-not-registered', label: prefix, from: [] })
  }

  // 登记项标记（前缀条目用前缀自身比对）
  const stale = [...matrix, ...nonMatrix]
    .filter((entry) => {
      if (matched.has(entry)) return false
      if (prefixes?.has(entry)) return false
      return true
    })
    .sort()

  return {
    ok: violations.length === 0,
    violations: violations.sort((a, b) => a.label.localeCompare(b.label)),
    stale,
    collectedLabels: labels?.size ?? 0,
    collectedPrefixes: prefixes?.size ?? 0
  }
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
    } else if (SOURCE_EXT.test(entry)) {
      out.push(full)
    }
  }
  return out
}

function loadSources() {
  const sources = []
  for (const root of SOURCE_ROOTS) {
    const abs = resolve(repoRoot, root)
    if (!existsSync(abs)) continue
    for (const file of walk(abs)) {
      const rel = relative(repoRoot, file).split(sep).join('/')
      if (/\.(test|spec)\./.test(rel)) continue
      // 窗口名单文件自身不参与收集（它只是登记表）
      if (rel === WINDOW_LABELS_FILE) continue
      sources.push({ path: rel, content: readFileSync(file, 'utf8') })
    }
  }
  // tauri.*.conf.json 的静态窗口声明
  const confFiles = readdirSync(resolve(repoRoot, 'src-tauri')).filter(
    (f) => f.startsWith('tauri') && f.endsWith('.conf.json')
  )
  for (const conf of confFiles) {
    const rel = `src-tauri/${conf}`
    let parsed
    try {
      parsed = JSON.parse(readFileSync(resolve(repoRoot, rel), 'utf8'))
    } catch {
      continue
    }
    const declarative = (parsed?.app?.windows ?? []).map((w) => `windowLabel:"${w?.label}"`).join('\n')
    sources.push({ path: rel, content: declarative })
  }
  return sources
}

async function main() {
  const emitJson = process.argv.includes('--json')

  const labelsFile = resolve(repoRoot, WINDOW_LABELS_FILE)
  if (!existsSync(labelsFile)) {
    console.error(`[window-label-registry] scan failed: 找不到 ${WINDOW_LABELS_FILE}`)
    process.exit(2)
  }

  const sources = loadSources()
  // 基数断言：必须真的扫到一批源文件
  if (sources.length < 100) {
    console.error(`[window-label-registry] scan failed: 仅扫到 ${sources.length} 个源文件（基数断言 <100）`)
    process.exit(2)
  }

  // tauri conf 里的 `windowLabel:"x"` 也能被 TS 模式识别（复用同一收集器）
  const collected = collectLabels(sources)
  for (const [label, from] of collected.labels) {
    if (!from.length) collected.labels.delete(label)
  }

  const registries = parseRegistries(readFileSync(labelsFile, 'utf8'))
  const result = evaluateWindowRegistry({ ...collected, registries })

  // 基数断言：静态 label 与登记表都必须非空
  if (result.collectedLabels < 5) {
    console.error(`[window-label-registry] scan failed: 仅收集到 ${result.collectedLabels} 个窗口 label（基数断言 <5）`)
    process.exit(2)
  }
  if (registries.matrix.length + registries.nonMatrix.length === 0) {
    console.error('[window-label-registry] scan failed: windowLabels.ts 里没解析到任何登记项（基数断言）')
    process.exit(2)
  }

  if (emitJson) {
    process.stdout.write(`${JSON.stringify({ ...result, registries }, null, 2)}\n`)
  } else if (result.ok) {
    console.log(
      `[window-label-registry] OK — 收集 ${result.collectedLabels} 个 label / ${result.collectedPrefixes} 个前缀，全部已分类（matrix ${registries.matrix.length} / non-matrix ${registries.nonMatrix.length}）`
    )
    if (result.stale.length > 0) {
      console.log(`提示：登记表中 ${result.stale.length} 项已无静态来源（窗口可能已删除）:`)
      for (const s of result.stale) console.log(`  - ${s}`)
    }
  } else {
    console.error('[window-label-registry] FAIL — 窗口 label 未归类:')
    for (const v of result.violations) {
      if (v.kind === 'unclassified') {
        console.error(`  未分类: "${v.label}"（来源：${v.from.join(', ')}）`)
        console.error('    → 请在 src/utils/windowLabels.ts 的 MATRIX_WINDOW_LABELS / NON_MATRIX_WINDOW_LABELS 中显式归类')
      } else if (v.kind === 'both-registries') {
        console.error(`  两个名单都登记了: "${v.label}" —— 必须互斥`)
      } else {
        console.error(`  动态前缀未登记: "${v.label}" —— 请在登记表中加入以前缀开头的条目`)
      }
    }
  }

  process.exit(result.ok ? 0 : 1)
}

const isDirectRun = (() => {
  try {
    return process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)
  } catch {
    return false
  }
})()

if (isDirectRun) {
  main().catch((err) => {
    console.error('[window-label-registry] unexpected error', err)
    process.exit(2)
  })
}
