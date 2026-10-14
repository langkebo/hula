#!/usr/bin/env node
/**
 * §20.2 KPI #1 / §18.5.1 — Contract coverage scan (phase 2).
 *
 * Walks `src/services/**`, locates every HTTP/SDK/Tauri call site, and cross-
 * references extracted URL literals against the SDK ledger
 * (`docs/api-contract/generated/route-manifest.default.json`, consumed from
 * the linked `matrix-js-sdk` sibling). Emits `scripts/contract-coverage-map.json`
 * with per-file call detail, matched ledger entries, unmatched URLs, and an
 * `uncoveredLedger` list (routes the ledger knows that no caller touches).
 *
 * Phase 1 left `ledgerRoute: null` for every caller. Phase 2:
 *   - Loads the ledger if present (non-fatal when missing so contributors
 *     without the sibling checkout can still run the scan).
 *   - Extracts string / template-literal URL args from `apiRequest(...)`,
 *     `runtimeFetch(...)`, and `HttpClient.{get,post,put,delete,patch}(...)`.
 *   - Normalizes template `${foo}` placeholders to `{foo}` form.
 *   - Emits per-caller `ledgerRoute: { method?, path }[]` when matched.
 *
 * Output: scripts/contract-coverage-map.json
 *
 * Usage:
 *   node scripts/contract-coverage-scan.mjs                    # write & log summary
 *   node scripts/contract-coverage-scan.mjs --check            # also fail if zero callers
 *   node scripts/contract-coverage-scan.mjs --ledger <path>    # override ledger path
 */

