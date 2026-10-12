#!/usr/bin/env node
/**
 * Guard — 禁止跨窗口 crypto「已完成即跳过」语义回归（Tjg 多窗口 + 共享 IndexedDB）。
 *
 * 背景（2026-10-13 取证，报告见仓库外
 * OPS_ARTIFACTS/TJG_multi_window_crypto_store_forensics_2026-10-13.md）：
 * Tauri 每个 WebView 有独立 JS 上下文与模块实例，但**同源 IndexedDB 是共享的**
 * （crypto store 的 DB 名固定为 `matrix-js-sdk::matrix-sdk-crypto` 等 3 个）。
 * 历史上 `MatrixCryptoStateTracker` 用 BroadcastChannel（`tjg-crypto-init`）实现
 * 「别的窗口已完成 ⇒ 本窗口跳过 initRustCrypto」+ 锁内复查「crypto 已可用即跳过」。
 * 实测（取证）这两类分支**恒不可达**：`cryptoClient.getCrypto()` 只能看到**本窗口本 client**
 * 的 crypto，别窗口初始化完也不会让本窗口的 getCrypto() 变为可用；而同 client 重入
 * 已被方法开头的 getCrypto() 早退 + startClient 的 IdempotencyGuard 覆盖。
 * 它们不只是死代码，还会让人误判「多窗口只初始化一次 crypto」（实际每个窗口都会完整初始化）。
 *
 * 本守卫锁住三件事，防止该叙事与机制被重新引入：
 *   1. 不得重新出现那套跨窗口广播/跳过机制（token 黑名单）；
 *   2. 不得在**非注释代码**里使用 BroadcastChannel 做 crypto 协调
 *      （注释里留历史说明是允许的 —— 那正是本守卫要保留的"为什么删"的知识）；
 *   3. 跨窗口串行化必须仍由 Web Locks 承担（正向断言：锁名 + 带锁名的 exclusive 加锁调用）。
 *
 * ⚠️ 能力边界（实测，别把它当万能）：
 * 正向断言只要求"代码里**存在**一次带锁名的 exclusive 加锁调用"，因此**删掉主路径那一次、
 * 留下后台重试路径那一次**这类变异，本守卫判不出来（实测逃逸，EXIT=0）。
 * 那种回归由行为测试兜底：`src/services/matrix/__tests__/MatrixCryptoStateTracker.test.ts`
 * 的「跨窗口串行化仍由 Web Locks 承担（tjg-ensure-crypto / exclusive）」会断言
 * 加锁调用恰好发生一次 —— 实测该变异下该用例判红（requests 为空）。
 * 分工：**文本守卫管"机制不许回来"，行为测试管"串行化真的还在链路上"**。
 *
 * Usage:
 *   node scripts/check-crypto-cross-window-coordination.mjs
 *   node scripts/check-crypto-cross-window-coordination.mjs --json
 *
 * Exit codes:
 *   0  通过
 *   1  发现违规（黑名单命中 / 正向断言缺失）
 *   2  环境或自检异常（扫不到文件、目标文件缺失 —— 基数断言，避免"什么都没扫到"被当成通过）
 */

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const projectRoot = path.resolve(__dirname, '..')
export const PROJECT_ROOT = projectRoot
export const srcRoot = path.join(projectRoot, 'src')

/** 承载跨窗口串行化的目标文件（正向断言的落点） */
export const TARGET_FILE = 'src/services/matrix/MatrixCryptoStateTracker.ts'

/**
 * 被删除机制的指纹 token —— 出现即判违规（注释里也不允许：这些是**标识符**
 * 与**消息字面量**，而不是解释性文字；需要解释"删了什么"请用自然语言描述）。
 */
export const FORBIDDEN_TOKENS = [
  'crypto-init-done',
  'crypto-init-started',
  'waitForCrossWindowCryptoInit',
  'broadcastCryptoInitDone',
  'CROSS_WINDOW_DONE_WAIT_MS',
  'CRYPTO_CHANNEL_NAME',
  'crypto-initialized-by-other-window',
  'crypto-already-available-after-lock'
]

/** 非注释代码里禁止出现的 API —— crypto 跨窗口协调不得再依赖广播 */
export const FORBIDDEN_APIS_IN_CODE = ['BroadcastChannel']

/** 正向断言：目标文件必须仍包含这些片段（串行化没有被一起删掉） */
export const REQUIRED_IN_TARGET = [
  { token: "CRYPTO_LOCK_NAME = 'tjg-ensure-crypto'", why: '跨窗口互斥锁名丢失' },
  {
    // 必须命中**带锁名的加锁调用**，而不是 `isWebLocksAvailable()` 里的能力探测
    // （探测里也有 `navigator.locks.request` —— 曾让"删掉真调用"的变异逃逸，见下）
    token: 'navigator.locks.request(CRYPTO_LOCK_NAME',
    why: 'Web Locks 串行化丢失（跨窗口将并发争抢同一 IndexedDB）'
  },
  { token: "mode: 'exclusive'", why: '互斥模式丢失（非互斥锁 = 没有串行化）' }
]

const SOURCE_EXT = new Set(['.ts', '.tsx', '.mts', '.cts', '.vue'])

/** 测试/生成物不参与扫描（测试里出现历史 token 是允许的，用于负例） */
export function isExcludedPath(relPath) {
  return (
    relPath.includes('__tests__') ||
    /\.(test|spec)\.[cm]?tsx?$/.test(relPath) ||
    relPath.includes('tests/') ||
    relPath.endsWith('.stories.ts') ||
    relPath.endsWith('.d.ts')
  )
}

