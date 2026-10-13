#!/usr/bin/env node
/**
 * Guard — 窗口级会话恢复必须走统一入口（Batch 2，2026-10-13）。
 *
 * 背景（图谱 §8.5 B2/B3，见 docs/Tjg-SDK-集成架构与能力图谱-2026-10-08.md）：
 * Tauri 每个 WebView 有独立 JS 上下文 ⇒ 非 home 窗口里的 `matrixClientService` 是新实例，
 * `getClient()` 初始为 `null`。恢复只能靠「用后端存的 token 重建 client」。
 *
 * 历史缺陷形态（本守卫要防它回来）：各页面**各写一份**恢复逻辑，且**不一致** ——
 * 「安全/会话」两个页签自己调 `sessionOrchestrator.ensureClientReady()` + `waitForClientReady(15s)`，
 * 而「推送/好友/忽略用户」只 `waitForClientReady(10s)`；独立聊天窗口则**完全不做恢复**。
 * 后果：冷启动直接进入后一类页面时**没人触发恢复**，只能白等超时后拿空数据/默认值；
 * 独立聊天窗口的 `getClient()` 恒为 null，压根拿不到消息。
 *
 * 现在统一入口是 `src/composables/common/useWindowSessionReady.ts`（幂等、每窗口一次）。
 * 本守卫锁三件事：
 *   1. 设置窗口与独立聊天窗口的源码**不得**再直接裸调 `matrixClientService.waitForClientReady`
 *      或 `sessionOrchestrator.ensureClientReady`（必须经统一入口）；
 *   2. 两个入口组件必须**存在**且真的调用了 `ensureSessionReady`（正向断言）；
 *   3. 统一入口模块本身必须存在（否则上面的正向断言没有承载物）。
 *
 * ⚠️ 能力边界：文本守卫只能保证「调用形态没回来」。它**不**保证恢复时序/幂等性正确 ——
 * 那由单测兜底（`src/composables/common/__tests__/useWindowSessionReady.test.ts` 断言
 * 三态与「并发/重复调用只跑一次」，`src/views/windowChat/__tests__/index.test.ts` 断言
 * 独立聊天窗口四种渲染态 + 重试）。
 *
 * Usage:
 *   node scripts/check-window-session-entry.mjs
 *   node scripts/check-window-session-entry.mjs --json
 *
 * Exit codes:
 *   0  通过
 *   1  发现违规（裸调禁用 API / 入口未接统一入口）
 *   2  环境或自检异常（目录/入口/入口模块缺失，或扫到的文件数不足 —— 基数断言，
 *      避免"什么都没扫到"被当成通过）
 */

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const projectRoot = path.resolve(__dirname, '..')
export const PROJECT_ROOT = projectRoot
export const repoRoot = projectRoot

/** 统一入口模块（必须存在，否则「都走入口」无从谈起） */
export const SESSION_ENTRY_MODULE = 'src/composables/common/useWindowSessionReady.ts'

/** 必须调用统一入口的窗口入口组件 —— 正向断言的落点 */
export const ENTRY_FILES = [
  { path: 'src/views/settingsWindow/SettingsPage.vue', why: '设置窗口壳层入口' },
  { path: 'src/views/windowChat/index.vue', why: '独立聊天窗口入口（图谱 §8.5 B3）' }
]

/** 被收敛的扫描范围：这些目录下不得直接裸调会话恢复 API */
export const SCAN_ROOTS = ['src/views/settingsWindow', 'src/views/windowChat']

/**
 * 正向断言 token：入口组件必须**调用**它。
 *
 * 必须带括号 —— 实测变异「保留 `const { ensureSessionReady } = useWindowSessionReady()`
 * 但删掉 `void ensureSessionReady()`」只认标识符时会**逃逸**（EXIT=0）。
 * 带括号后，解构/引用都不算，只有真的调用才命中（空白会在比对前去掉，跨行也拦得住）。
 */
export const REQUIRED_ENTRY_TOKEN = 'ensureSessionReady()'

/**
 * 非注释代码里禁止出现的调用（含跨行写法 —— 比对前会把空白全部去掉）。
 *
 * 注意只禁**调用形态**，不禁「导入」：注释里解释历史缺陷是允许且鼓励的。
 */
