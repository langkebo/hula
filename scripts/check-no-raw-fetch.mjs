// biome-ignore-all lint/suspicious/noConsole: This CLI script intentionally writes progress to the terminal.
/**
 * Guard: 绕过统一传输层（gateway）的裸请求。
 *
 * 背景（2026-10-11 修复）：旧实现用 `execSync("grep -rln '\bfetch(' src/ …")`，
 * `grep` 无匹配时退出码为 1，而 `execSync` 对非零退出直接抛异常 ⇒ 该脚本在任何
 * 「零命中」的正常状态下都会**崩溃**（EXIT=1，stderr 为空），既不能报告违规，
 * 也从未接入任何 CI 链。本实现改为纯 Node 目录遍历，不再依赖外部 `grep`（也顺带
 * 规避了 WorkBuddy CLI 把 `grep` 换成 toybox shim 的环境问题）。
 *
 * 背景（2026-10-13 扩展）：原判据只看 `fetch(`，**看不见 XMLHttpRequest 旁路** ——
 * `src/services/matrix/media/mediaUploadHelpers.ts` 用 XHR 直连
 * `POST /_matrix/media/v3/upload`，既绕过限流熔断器，也不在守卫视野内（图谱 §8 ⑪）。
 * 现新增 `xhr-bypass` 规则；当前该文件作为**已登记债务**在白名单里（附 TODO），
 * 迁移到 `MatrixHttpClient` 后必须删除该条目（Batch 3.1）。
 *
 * 判据：`src/**` 的 `.ts/.tsx/.vue` 文件（排除测试）命中任一规则且不在**该规则**的白名单内 ⇒ 违规。
 *   - `raw-fetch`  ：`fetch(`（前面不是标识符字符，排除 `myFetch(`）
 *   - `xhr-bypass` ：`new XMLHttpRequest(`
 *
 * Exit code:
 *   0  无违规
 *   1  存在白名单外的裸请求
 *   2  环境/自检异常（扫描目录不存在，或扫描到 0 个文件 —— 基数断言，
 *      避免「什么都没扫到」被误判为「通过」）
 *
 * Usage:
 *   node scripts/check-no-raw-fetch.mjs            human-readable
 *   node scripts/check-no-raw-fetch.mjs --json     machine-readable
 */

import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, resolve, relative, sep } from 'node:path'
import { fileURLToPath } from 'node:url'

const scriptDir = (() => {
  try {
    return fileURLToPath(new URL('.', import.meta.url))
  } catch {
    // 在 vitest（非 file: scheme 的 import.meta.url）下求值会抛错 —— 回退到 cwd，
    // 让本模块可被单测 import 而不炸在顶层。
    return process.cwd()
  }
})()
const repoRoot = resolve(scriptDir, '..')
const scanRoot = resolve(repoRoot, 'src')

/** 规则表：每条规则各自持有白名单（`Map<相对路径, 理由>`）。 */
export const RULES = {
  'raw-fetch': {
    pattern: /(^|[^\w$])fetch\s*\(/,
    hint: '请改用 @/utils/HttpClient、SDK manager 方法或统一 gateway',
    allowlist: new Map([
      ['src/services/matrix/network/runtimeFetch.ts', 'fetch 包装器本体'],
      ['src/App.vue', 'apple.com favicon 可达性探测（no-cors）'],
      ['src/strategy/strategies/video.ts', 'blob: URL 必须用浏览器原生 fetch'],
      [
        'src/composables/user/useAvatarUpload.ts',
        '头像上传读的是 webview 本地静态资源（/avatar/*.webp），非网络请求'
      ]
    ])
  },
  'xhr-bypass': {
    pattern: /new\s+XMLHttpRequest\s*\(/,
    hint: '请迁移到 MatrixHttpClient（限流/重试/取消语义统一；原始 body 走 matrixHttpClient.uploadRaw）',
    // Batch 3.1 已把唯一一处（mediaUploadHelpers 的 XHR 直传）迁到网关，白名单**必须保持为空**：
    // 再出现任何 `new XMLHttpRequest(` 都应当判红，而不是再加回豁免条目。
    allowlist: new Map()
  }
}

export const RULE_IDS = Object.keys(RULES)

const EXT = /\.(ts|tsx|vue)$/
const SKIP_DIR = new Set(['node_modules', 'dist', 'coverage', '__tests__'])

/** 是否为测试/生成物（不参与扫描） */
export function isExcludedSource(relPath) {
  return /\.(test|spec)\./.test(relPath)
}

/**
 * 纯函数：在一份源码文本里找出每条规则的命中行号。
 *
 * @param {string} text 源码全文
 * @returns {Record<string, number[]>} 规则 id → 命中行号（1-based）
 */
export function scanSourceText(text) {
  const result = {}
  for (const id of RULE_IDS) result[id] = []
  const lines = String(text ?? '').split('\n')
  lines.forEach((line, idx) => {
    for (const id of RULE_IDS) {
      if (RULES[id].pattern.test(line)) result[id].push(idx + 1)
    }
  })
  return result
}

/**
 * 纯函数：对一批源码文件套用规则与白名单。
 *
 * @param {Array<{path: string, content: string}>} sources 相对仓库根的路径 + 全文
 * @returns {{ violations: Array<object>, staleAllowlist: Array<object>, scannedFiles: number, findings: Array<object> }}
 */
export function evaluateBypasses(sources) {
  const findings = []
  const scannedFiles = []
  const seen = new Map(RULE_IDS.map((id) => [id, new Set()]))

  for (const source of sources ?? []) {
    const relPath = String(source?.path ?? '')
    if (!relPath || isExcludedSource(relPath)) continue
    scannedFiles.push(relPath)

    const perRule = scanSourceText(source?.content ?? '')
    for (const id of RULE_IDS) {
      if (perRule[id].length === 0) continue
      seen.get(id).add(relPath)
      findings.push({ file: relPath, ruleId: id, lines: perRule[id], approved: RULES[id].allowlist.has(relPath) })
    }
  }

  const violations = findings
    .filter((f) => !f.approved)
    .sort((a, b) => a.file.localeCompare(b.file) || a.ruleId.localeCompare(b.ruleId))

  const staleAllowlist = []
  for (const id of RULE_IDS) {
    for (const file of RULES[id].allowlist.keys()) {
      if (!seen.get(id).has(file)) staleAllowlist.push({ file, ruleId: id })
    }
  }

  return { violations, staleAllowlist, scannedFiles: scannedFiles.length, findings }
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
    } else if (EXT.test(entry)) {
      out.push(full)
    }
  }
  return out
}

