#!/usr/bin/env node
/**
 * Guard — Worker 不得再持有 MatrixClient（Batch 3.2，2026-10-13）。
 *
 * 背景（取证报告：仓库外 `OPS_ARTIFACTS/TJG_worker_client_forensics_2026-10-13.md`）：
 * 主线程 `MatrixWorkerHost` **从不发送** `initialize` / `login` / `startClient` /
 * `stopClient` / `getClient`，因此 worker 里的 `state.client` 恒为 null，
 * `workerClientHandlers.ts` 的七个 handler 与 `state.sdk` 全不可达；而 UI 却在用
 * `getStats()`（恒 null ⇒ 统计恒显示 `-`）与 `clearStores()`（no-op ⇒ 移动端还弹「清理成功」）。
 * 该死面已整体删除。
 *
 * ⚠️ 为什么不「接通」：给 worker 一个 client = 第二个 sync 实例挂**同一份固定名 store**
 * （无进程/窗口后缀），正是「两个 OlmMachine 抢同一 account store」那类竞态的源头；
 * 且 worker 侧 login 会再建一个登录会话。详见报告 §3。
 *
 * 本守卫锁四件事：
 *   1. `src/workers/**` 不得 import `matrix-js-sdk`（静态或动态）—— worker 不装 SDK；
 *   2. `src/workers/**` 不得出现 client 持有面（`state.client` / `createClient(` /
 *      `slidingSyncInstance`）；
 *   3. worker 消息分发表不得再登记这七个生命周期类型；
 *   4. 主线程 `MatrixWorkerHost` 不得再发送它们。
 *
 * ⚠️ 能力边界：本守卫只能保证「死面没回来」。它**不**保证 worker 与主线程的消息契约完整 ——
 * 那由 `src/services/matrix/__tests__/MatrixWorkerHost.test.ts` 的请求/响应用例兜底。
 *
 * Usage:
 *   node scripts/check-worker-client-boundary.mjs
 *   node scripts/check-worker-client-boundary.mjs --json
 *
 * Exit codes:
 *   0  通过
 *   1  发现违规
 *   2  环境或自检异常（目录/文件缺失、扫到的文件数不足 —— 基数断言）
 */

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const projectRoot = path.resolve(__dirname, '..')

/** 被收敛的 worker 目录与它不得依赖的 SDK 包名 */
export const WORKER_DIR = 'src/workers'
export const FORBIDDEN_SDK_IMPORT = 'matrix-js-sdk'

/** worker 源码里禁止出现的 client 持有面 */
export const FORBIDDEN_WORKER_TOKENS = [
  { token: 'MatrixClient', why: 'worker 不得引用 MatrixClient（哪怕只是类型）—— 该面已整体删除' },
  { token: 'state.client', why: 'worker 不持有 MatrixClient（Batch 3.2 已删除该状态）' },
  { token: 'slidingSyncInstance', why: 'worker 不持有 SlidingSync 实例' },
  { token: 'createClient(', why: 'worker 不得创建 MatrixClient（会造成第二个 sync 挂同一 store）' }
]

/** 已删除的 worker 消息类型：分发表与主线程都不得再登记/发送 */
export const REMOVED_MESSAGE_TYPES = [
  'initialize',
  'login',
  'startClient',
  'stopClient',
  'getClient',
  'clearStores',
  'getStats'
]

export const WORKER_ENTRY_FILE = 'src/workers/matrixSdk.worker.ts'
export const HOST_FILE = 'src/services/matrix/MatrixWorkerHost.ts'

const SOURCE_EXT = new Set(['.ts', '.tsx', '.mts', '.cts'])

/** 测试/生成物不参与扫描（测试里出现这些串是允许的，用于负例） */
export function isExcludedPath(relPath) {
  return (
    relPath.includes('__tests__') ||
    /\.(test|spec)\.[cm]?tsx?$/.test(relPath) ||
    relPath.endsWith('.d.ts')
  )
}

/** 行是否为注释 */
export function isCommentLine(line) {
  const trimmed = String(line).trim()
  return trimmed.startsWith('//') || trimmed.startsWith('*') || trimmed.startsWith('/*')
}

/** 去注释 + 去全部空白：换行/缩进重排不改变判据 */
export function compactCode(content) {
  return String(content ?? '')
    .split('\n')
    .filter((line) => !isCommentLine(line))
    .join('\n')
    .replace(/\s+/g, '')
}

/** 与 compactCode 配套：比对前把 token 里的空白也去掉 */
export function compactToken(token) {
  return String(token ?? '').replace(/\s+/g, '')
}

/**
 * 纯函数判据 —— 无 I/O，便于单测。
 *
 * @param {Array<{path: string, content: string}>} files 相对仓库根的路径 + 全文
 */