export const FORBIDDEN_CALLS = [
  {
    token: 'matrixClientService.waitForClientReady',
    why: '各页面不得自带客户端等待；统一走 useWindowSessionReady().ensureSessionReady()'
  },
  {
    token: 'sessionOrchestrator.ensureClientReady',
    why: '各页面不得各自恢复会话；统一走 useWindowSessionReady().ensureSessionReady()'
  }
]

const SOURCE_EXT = new Set(['.ts', '.tsx', '.mts', '.cts', '.vue'])

/** 测试/生成物不参与扫描（测试里出现历史写法是允许的，用于负例） */
export function isExcludedPath(relPath) {
  return (
    relPath.includes('__tests__') ||
    /\.(test|spec)\.[cm]?tsx?$/.test(relPath) ||
    relPath.includes('tests/') ||
    relPath.endsWith('.stories.ts') ||
    relPath.endsWith('.d.ts')
  )
}

/** 行是否为注释（`//`、`/*`、`*`、`<!--` 起始） */
export function isCommentLine(line) {
  const trimmed = String(line).trim()
  return (
    trimmed.startsWith('//') ||
    trimmed.startsWith('*') ||
    trimmed.startsWith('/*') ||
    trimmed.startsWith('<!--')
  )
}

/**
 * 只保留非注释代码行（注释里留"为什么不该这么写"的说明是允许的）。
 *
 * 为什么必须去注释：实测变异（把真调用写回代码）会被注释里的示例串"顶包"或反向掩盖，
 * 曾让同类守卫出现假通过（见 check-crypto-cross-window-coordination.mjs 的逃逸记录）。
 */
export function stripComments(content) {
  return String(content ?? '')
    .split('\n')
    .filter((line) => !isCommentLine(line))
    .join('\n')
}

/** 去注释 + 去掉**全部**空白：换行/缩进重排不改变判据 */
export function compactCode(content) {
  return stripComments(content).replace(/\s+/g, '')
}

/** 与 compactCode 配套：比对前把 token 里的空白也去掉 */
export function compactToken(token) {
  return String(token ?? '').replace(/\s+/g, '')
}

/**
 * 找出 token 首个片段（`a.b.c` 取 `a`）所在的最早非注释行号。
 *
 * 跨行写法（`await matrixClientService\n  .waitForClientReady(`）无法靠"逐行包含"命中，
 * 只能先按去空白后的整体判违规，再用本函数回定位一个可读行号。
 */
export function firstNonCommentLineOf(content, token) {
  const head = String(token ?? '').split('.')[0]
  const lines = String(content ?? '').split('\n')
  for (let i = 0; i < lines.length; i++) {
    if (isCommentLine(lines[i])) continue
    if (lines[i].includes(head)) return i + 1
  }
  return 1
}

/**
 * 纯函数判据 —— 无 I/O，便于单测。
 *
 * @param {Array<{path: string, content: string}>} files 相对仓库根的路径 + 全文
 * @returns {{ ok: boolean, checkedFiles: number, missingEntries: string[], violations: Array<object>, missingRequired: Array<object> }}
 */
export function scanSources(files) {
  const violations = []
  const missingRequired = []
  const missingEntries = []
  const seen = new Set()
  const compactByPath = new Map()
  let checkedFiles = 0

  for (const file of files ?? []) {
    const relPath = String(file?.path ?? '')
    const content = String(file?.content ?? '')
    if (!relPath || isExcludedPath(relPath)) continue
    if (!isInScanRoots(relPath) && !ENTRY_FILES.some((entry) => entry.path === relPath)) continue

    checkedFiles++
    seen.add(relPath)
    const compacted = compactCode(content)
    compactByPath.set(relPath, compacted)

    const lines = content.split('\n')
    lines.forEach((line, index) => {
      if (isCommentLine(line)) return
      for (const rule of FORBIDDEN_CALLS) {
        if (line.includes(rule.token)) {
          violations.push({ path: relPath, line: index + 1, token: rule.token, kind: 'forbidden-call', why: rule.why })
        }
      }
    })

    // 逐行 scan 抓不到跨行写法（`a\n.b(`）⇒ 再按"去注释 + 去全部空白"整体比对一次
    for (const rule of FORBIDDEN_CALLS) {
      if (!compacted.includes(compactToken(rule.token))) continue
      if (violations.some((v) => v.path === relPath && v.token === rule.token)) continue
      violations.push({
        path: relPath,
        line: firstNonCommentLineOf(content, rule.token),
        token: rule.token,
        kind: 'forbidden-call',
        why: rule.why,
        note: '跨行写法'
      })
    }
  }

  // 正向断言：入口组件必须存在且真的接了统一入口
  for (const entry of ENTRY_FILES) {
    const compacted = compactByPath.get(entry.path)
    if (compacted === undefined) {
      missingEntries.push(entry.path)
      continue
    }
    if (!compacted.includes(compactToken(REQUIRED_ENTRY_TOKEN))) {
      missingRequired.push({ path: entry.path, token: REQUIRED_ENTRY_TOKEN, why: entry.why })
    }
  }

  return {
    ok: violations.length === 0 && missingRequired.length === 0 && missingEntries.length === 0,
    checkedFiles,
    missingEntries,
    violations,
    missingRequired
  }
}