import { readdir, readFile, stat, writeFile } from 'node:fs/promises'
import { realpathSync as fsRealpathSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const projectRoot = path.resolve(__dirname, '..')
const servicesRoot = path.join(projectRoot, 'src', 'services')
const outFile = path.join(projectRoot, 'scripts', 'contract-coverage-map.json')

const args = process.argv.slice(2)
const argSet = new Set(args)
const checkMode = argSet.has('--check')
const ledgerOverrideIdx = args.indexOf('--ledger')
const ledgerOverride = ledgerOverrideIdx >= 0 ? args[ledgerOverrideIdx + 1] : null
const DEFAULT_LEDGER_PATH = path.resolve(
  projectRoot,
  '..',
  'matrix-js-sdk',
  'docs',
  'api-contract',
  'generated',
  'route-manifest.default.json'
)

const SKIP_PATTERN = /(^|\/)__tests__(\/|$)|\.test\.ts$|\.spec\.ts$|\.d\.ts$/

/**
 * Tokens whose presence in a file marks it as a contract-touching service.
 * Used for the call-site census; URL extraction is handled separately.
 *
 * ⚠️ 这张表必须与**代码里真正在用的辅助函数名**同步：实测漏了 `postMatrixJson`
 * 与 `authedRequestWith*`，于是 `auth/` 域的裸调在普查里只记了 1 次（实际 8+ 次）。
 * `tests/lint/contract-coverage-scan.test.ts` 用「仓库里真实出现过的调用名」反向校验本表，
 * 防止再次漂移。
 */
export const CALL_PROBES = [
  { kind: 'sdk', pattern: /matrixClientService\.getClient\(\)/g },
  { kind: 'sdk', pattern: /matrixSdkBridge\./g },
  { kind: 'http', pattern: /runtimeFetch\s*\(/g },
  { kind: 'http', pattern: /getRuntimeAwareFetch\s*\(\s*\)\s*\(/g },
  { kind: 'http', pattern: /HttpClient\.(?:get|post|put|delete|patch)\s*\(/g },
  { kind: 'http', pattern: /\bapiRequest\s*\(/g },
  { kind: 'http', pattern: /\bpost(?:Matrix)?Json\s*(?:<[^<>()]{0,120}>)?\s*\(/g },
  { kind: 'http', pattern: /\bauthedRequestWith(?:Path|Prefix)\s*(?:<[^<>()]{0,120}>)?\s*\(/g },
  { kind: 'tauri', pattern: /\binvoke\s*\(/g }
]

/**
 * URL-literal extractors. Each captures the path-like first argument; the
 * matched group is passed through `normalizeUrlLiteral` before ledger lookup.
 *
 * ⚠️ 已知边界（**不是 bug，是设计边界**，勿照"能匹配更多"改）：
 * `authedRequestWithPath<T>(client, 'GET', '/register/captcha/status')` 的路径在
 * **第 3 个参数**且是**相对 SDK 前缀**的，本文件的命名空间过滤（必须 `/_matrix|/_synapse`）
 * 天然不收录这类值 —— 它们出现在 `callCount`（普查）里，不出现在 `urlCount`（字面量）里。
 * 硬套一个前缀假设会把这个 artifact 变成猜的，不如保持边界清晰。
 */
export const URL_EXTRACTORS = [
  // apiRequest('/path', ...)  /  apiRequest("/path", ...)
  /\bapiRequest\s*\(\s*(['"])([^'"]+)\1/g,
  // apiRequest(`/path/${x}/more`, ...)
  /\bapiRequest\s*\(\s*`([^`]+)`/g,
  // runtimeFetch('/path', ...)
  /\bruntimeFetch\s*\(\s*(['"])([^'"]+)\1/g,
  // runtimeFetch(`/path/${x}`, ...)
  /\bruntimeFetch\s*\(\s*`([^`]+)`/g,
  // getRuntimeAwareFetch()('/path', ...)
  /\bgetRuntimeAwareFetch\s*\(\s*\)\s*\(\s*(['"])([^'"]+)\1/g,
  /\bgetRuntimeAwareFetch\s*\(\s*\)\s*\(\s*`([^`]+)`/g,
  // HttpClient.get('/path', ...)
  /\bHttpClient\.(?:get|post|put|delete|patch)\s*\(\s*(['"])([^'"]+)\1/g,
  /\bHttpClient\.(?:get|post|put|delete|patch)\s*\(\s*`([^`]+)`/g,
  // postMatrixJson<T>('/path', ...) / postJson<T>(`${PREFIX_V3}/path`, ...)
  /\bpost(?:Matrix)?Json\s*(?:<[^<>()]{0,120}>)?\s*\(\s*(['"])([^'"]+)\1/g,
  /\bpost(?:Matrix)?Json\s*(?:<[^<>()]{0,120}>)?\s*\(\s*`([^`]+)`/g
]

async function* walk(dir) {
  let entries
  try {
    entries = await readdir(dir, { withFileTypes: true })
  } catch (err) {
    if (err.code === 'ENOENT') return
    throw err
  }
  for (const entry of entries) {
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) {
      yield* walk(full)
    } else if (entry.isFile() && full.endsWith('.ts') && !SKIP_PATTERN.test(full)) {
      yield full
    }
  }
}

function classify(text) {
  const hits = []
  for (const probe of CALL_PROBES) {
    probe.pattern.lastIndex = 0
    let m
    while ((m = probe.pattern.exec(text)) !== null) {
      hits.push({ kind: probe.kind, index: m.index })
    }
  }
  return hits
}

/**
 * 收集「简单字符串常量」：`const NAME = '<literal>'` / `export const NAME = "<literal>"`。
 *
 * 为什么需要：扫描面里大量裸调写成 `` `${PREFIX_V3}/register/captcha/send` ``（实测 35 处），
 * 而 `normalizeUrlLiteral` 会把插值替换成 `{PREFIX_V3}`，随后「从第一个 `/` 切片」得到
 * `/register/captcha/send` —— **不匹配 `^/(_matrix|_synapse|\.well-known)` 命名空间过滤 ⇒ 整条被丢弃**。
 * 结果是 map 报 `totalUrls: 0`，看起来「已经没有裸调」，实际是**检测盲区**。
 * （这与本函数上方注释自述的意图矛盾：注释说会保留 "a template with such a segment"。）
 *
 * 只收**字面量赋值**；计算值/跨文件再导出的一律不收（收不到就退回原行为，不会更差）。
 */
export function collectStringConsts(text, into = new Map()) {
  const re = /(?:^|\n)\s*(?:export\s+)?const\s+([A-Za-z_$][\w$]*)\s*=\s*(['"])([^'"\n]*)\2/g
  let m
  while ((m = re.exec(text)) !== null) into.set(m[1], m[3])
  return into
}

/**
 * 把模板里的 `${IDENT}` 就地替换为常量字面量（最多迭代 3 轮，支持
 * `const A = '/x'; const B = \`${A}/y\`` 这类一层引用）。查不到的标识符原样保留，
 * 交给 `normalizeUrlLiteral` 的后备逻辑（从第一个 `/` 切片）。
 */
export function expandConsts(raw, consts) {
  let out = raw
  for (let i = 0; i < 3; i += 1) {
    const next = out.replace(/\$\{([A-Za-z_$][\w$]*)\}/g, (whole, name) =>
      consts.has(name) ? consts.get(name) : whole
    )
    if (next === out) break
    out = next
  }
  return out
}

/**
 * Extracts ledger-eligible URL literals from a file's source. Strings that
 * don't look like Matrix/Synapse paths (no leading `/_matrix`, `/_synapse`,
 * or a template with such a segment) are dropped to keep the output tight.
 */
export function extractUrls(text, consts = new Map()) {
  const found = new Set()
  for (const re of URL_EXTRACTORS) {
    re.lastIndex = 0
    let m
    while ((m = re.exec(text)) !== null) {
      const raw = m[2] ?? m[1]
      if (!raw) continue
      const normalized = normalizeUrlLiteral(raw, consts)
      if (!normalized) continue
      found.add(normalized)
    }
  }
  return [...found]
}

export function normalizeUrlLiteral(raw, consts = new Map()) {
  // 先解析常量前缀（`${PREFIX_V3}/x` → `/_matrix/client/v3/x`），再处理运行时插值。
  const resolved = consts.size > 0 ? expandConsts(raw, consts) : raw
  // Template interpolations → {name}; anonymous interpolations → {param}.
  const templated = resolved.replace(/\$\{([^}]+)\}/g, (_, expr) => {
    const ident = expr.trim().match(/^[A-Za-z_$][\w$]*$/)
    return ident ? `{${ident[0]}}` : '{param}'
  })
  // Drop anything before the first `/` (e.g. `${baseUrl}/foo` → `/foo`).
  const sliceFrom = templated.indexOf('/')
  if (sliceFrom < 0) return null
  const sliced = templated.slice(sliceFrom)
  // Only keep ledger-tracked namespaces; everything else is noise.
  if (!/^\/(_matrix|_synapse|\.well-known)\b/.test(sliced)) return null
  // Strip query string / hash fragments; ledger paths carry neither.
  return sliced.split(/[?#]/, 1)[0]
}

async function loadLedger(ledgerPath) {
  try {
    await stat(ledgerPath)
  } catch {
    return null
  }
  const raw = await readFile(ledgerPath, 'utf8')
  const parsed = JSON.parse(raw)
  if (!parsed || !Array.isArray(parsed.entries)) return null
  const byPath = new Map()
  for (const entry of parsed.entries) {
    if (!entry?.path) continue
    const bucket = byPath.get(entry.path) ?? []
    bucket.push(entry)
    byPath.set(entry.path, bucket)
  }
  return {
    source: ledgerPath,
    schemaVersion: parsed.schema_version,
    synapseRustCommit: parsed.synapse_rust_commit,
    entryCount: parsed.entry_count ?? parsed.entries.length,
    byPath
  }
}

async function main() {
  const ledgerPath = ledgerOverride ? path.resolve(ledgerOverride) : DEFAULT_LEDGER_PATH
  const ledger = await loadLedger(ledgerPath)

  const entries = []
  let scanned = 0
  const urlHitCount = new Map()
  const unmatchedUrls = new Map()

  // 预扫描一遍，收全仓「简单字符串常量」（前缀常量集中定义在
  // `src/services/matrix/paths/prefixes.ts`，但使用点在其它文件 ⇒ 必须全仓收集）。
  const consts = new Map()
  for await (const file of walk(servicesRoot)) {
    collectStringConsts(await readFile(file, 'utf8'), consts)
  }

  for await (const file of walk(servicesRoot)) {
    scanned++
    const text = await readFile(file, 'utf8')
    const hits = classify(text)
    const urls = extractUrls(text, consts)
    if (hits.length === 0 && urls.length === 0) continue

    const ledgerRoutes = []
    const fileUnmatched = []
    for (const url of urls) {
      const matches = ledger?.byPath.get(url)
      if (matches && matches.length > 0) {
        ledgerRoutes.push({
          path: url,
          methods: [...new Set(matches.map((m) => m.method))].sort()
        })
        urlHitCount.set(url, (urlHitCount.get(url) ?? 0) + 1)
      } else {
        fileUnmatched.push(url)
        unmatchedUrls.set(url, (unmatchedUrls.get(url) ?? 0) + 1)
      }
    }

    entries.push({
      file: path.relative(projectRoot, file),
      callCount: hits.length,
      kinds: [...new Set(hits.map((h) => h.kind))],
      urlCount: urls.length,
      ledgerRoutes,
      unmatchedUrls: fileUnmatched
    })
  }

  const uncoveredLedger = ledger
    ? [...ledger.byPath.keys()].filter((p) => !urlHitCount.has(p)).sort()
    : []

  const summary = {
    generatedAt: new Date().toISOString(),
    scanned,
    callerFiles: entries.length,
    totalCalls: entries.reduce((acc, e) => acc + e.callCount, 0),
    totalUrls: entries.reduce((acc, e) => acc + e.urlCount, 0),
    ledger: ledger
      ? {
          source: path.relative(projectRoot, ledger.source),
          schemaVersion: ledger.schemaVersion,
          synapseRustCommit: ledger.synapseRustCommit,
          entryCount: ledger.entryCount,
          matchedPathCount: urlHitCount.size,
          uncoveredPathCount: uncoveredLedger.length
        }
      : null,
    unmatchedUrls: [...unmatchedUrls.entries()]
      .map(([url, count]) => ({ url, count }))
      .sort((a, b) => (b.count - a.count) || a.url.localeCompare(b.url)),
    uncoveredLedger,
    entries
  }

  await writeFile(outFile, `${JSON.stringify(summary, null, 2)}\n`, 'utf8')
  console.log(
    `[contract-coverage] scanned ${scanned} files; ${summary.callerFiles} caller(s), ${summary.totalCalls} call(s), ${summary.totalUrls} URL literal(s)`
  )
  if (ledger) {
    console.log(
      `[contract-coverage] ledger matched ${summary.ledger.matchedPathCount}/${ledger.entryCount} path(s); ${summary.unmatchedUrls.length} unmatched URL literal(s); ${uncoveredLedger.length} uncovered ledger path(s)`
    )
  } else {
    console.log(`[contract-coverage] ledger not found at ${ledgerPath} — mapping skipped`)
  }
  console.log(`[contract-coverage] wrote ${path.relative(projectRoot, outFile)}`)

  if (checkMode && summary.callerFiles === 0) {
    console.error('[contract-coverage] FAIL — no callers detected; probe set may be stale')
    process.exit(1)
  }
}

// 入口守卫（本仓门禁脚本惯例）：被 tests/lint/ 导入时不得执行扫描本体。
// 两侧都用 realpath 解析 —— 只比字符串时，经符号链接调用会被误判成「非直接执行」而**静默不跑**。
function isDirectRun() {
  const entry = process.argv[1]
  if (!entry) return true
  try {
    return fsRealpathSync.native(entry) === fsRealpathSync.native(fileURLToPath(import.meta.url))
  } catch {
    return true
  }
}

if (isDirectRun()) {
  main().catch((err) => {
    console.error('[contract-coverage] unexpected error', err)
    process.exit(2)
  })
}