export function scanSources(files) {
  const violations = []
  const missing = []
  let checkedFiles = 0
  let sawWorkerEntry = false
  let sawHost = false

  for (const file of files ?? []) {
    const relPath = String(file?.path ?? '')
    const content = String(file?.content ?? '')
    if (!relPath || isExcludedPath(relPath)) continue

    const isWorker = relPath.startsWith(`${WORKER_DIR}/`)
    const isEntry = relPath === WORKER_ENTRY_FILE
    const isHost = relPath === HOST_FILE
    if (!isWorker && !isEntry && !isHost) continue

    checkedFiles++
    if (isEntry) sawWorkerEntry = true
    if (isHost) sawHost = true

    const compacted = compactCode(content)
    const lines = content.split('\n')

    // ① worker 目录不得依赖 SDK
    if (isWorker && compacted.includes(compactToken(FORBIDDEN_SDK_IMPORT))) {
      violations.push({
        path: relPath,
        token: FORBIDDEN_SDK_IMPORT,
        kind: 'worker-sdk-import',
        why: 'worker 不得 import matrix-js-sdk（含动态 import）—— 搜索索引不依赖它'
      })
    }

    // ② worker 目录不得出现 client 持有面
    if (isWorker) {
      for (const rule of FORBIDDEN_WORKER_TOKENS) {
        if (!compacted.includes(compactToken(rule.token))) continue
        const line = lines.findIndex((l) => !isCommentLine(l) && l.includes(rule.token.split('(')[0]))
        violations.push({ path: relPath, line: line >= 0 ? line + 1 : 1, token: rule.token, kind: 'worker-client-state', why: rule.why })
      }
    }

    // ③④ 分发表与主线程不得再登记/发送已删消息类型
    if (isEntry || isHost) {
      lines.forEach((line, index) => {
        if (isCommentLine(line)) return
        for (const type of REMOVED_MESSAGE_TYPES) {
          const asKey = new RegExp(`(^|[^\\w$])${type}\\s*:`).test(line)
          const asString = line.includes(`'${type}'`) || line.includes(`"${type}"`)
          if (asKey || asString) {
            violations.push({
              path: relPath,
              line: index + 1,
              token: type,
              kind: isEntry ? 'worker-dispatch' : 'host-request',
              why: `已删除的 worker 消息类型 ${type} 不得回归（worker 不持有 client）`
            })
          }
        }
      })
    }
  }

  if (!sawWorkerEntry) missing.push(WORKER_ENTRY_FILE)
  if (!sawHost) missing.push(HOST_FILE)

  return {
    ok: violations.length === 0 && missing.length === 0,
    checkedFiles,
    violations,
    missing
  }
}

/** 递归收集给定目录下的源码文件 */
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

/** 收集扫描集合：worker 目录 + 两个关键文件（可能不在该目录下） */
export function collectFiles() {
  const workerAbs = path.join(projectRoot, WORKER_DIR)
  if (!fs.existsSync(workerAbs)) {
    console.error(`[worker-client-boundary] scan failed: 目录不存在（${WORKER_DIR}）`)
    process.exit(2)
  }
  const collected = collectSourceFiles(workerAbs)
  const known = new Set(collected.map((f) => f.path))
  for (const rel of [WORKER_ENTRY_FILE, HOST_FILE]) {
    if (known.has(rel)) continue
    const abs = path.join(projectRoot, rel)
    if (fs.existsSync(abs)) collected.push({ path: rel, content: fs.readFileSync(abs, 'utf8') })
  }
  return collected
}

async function main() {
  const jsonOutput = process.argv.includes('--json')
  const files = collectFiles()

  // 基数断言：必须真的扫到一批 worker 源码
  if (files.length < 5) {
    console.error(`[worker-client-boundary] scan failed: 仅扫到 ${files.length} 个 worker 源码文件（基数断言 <5）`)
    process.exit(2)
  }

  const result = scanSources(files)
  if (result.missing.length > 0) {
    console.error(`[worker-client-boundary] scan failed: 关键文件未出现在扫描集合（${result.missing.join(', ')}）`)
    process.exit(2)
  }

  if (jsonOutput) {
    process.stdout.write(`${JSON.stringify(result, null, 2)}\n`)
  } else if (result.ok) {
    console.log(
      `[worker-client-boundary] OK — 扫描 ${result.checkedFiles} 个文件：worker 不持有 MatrixClient，七个已删消息类型未回归`
    )
  } else {
    console.error('[worker-client-boundary] FAIL — Worker 侧 client 死面回归:')
    for (const v of result.violations) {
      console.error(`  ${v.path}:${v.line ?? '-'}  ${v.token}  (${v.kind})`)
      console.error(`      → ${v.why}`)
    }
    console.error('  说明：搜索索引由主线程 bootstrapSearch*/upsertSearch* 喂数据，不需要 worker 侧 client；')
    console.error('        给 worker 一个 client 会让第二个 sync 实例挂上同一份 store（竞态来源）。')
  }

  process.exit(result.ok ? 0 : 1)
}

const isDirectRun = (() => {
  try {
    return process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
  } catch {
    return false
  }
})()

if (isDirectRun) {
  main().catch((err) => {
    console.error('[worker-client-boundary] unexpected error', err)
    process.exit(2)
  })
}