/** 行是否为注释（`//`、`/*`、`*` 起始）—— 允许在注释里保留"为什么删"的历史说明 */
export function isCommentLine(line) {
  const trimmed = String(line).trim()
  return trimmed.startsWith('//') || trimmed.startsWith('*') || trimmed.startsWith('/*')
}

/**
 * 只保留非注释代码行，并把空白折叠成单空格。
 *
 * 为什么：正向断言**不能**用"全文 includes"。实测变异（删掉真正的
 * `navigator.locks.request(CRYPTO_LOCK_NAME, …)` 调用）曾被
 * `isWebLocksAvailable()` 里的能力探测字符串「顶包」而假通过。
 * 折叠空白则是为了让跨行写法（`navigator.locks\n  .request(...)`）也能命中。
 */
export function normalizeCode(content) {
  return String(content ?? '')
    .split('\n')
    .filter((line) => !isCommentLine(line))
    .join('\n')
    .replace(/\s+/g, ' ')
    .trim()
}

/** 去注释后再去掉**全部**空白 —— 换行/缩进重排不改变判据（`navigator.locks\n.request(` 也必须命中） */
export function compactCode(content) {
  return normalizeCode(content).replace(/\s+/g, '')
}

/** 与 compactCode 配套：比对前把 token 里的空白也去掉 */
export function compactToken(token) {
  return String(token ?? '').replace(/\s+/g, '')
}

/**
 * 纯函数判据 —— 无 I/O，便于单测。
 *
 * @param {Array<{path: string, content: string}>} files 相对仓库根的路径 + 全文
 * @returns {{ ok: boolean, checkedFiles: number, targetFound: boolean, violations: Array<object>, missingRequired: Array<object> }}
 */
export function scanSources(files) {
  const violations = []
  const missingRequired = []
  let checkedFiles = 0
  let targetFound = false
  let targetContent = null

  for (const file of files ?? []) {
    const relPath = String(file?.path ?? '')
    const content = String(file?.content ?? '')
    if (!relPath || isExcludedPath(relPath)) continue
    checkedFiles++

    if (relPath === TARGET_FILE) {
      targetFound = true
      targetContent = content
    }

    const lines = content.split('\n')
    lines.forEach((line, index) => {
      for (const token of FORBIDDEN_TOKENS) {
        if (line.includes(token)) {
          violations.push({ path: relPath, line: index + 1, token, kind: 'forbidden-token' })
        }
      }
      if (!isCommentLine(line)) {
        for (const api of FORBIDDEN_APIS_IN_CODE) {
          if (line.includes(api)) {
            violations.push({ path: relPath, line: index + 1, token: api, kind: 'forbidden-api-in-code' })
          }
        }
      }
    })
  }

  if (targetContent !== null) {
    const compactedTarget = compactCode(targetContent)
    for (const requirement of REQUIRED_IN_TARGET) {
      if (!compactedTarget.includes(compactToken(requirement.token))) {
        missingRequired.push({ path: TARGET_FILE, token: requirement.token, why: requirement.why })
      }
    }
  }

  return {
    ok: violations.length === 0 && missingRequired.length === 0,
    checkedFiles,
    targetFound,
    violations,
    missingRequired
  }
}

/** 递归收集 src 下的源码文件 */
export function collectSourceFiles(root) {
  const out = []
  const walk = (dir) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name)
      if (entry.isDirectory()) {
        walk(full)
      } else if (entry.isFile() && SOURCE_EXT.has(path.extname(entry.name))) {
        const rel = path.relative(projectRoot, full).split(path.sep).join('/')
        if (!isExcludedPath(rel)) out.push({ path: rel, content: fs.readFileSync(full, 'utf8') })
      }
    }
  }
  walk(root)
  return out
}

async function main() {
  const jsonOutput = process.argv.includes('--json')

  if (!fs.existsSync(srcRoot)) {
    console.error(`[crypto-cross-window] scan failed: src/ 不存在（${srcRoot}）`)
    process.exit(2)
  }

  const files = collectSourceFiles(srcRoot)
  // 基数断言：必须真的扫到一批源码，否则"没有违规"可能只是没扫到
  if (files.length < 100) {
    console.error(`[crypto-cross-window] scan failed: 仅扫到 ${files.length} 个源码文件（基数断言 <100）`)
    process.exit(2)
  }

  const result = scanSources(files)

  // 基数断言：正向断言的落点文件必须在扫描集合里
  if (!result.targetFound) {
    console.error(`[crypto-cross-window] scan failed: 目标文件未出现在扫描集合（${TARGET_FILE}）`)
    process.exit(2)
  }

  if (jsonOutput) {
    process.stdout.write(`${JSON.stringify(result, null, 2)}\n`)
  } else if (result.ok) {
    console.log(
      `[crypto-cross-window] OK — 扫描 ${result.checkedFiles} 个源码文件：无跨窗口跳过机制，Web Locks 串行化在位`
    )
  } else {
    console.error('[crypto-cross-window] FAIL — 跨窗口 crypto「已完成即跳过」语义回归:')
    for (const v of result.violations) {
      console.error(`  ${v.path}:${v.line}  ${v.token}  (${v.kind})`)
    }
    for (const m of result.missingRequired) {
      console.error(`  ${m.path}  缺少正向断言 ${m.token} —— ${m.why}`)
    }
    console.error('  说明：每个窗口都必须有自己的 OlmMachine；跨窗口只由 Web Locks 串行化，')
    console.error('        不存在也不可能有「别窗口完成即跳过」的语义（取证见 OPS_ARTIFACTS 报告）。')
  }

  process.exit(result.ok ? 0 : 1)
}

const isDirectRun = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)

if (isDirectRun) {
  main().catch((err) => {
    console.error('[crypto-cross-window] unexpected error', err)
    process.exit(2)
  })
}
