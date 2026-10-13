#!/usr/bin/env node
/**
 * SDK `_unstable_*` 存在性守卫。
 *
 * 背景（Batch 3.4 的根因）：`MatrixDelayedEventsService.getDelayedEvents()` 曾调用
 * `client._unstable_getDelayedEvents(...)`，而该方法在 matrix-js-sdk 的**任何**声明文件里都不存在
 * —— 因为用了 `!` 非空断言，TypeScript 完全放行，运行时才会 `TypeError`。
 * 同类幻觉 API 只要落在"结构化最小接口 + 非空断言"里，就**没有任何编译期防线**。
 *
 * 本守卫补上这条防线：把 Tjg 源码里出现的 `_unstable_xxx` 与**已安装** SDK 声明里的
 * `_unstable_*` 集合逐一比对，出现未声明的即判红。
 *
 * 判据细节：
 *   - 只认**非注释代码**里的成员访问（`._unstable_xxx`）—— 注释里写"删掉了 _unstable_yyy"
 *     是允许的（那是知识，不是调用）；
 *   - 已安装 SDK 缺失 ⇒ EXIT=2（不许"扫不到 SDK = 通过"）；
 *   - 基数断言：SDK 声明数 < 5 或扫到的源码文件 < 100 ⇒ EXIT=2。
 *
 * Usage:
 *   node scripts/check-sdk-unstable-methods.mjs            # 校验
 *   node scripts/check-sdk-unstable-methods.mjs --print    # 打印两侧集合
 *
 * Exit codes:
 *   0  全部已声明（或命中白名单）
 *   1  存在未声明的 `_unstable_*` 调用
 *   2  扫描失败 / 基数断言失败（SDK 或源码树不可读）
 */

import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs'
import { dirname, join, relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

/** SDK 声明目录（已安装 tarball）。 */
export const SDK_LIB_DIR = 'node_modules/matrix-js-sdk/lib'

/**
 * 白名单：允许使用但 SDK 未声明的 `_unstable_*`。
 *
 * 每条必须写理由；本仓当前为空（这正是 Batch 3.4 要守住的状态）。
 * 若未来确有需要（例如 SDK 尚未更新声明但运行时已有实现），在此登记并附 issue/证据。
 */
export const ALLOWLIST = new Map([])

/** 基数断言阈值。 */
export const MIN_DECLARED = 5
export const MIN_SCANNED_FILES = 100

/** 解析仓库根：脚本位置优先，其次 cwd；两者都必须能看见 src/。 */
export function resolveRepoRoot() {
  const candidates = []
  try {
    candidates.push(resolve(dirname(fileURLToPath(import.meta.url)), '..'))
  } catch {
    // vitest 下 import.meta.url 不是 file: scheme
  }
  candidates.push(process.cwd())
  for (const candidate of candidates) {
    if (existsSync(join(candidate, 'src')) && existsSync(join(candidate, 'package.json'))) {
      return candidate
    }
  }
  throw new Error(`无法定位仓库根（候选：${candidates.join(', ')}）`)
}

/** 该行是否为注释。 */
export function isCommentLine(line) {
  const trimmed = String(line ?? '').trim()
  return trimmed.startsWith('//') || trimmed.startsWith('*') || trimmed.startsWith('/*')
}

/** 递归收集 .d.ts / .ts 文件（相对路径 -> 绝对路径）。 */
function collectFiles(root, predicate) {
  const out = []
  const walk = (dir) => {
    let entries
    try {
      entries = readdirSync(dir, { withFileTypes: true })
    } catch {
      return
    }
    for (const entry of entries) {
      const full = join(dir, entry.name)
      if (entry.isDirectory()) {
        if (entry.name === 'node_modules' || entry.name === '.git') continue
        walk(full)
      } else if (predicate(full)) {
        out.push(full)
      }
    }
  }
  walk(root)
  return out
}

/** 从一组 `.d.ts` 文本中提取 SDK 声明的 `_unstable_*` 集合。 */
export function extractDeclared(sources) {
  const declared = new Set()
  for (const text of sources) {
    for (const match of String(text ?? '').matchAll(/(_unstable_[A-Za-z0-9_]+)/g)) {
      declared.add(match[1])
    }
  }
  return declared
}

/**
 * 扫描源码文本，找出**非注释代码**里的 `_unstable_*` 成员访问。
 *
 * @returns Array<{ token: string, line: number }>
 */
export function scanUnstableUsage(text) {
  const out = []
  const lines = String(text ?? '').split('\n')
  const memberRe = /\.(_unstable_[A-Za-z0-9_]+)/g
  lines.forEach((line, index) => {
    if (isCommentLine(line)) return
    memberRe.lastIndex = 0
    for (const match of line.matchAll(memberRe)) {
      out.push({ token: match[1], line: index + 1 })
    }
  })
  return out
}

/**
 * 判定结果。
 *
 * @param {{ declared: Set<string>, files: Array<{ path: string, content: string }>, allowlist?: Map<string,string> }} input
 */
export function evaluateUnstableMethods({ declared, files, allowlist = ALLOWLIST }) {
  const violations = []
  const used = new Set()
  for (const file of files) {
    for (const hit of scanUnstableUsage(file.content)) {
      used.add(hit.token)
      if (declared.has(hit.token)) continue
      if (allowlist.has(hit.token)) continue
      violations.push({
        kind: 'undeclared-unstable-method',
        path: file.path,
        line: hit.line,
        token: hit.token,
        why: 'SDK 声明里没有这个 `_unstable_*` 方法 —— 运行时才会 TypeError（非空断言会让 TS 放行）'
      })
    }
  }
  return { ok: violations.length === 0, violations, used: [...used].sort(), declared: [...declared].sort() }
}

// ---------------------------------------------------------------- CLI

const invokedDirectly = (() => {
  try {
    return process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)
  } catch {
    return false
  }
})()