/** 路径是否落在被收敛的扫描范围内 */
export function isInScanRoots(relPath) {
  return SCAN_ROOTS.some((root) => relPath === root || relPath.startsWith(`${root}/`))
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

/** 收集扫描集合：SCAN_ROOTS 下的全部源码 + 两个入口组件（可能不在这些目录里） */
export function collectFiles() {
  const collected = []
  for (const root of SCAN_ROOTS) {
    const abs = path.join(projectRoot, root)
    if (!fs.existsSync(abs)) {
      console.error(`[window-session-entry] scan failed: 扫描目录不存在（${root}）`)
      process.exit(2)
    }
    collected.push(...collectSourceFiles(abs))
  }
  const known = new Set(collected.map((f) => f.path))
  for (const entry of ENTRY_FILES) {
    if (known.has(entry.path)) continue
    const abs = path.join(projectRoot, entry.path)
    if (fs.existsSync(abs)) collected.push({ path: entry.path, content: fs.readFileSync(abs, 'utf8') })
  }
  return collected
}

async function main() {
  const jsonOutput = process.argv.includes('--json')

  // 基数断言：统一入口模块必须存在（否则"都走入口"没有承载物）
  const entryModuleAbs = path.join(projectRoot, SESSION_ENTRY_MODULE)
  if (!fs.existsSync(entryModuleAbs)) {
    console.error(`[window-session-entry] scan failed: 统一入口模块不存在（${SESSION_ENTRY_MODULE}）`)
    process.exit(2)
  }

  const files = collectFiles()
  // 基数断言：必须真的扫到一批源码，否则"没有违规"可能只是没扫到
  if (files.length < 10) {
    console.error(`[window-session-entry] scan failed: 仅扫到 ${files.length} 个源码文件（基数断言 <10）`)
    process.exit(2)
  }

  const result = scanSources(files)

  // 基数断言：两个入口组件都必须出现在扫描集合里
  if (result.missingEntries.length > 0) {
    console.error(
      `[window-session-entry] scan failed: 入口组件未出现在扫描集合（${result.missingEntries.join(', ')}）`
    )
    process.exit(2)
  }

  if (jsonOutput) {
    process.stdout.write(`${JSON.stringify(result, null, 2)}\n`)
  } else if (result.ok) {
    console.log(
      `[window-session-entry] OK — 扫描 ${result.checkedFiles} 个源码文件：设置窗口/独立聊天窗口均经统一入口恢复会话`
    )
  } else {
    console.error('[window-session-entry] FAIL — 窗口会话恢复未走统一入口:')
    for (const v of result.violations) {
      console.error(`  ${v.path}:${v.line}  ${v.token}  (${v.kind})`)
      console.error(`      → ${v.why}`)
    }
    for (const m of result.missingRequired) {
      console.error(`  ${m.path}  缺少 ${m.token} 调用 —— ${m.why}`)
    }
    console.error('  说明：用 useWindowSessionReady().ensureSessionReady()（幂等、每窗口一次）。')
    console.error('        各页面自带 waitForClientReady 时，冷启动直接进入该页会没人触发恢复 ⇒ 白等超时后拿空数据。')
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
    console.error('[window-session-entry] unexpected error', err)
    process.exit(2)
  })
}