function fail(message, emitJson) {
  if (emitJson) console.log(JSON.stringify({ error: message }, null, 2))
  else console.error(`[check-no-raw-fetch] ${message}`)
  process.exit(2)
}

async function main() {
  const emitJson = process.argv.includes('--json')

  try {
    statSync(scanRoot)
  } catch {
    fail(`扫描根目录不存在: ${scanRoot}`, emitJson)
  }

  const allFiles = walk(scanRoot)
  if (allFiles.length === 0) {
    fail(`扫描到 0 个源文件（${scanRoot}）—— 拒绝以「通过」收场`, emitJson)
  }

  const sources = []
  for (const file of allFiles) {
    const rel = relative(repoRoot, file).split(sep).join('/')
    if (isExcludedSource(rel)) continue
    try {
      sources.push({ path: rel, content: readFileSync(file, 'utf8') })
    } catch {
      // 读不到就跳过（不静默改变结论：仍以成功读取的文件集为准，且下面有基数断言）
    }
  }

  // 基数断言：必须真的读到一批源码，否则"没有违规"可能只是没读到
  if (sources.length < 100) {
    fail(`仅读到 ${sources.length} 个源文件（预期 ≥100）—— 拒绝以「通过」收场`, emitJson)
  }

  const { violations, staleAllowlist, scannedFiles, findings } = evaluateBypasses(sources)

  if (emitJson) {
    console.log(JSON.stringify({ scannedFiles, violations, staleAllowlist, findings }, null, 2))
  } else {
    const approvedCount = findings.length - violations.length
    console.log(`扫描源文件: ${scannedFiles}`)
    console.log(`命中规则的（文件,规则）对: ${findings.length}（白名单内 ${approvedCount}）`)
    for (const id of RULE_IDS) {
      const rule = RULES[id]
      console.log(`  ${id}: 白名单 ${rule.allowlist.size} 项 | 命中 ${findings.filter((f) => f.ruleId === id).length} 项`)
    }
    if (staleAllowlist.length > 0) {
      // 只提示不阻断：文件可能只是重命名/迁移中。缩小白名单是好事，但不应误伤并行改动。
      console.log(`\n提示：白名单中 ${staleAllowlist.length} 项已无匹配（可考虑移除）:`)
      for (const item of staleAllowlist) console.log(`  - [${item.ruleId}] ${item.file}`)
    }
  }

  if (violations.length > 0) {
    if (!emitJson) {
      console.error(`\nERROR: ${violations.length} 处白名单外的绕过统一传输层的请求:`)
      for (const v of violations) {
        console.error(`  [${v.ruleId}] ${v.file}:${v.lines.join(',')}`)
        console.error(`      ${RULES[v.ruleId].hint}`)
      }
      console.error('若确属正当用法，请在 scripts/check-no-raw-fetch.mjs 对应规则的 allowlist 中附带理由后加入。')
    }
    process.exit(1)
  }

  if (!emitJson) console.log('\nOK: 所有裸请求均在白名单内')
  process.exit(0)
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
    console.error('[check-no-raw-fetch] unexpected error', err)
    process.exit(2)
  })
}