if (invokedDirectly) {
  const print = process.argv.includes('--print')
  let repoRoot
  try {
    repoRoot = resolveRepoRoot()
  } catch (err) {
    console.error(`[sdk-unstable] FAIL — ${err.message}`)
    process.exit(2)
  }

  // 1) 读已安装 SDK 的声明
  const sdkDir = join(repoRoot, SDK_LIB_DIR)
  if (!existsSync(sdkDir)) {
    console.error(`[sdk-unstable] FAIL — 找不到已安装 SDK：${SDK_LIB_DIR}（请先 pnpm install；不把"扫不到"当通过）`)
    process.exit(2)
  }
  const sdkFiles = collectFiles(sdkDir, (p) => p.endsWith('.d.ts'))
  if (sdkFiles.length === 0) {
    console.error(`[sdk-unstable] FAIL — ${SDK_LIB_DIR} 下没有任何 .d.ts（基数断言）`)
    process.exit(2)
  }
  const declared = extractDeclared(sdkFiles.map((p) => readFileSync(p, 'utf8')))
  if (declared.size < MIN_DECLARED) {
    console.error(`[sdk-unstable] FAIL — SDK 只声明到 ${declared.size} 个 _unstable_*（< ${MIN_DECLARED}，基数断言）`)
    process.exit(2)
  }

  // 2) 扫 Tjg 源码（排除测试）
  const srcRoot = join(repoRoot, 'src')
  const srcFiles = collectFiles(
    srcRoot,
    (p) => (p.endsWith('.ts') || p.endsWith('.vue')) && !/__tests__|\.test\.|\.spec\./.test(p)
  )
  if (srcFiles.length < MIN_SCANNED_FILES) {
    console.error(`[sdk-unstable] FAIL — 只扫到 ${srcFiles.length} 个源码文件（< ${MIN_SCANNED_FILES}，基数断言）`)
    process.exit(2)
  }
  const files = srcFiles.map((p) => ({ path: relative(repoRoot, p), content: readFileSync(p, 'utf8') }))

  const result = evaluateUnstableMethods({ declared, files })

  if (print) {
    console.log(`SDK 声明（${result.declared.length}）：${result.declared.join(', ')}`)
    console.log(`Tjg 使用（${result.used.length}）：${result.used.join(', ')}`)
  }

  if (result.ok) {
    console.log(
      `[sdk-unstable] OK — ${result.used.length} 个 _unstable_* 全部在 SDK 声明内` +
        `（扫 ${files.length} 文件，SDK 声明 ${declared.size} 个）`
    )
    process.exit(0)
  }

  console.error(`[sdk-unstable] FAIL — ${result.violations.length} 处调用了 SDK 未声明的 _unstable_*：`)
  for (const v of result.violations) {
    console.error(`  ${v.path}:${v.line}  ${v.token}`)
    console.error(`    ${v.why}`)
  }
  process.exit(1)
}
