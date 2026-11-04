#!/usr/bin/env node

/**
 * Guard — Matrix 服务层分层与 access_token 收口（AR-07b）。
 *
 * 背景：AR-07 原判据是「`src/services/matrix/` 非测试 `.ts` 过多（216）」。
 * 上一轮盘点（docs/baseline/matrix-service-granularity-inventory.md §5）已论证：
 * 高文件数是 `check-sdk-boundary` + `check-bare-matrix-paths` 两套边界守护
 * **反向锚定**的结果，不存在大范围合并空间 —— 所以本守卫**不设文件数下降目标**，
 * 只锁「不得增长」，把焦点移到 AR-07 的后半句：**token 流与调用链**。
 *
 * 实测（2026-11-04）：`access_token` 不是「流经 4+ service」，而是
 *   1 条主通道已收口（MatrixHttpClient → SDK authedRequestWithPrefix）
 * + 3 条绕行旁路（RawUploadChannel / mediaDownloadHelpers / SynapseExtensionHttpBase）
 * + 3 份可陈旧副本（matrixSessionState ref / pinia persist / extension 实例字段）
 * 且 `MatrixTokenManager.refresh()` 只回写 Rust 侧，两份 JS 副本不更新（潜伏缺陷）。
 *
 * 本守卫锁四件事：
 *   L1 token 读取入口白名单 —— 除设计内的接缝外，任何文件新增 `getAccessToken(` 即红；
 *   L2 token 副本禁令 —— durable copy 计数不得增长（目标 0，逐批清理后 --update 收紧）；
 *   L3 运行时依赖环数 —— Tarjan SCC，含环分量数不得增长；
 *   L4 运行时最长依赖链 —— 深度不得增长。
 *
 * ⚠️ 口径（易误判，务必遵守）：
 *   - **只量运行时边**：`import type` / `export type` 整条语句被剔除。
 *     实测含类型边时是 6 个环 / 19 层深，但那不产生运行时耦合，
 *     拿它做门禁等于把类型声明也判违规（噪声大、无收益）。
 *   - **只覆盖 `src/services/matrix/**`**：Vue 层（stores/components）不在 scope 内，
 *     故本守卫**不**证明「UI → service 无环」，那由 `check-worker-client-boundary`
 *     与运行期契约测试各自覆盖。
 *   - 计数按**文件级**而非 AST：注释行不计，但同文件内方法定义与调用一视同仁。
 *     这是刻意的 —— 任何新增 token 接触面都该有人看一眼。
 *
 * Usage:
 *   node scripts/check-matrix-service-layering.mjs            # 校验（CI / pre-merge）
 *   node scripts/check-matrix-service-layering.mjs --json     # 机器可读
 *   node scripts/check-matrix-service-layering.mjs --verbose  # 附带最长链与环成员
 *   node scripts/check-matrix-service-layering.mjs --update    # 清理后收紧基线
 *
 * Exit codes:
 *   0  通过
 *   1  发现违规（新增 token 读取点 / 副本增加 / 环增加 / 链变深 / 文件数增长）
 *   2  环境或自检异常（目录缺失、扫到文件数不足 —— 基数断言）
 */

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const projectRoot = path.resolve(__dirname, '..')

/** 扫描范围：相对仓库根 */
export const SERVICE_DIR = 'src/services/matrix'
/** 基线文件 */
export const BASELINE_PATH = 'meta/matrix-layering-baseline.json'
/** 基数断言：低于此值视为遍历失效（防"扫不到 ⇒ 恒绿"） */
export const MIN_EXPECTED_FILES = 200

const SOURCE_EXT = new Set(['.ts'])

/**
 * L1 白名单：这些文件**应当**接触 access token，属设计内的接缝。
 *
 * 每条都要写清「为什么允许」—— 白名单不是免死金牌，是设计意图的书面化。
 */
export const ALLOWED_TOKEN_READ_FILES = {
  [SERVICE_DIR + '/matrixClientAccessor.ts']: '唯一读入口实现（全局访问器，含 legacy fallback）',
  [SERVICE_DIR + '/MatrixHttpClient.ts']: 'HTTP 网关：委托 SDK authedRequestWithPrefix / accessor，不自行拼 Authorization',
  [SERVICE_DIR + '/MatrixClientService.ts']: '对外适配层（B2 批次将退化为纯转发）',
  [SERVICE_DIR + '/MatrixClientState.ts']: '状态实现层（B2 批次将删除 connectionManager 配置兜底）',
  [SERVICE_DIR + '/MatrixConnectionManager.ts']: 'accessor 注册点（token 与 client 同源的唯一出处）',
  [SERVICE_DIR + '/auth/sessionRuntimeInternal.ts']: 'SessionStorePort 端口类型声明（纯类型，无运行期读）'
}

/** L1 计数模式：命中任一即计一次 token 接触 */
export const TOKEN_READ_PATTERNS = [
  // `getAccessToken(` 与可选调用 `getAccessToken?.(` 都要算 —— 否则 `?.` 就能绕过本守卫
  /\bgetAccessToken\s*(?:\?\.)?\s*\(/g,
  /\bgetMatrixAccessToken\s*(?:\?\.)?\s*\(/g,
  // 把 token 拼进 URL query —— 会让 token 进日志/历史，B1 要清掉
  /\baccess_token=\$\{?/g
]

/**
 * L2 token 副本规则：durable copy（把 token 存进某个长期存活的结构）。
 * 与 L1 的区别：L1 是「读」，L2 是「存」。
 *
 * `generic` 类规则作用于**全部** scope 文件，新增第 N 份副本会被计数逮到；
 * `file` 类规则指向 scope 外的单一目标（pinia persist），需单独读取文件。
 */
export const TOKEN_COPY_RULES = [
  {
    id: 'private-token-field',
    generic: true,
    pattern: /private\s+(?:readonly\s+)?accessToken\s*:\s*string/,
    why: '把 token 存进服务实例字段 = 又一份可陈旧副本；应改为请求时读 accessor'
  },
  {
    id: 'token-ref',
    generic: true,
    pattern: /\baccessToken\s*=\s*ref\s*</,
    why: 'Vue ref 副本；MatrixTokenManager.refresh() 只回写 Rust 侧，刷新后不更新'
  },
  {
    id: 'pinia-persist',
    file: 'src/stores/domains/chat/matrix.ts',
    pattern: /pick\s*:\s*\[[^\]]*['"]accessToken['"]/s,
    why: 'token 进 pinia 持久化（Web 端 = localStorage 明文），且刷新后陈旧'
  }
]

const isExcludedPath = (relPath) =>
  relPath.includes('__tests__') || /\.(test|spec)\.[cm]?ts$/.test(relPath) || relPath.endsWith('.d.ts')

/** 行是否为注释（与 check-worker-client-boundary 同口径） */
export const isCommentLine = (line) => {
  const t = String(line).trim()
  return t.startsWith('//') || t.startsWith('*') || t.startsWith('/*')
}

/** 去注释行后重新拼接（保留行号语义不需要，只用于计数） */
const stripCommentLines = (content) =>
  String(content ?? '')
    .split('\n')
    .filter((line) => !isCommentLine(line))
    .join('\n')

/** 递归收集非测试 `.ts` */
export function collectSourceFiles(absDir) {
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
  walk(absDir)
  return out
}

/** L1：统计单文件的 token 接触次数（注释行不计） */
export function countTokenReads(content) {
  const code = stripCommentLines(content)
  let total = 0
  for (const pattern of TOKEN_READ_PATTERNS) {
    const re = new RegExp(pattern.source, pattern.flags)
    total += (code.match(re) ?? []).length
  }
  return total
}

/** 语句起始位置（行首的 import / export，捕获关键字） */
const STATEMENT_START = /^[ \t]*(import|export)\b/gm
/** 语句里的模块说明符 */
const FROM_SPECIFIER = /\bfrom\s*['"]([^'"]+)['"]/
/** 副作用导入（无 from）：`import './x'` */
const SIDE_EFFECT_SPECIFIER = /^[ \t]*import\s*['"]([^'"]+)['"]/

/**
 * 抽取单个文件的 import/export 说明符，并标出是否为**纯类型**语句。
 *
 * 为什么不用「整条正则 + 分号收尾」：本仓库是 **无分号** 风格（Biome semi:false），
 * 用 `[\s\S]*?;` 剔除 `import type` 会跨语句吞掉后面的真实 import
 * （实测 `MatrixClientService.ts` 的边被吞成 0，导致环数/链深全部失真）。
 * 这里改为「按语句起始切块 + 用 from 定位说明符」，不依赖分号。
 */
export function extractModuleSpecifiers(code) {
  const starts = []
  let m
  const re = new RegExp(STATEMENT_START.source, STATEMENT_START.flags)
  while ((m = re.exec(code)) !== null) {
    starts.push({ index: m.index, keyword: m[1] })
    // 防止零宽匹配死循环
    if (re.lastIndex === m.index) re.lastIndex += 1
  }

  const out = []
  for (let i = 0; i < starts.length; i += 1) {
    const begin = starts[i].index
    const end = i + 1 < starts.length ? starts[i + 1].index : code.length
    const chunk = code.slice(begin, end)
    if (isCommentLine(chunk.split('\n')[0] ?? '')) continue

    const head = chunk.slice(chunk.indexOf(starts[i].keyword) + starts[i].keyword.length)
    // `import type ...` / `export type ...` → 纯类型，不产生运行时边
    const isTypeOnly = /^[ \t]+type[ \t\n]/.test(head)

    const fromMatch = chunk.match(FROM_SPECIFIER)
    const spec = fromMatch?.[1] ?? chunk.match(SIDE_EFFECT_SPECIFIER)?.[1]
    if (!spec) continue

    out.push({ spec, typeOnly: isTypeOnly })
  }
  return out
}

/**
 * 构建**运行时** import 图（剔除纯类型语句）。
 *
 * 只解析本目录内的相对路径与 `@/services/matrix/*`；跨包/跨层导入不入图（scope 之外）。
 */
export function buildRuntimeGraph(files) {
  const known = new Set(files.map((f) => f.path))
  const graph = new Map()

  const resolve = (fromPath, spec) => {
    let cand
    if (spec.startsWith('.')) {
      cand = path.posix.normalize(path.posix.join(path.posix.dirname(fromPath), spec))
    } else if (spec === '@/services/matrix') {
      cand = SERVICE_DIR
    } else if (spec.startsWith('@/services/matrix/')) {
      cand = path.posix.join(SERVICE_DIR, spec.slice('@/services/matrix/'.length))
    } else {
      return null
    }
    for (const suffix of ['.ts', '/index.ts']) {
      if (known.has(cand + suffix)) return cand + suffix
    }
    return known.has(cand) ? cand : null
  }

  for (const file of files) {
    const targets = new Set()
    for (const { spec, typeOnly } of extractModuleSpecifiers(String(file.content ?? ''))) {
      if (typeOnly) continue
      const target = resolve(file.path, spec)
      if (target && target !== file.path) targets.add(target)
    }
    graph.set(file.path, targets)
  }

  return graph
}

/** Tarjan SCC，返回「含环」的强连通分量（size > 1，或自环） */
export function findCycles(graph) {
  let counter = 0
  const index = new Map()
  const low = new Map()
  const onStack = new Set()
  const stack = []
  const cycles = []

  const strongConnect = (v) => {
    index.set(v, counter)
    low.set(v, counter)
    counter += 1
    stack.push(v)
    onStack.add(v)

    for (const w of graph.get(v) ?? []) {
      if (!index.has(w)) {
        strongConnect(w)
        low.set(v, Math.min(low.get(v), low.get(w)))
      } else if (onStack.has(w)) {
        low.set(v, Math.min(low.get(v), index.get(w)))
      }
    }

    if (low.get(v) === index.get(v)) {
      const component = []
      let w
      do {
        w = stack.pop()
        onStack.delete(w)
        component.push(w)
      } while (w !== v)
      const isSelfLoop = component.length === 1 && (graph.get(v)?.has(v) ?? false)
      if (component.length > 1 || isSelfLoop) cycles.push(component.sort())
    }
  }

  for (const v of graph.keys()) {
    if (!index.has(v)) strongConnect(v)
  }

  return cycles.sort((a, b) => b.length - a.length)
}

/** 最长依赖链（DFS + memo，遇栈内节点即回退，避免自环死递归） */
export function longestChain(graph) {
  const memo = new Map()

  const walk = (node, stack) => {
    if (stack.has(node)) return { depth: 0, chain: [] }
    if (memo.has(node)) return memo.get(node)
    stack.add(node)
    let best = { depth: 0, chain: [] }
    for (const next of graph.get(node) ?? []) {
      const sub = walk(next, stack)
      if (sub.depth + 1 > best.depth) best = { depth: sub.depth + 1, chain: [next, ...sub.chain] }
    }
    stack.delete(node)
    memo.set(node, best)
    return best
  }

  let best = { depth: 0, chain: [], root: null }
  for (const node of graph.keys()) {
    const r = walk(node, new Set())
    if (r.depth > best.depth) best = { depth: r.depth, chain: r.chain, root: node }
  }
  return best
}

/**
 * 纯函数判据 —— 无 I/O，便于单测。
 *
 * @param {Array<{path: string, content: string}>} files 扫描范围内的文件
 * @param {object} baseline 基线快照
 * @param {Array<{path: string, content: string}>} extraFiles scope 外的副本检查目标（如 pinia store）
 */
export function scan(files, baseline, extraFiles = []) {
  const graph = buildRuntimeGraph(files)
  const cycles = findCycles(graph)
  const chain = longestChain(graph)

  const readSites = {}
  for (const file of files) {
    const count = countTokenReads(file.content)
    if (count > 0) readSites[file.path] = count
  }

  // L2 需要读到 scope 外的文件（pinia persist），故用合并视图
  const byPath = new Map([...files, ...extraFiles].map((f) => [f.path, f.content]))
  const copies = []
  for (const rule of TOKEN_COPY_RULES) {
    const pattern = new RegExp(rule.pattern.source, rule.pattern.flags)
    if (rule.generic) {
      for (const file of files) {
        if (pattern.test(file.content)) copies.push({ ...rule, file: file.path })
      }
    } else {
      const content = byPath.get(rule.file)
      if (typeof content === 'string' && pattern.test(content)) copies.push({ ...rule, file: rule.file })
    }
  }

  const violations = []

  // L1 token 读取入口
  const baselineReads = baseline.token_read_sites ?? {}
  for (const [file, count] of Object.entries(readSites)) {
    if (file in ALLOWED_TOKEN_READ_FILES) continue
    const allowed = baselineReads[file]
    if (allowed === undefined) {
      violations.push({
        kind: 'token-read-new',
        path: file,
        detail: `${count} 处 token 读取（基线内无此文件）`,
        why: '新增 token 读取点：请改走 matrixClientAccessor.getMatrixAccessToken()，或先在设计文档里登记豁免'
      })
    } else if (count > allowed) {
      violations.push({
        kind: 'token-read-growth',
        path: file,
        detail: `${count} 处 > 基线 ${allowed} 处`,
        why: 'token 读取点增多：旁路扩张，应收敛到 accessor'
      })
    }
  }

  // L2 token 副本
  const baselineCopies = baseline.counters?.token_copies ?? 0
  if (copies.length > baselineCopies) {
    violations.push({
      kind: 'token-copy-growth',
      path: copies.map((c) => c.file).join(', '),
      detail: `副本 ${copies.length} 份 > 基线 ${baselineCopies} 份`,
      why: copies.map((c) => `${c.id}: ${c.why}`).join(' | ')
    })
  }

  // L3 运行时环
  const baselineCycles = baseline.counters?.runtime_cycles ?? 0
  if (cycles.length > baselineCycles) {
    violations.push({
      kind: 'runtime-cycle-growth',
      path: cycles.slice(0, 3).map((c) => c.map((p) => path.posix.relative(SERVICE_DIR, p)).join(' ↔ ')).join(' ; '),
      detail: `含环 SCC ${cycles.length} 个 > 基线 ${baselineCycles} 个`,
      why: '新增运行时循环依赖：会导致初始化顺序敏感、难以分片打包'
    })
  }

  // L4 最长链
  const baselineDepth = baseline.counters?.runtime_max_depth ?? 0
  if (chain.depth > baselineDepth) {
    violations.push({
      kind: 'runtime-depth-growth',
      path: chain.root ? path.posix.relative(SERVICE_DIR, chain.root) : '-',
      detail: `最长链 ${chain.depth} 层 > 基线 ${baselineDepth} 层`,
      why: `新增层级：${[chain.root, ...chain.chain].map((p) => path.posix.relative(SERVICE_DIR, p)).join(' → ')}`
    })
  }

  // 文件数：只锁不增长
  const baselineFiles = baseline.counters?.service_files ?? 0
  if (files.length > baselineFiles) {
    violations.push({
      kind: 'service-file-growth',
      path: SERVICE_DIR,
      detail: `非测试 .ts ${files.length} 个 > 基线 ${baselineFiles} 个`,
      why: '本层文件数是边界守护锚定的设计结果，不设下降目标，但不得继续增长；新服务请按域落位'
    })
  }

  return {
    ok: violations.length === 0,
    checkedFiles: files.length,
    counters: {
      service_files: files.length,
      runtime_edges: [...graph.values()].reduce((sum, set) => sum + set.size, 0),
      runtime_cycles: cycles.length,
      runtime_max_depth: chain.depth,
      token_read_sites: Object.values(readSites).reduce((sum, n) => sum + n, 0),
      token_copies: copies.length
    },
    readSites,
    copies: copies.map((c) => c.id),
    cycles,
    chain: { depth: chain.depth, root: chain.root, chain: chain.chain },
    violations
  }
}

/** 基线快照（供 --update 写入） */
export function buildBaseline(result) {
  return {
    comment:
      'AR-07b 分层与 token 收口棘轮。数值只可收紧不可放宽；清理后运行 `node scripts/check-matrix-service-layering.mjs --update`。',
    updated_at: new Date().toISOString(),
    scope: `${SERVICE_DIR}/** 非测试 .ts（运行时 import 边，不含 import type）`,
    counters: {
      service_files: result.counters.service_files,
      runtime_edges: result.counters.runtime_edges,
      runtime_cycles: result.counters.runtime_cycles,
      runtime_max_depth: result.counters.runtime_max_depth,
      token_copies: result.counters.token_copies
    },
    /** 非白名单文件 → token 接触次数；清理到 0 后应整体消失 */
    token_read_sites: result.readSites
  }
}

/**
 * L2 的副本目标可能落在 scope 外（pinia store），需单独读取。
 * 读不到就返回空 —— 由 `--update` 时的计数体现，不会静默放宽（见 scan 的 copies 判定）。
 */
function collectExtraFiles() {
  const out = []
  for (const rule of TOKEN_COPY_RULES) {
    if (rule.generic || !rule.file) continue
    if (rule.file.startsWith(`${SERVICE_DIR}/`)) continue
    const abs = path.join(projectRoot, rule.file)
    if (fs.existsSync(abs)) out.push({ path: rule.file, content: fs.readFileSync(abs, 'utf8') })
  }
  return out
}

function loadBaseline() {
  const abs = path.join(projectRoot, BASELINE_PATH)
  if (!fs.existsSync(abs)) {
    console.error(`[matrix-layering] scan failed: 基线缺失（${BASELINE_PATH}）`)
    console.error('  首次生成：node scripts/check-matrix-service-layering.mjs --update')
    process.exit(2)
  }
  try {
    return JSON.parse(fs.readFileSync(abs, 'utf8'))
  } catch (err) {
    console.error(`[matrix-layering] scan failed: 基线无法解析（${BASELINE_PATH}）`, err)
    process.exit(2)
  }
}

async function main() {
  const argv = process.argv.slice(2)
  const jsonOutput = argv.includes('--json')
  const verbose = argv.includes('--verbose')
  const update = argv.includes('--update')

  const absDir = path.join(projectRoot, SERVICE_DIR)
  if (!fs.existsSync(absDir)) {
    console.error(`[matrix-layering] scan failed: 目录不存在（${SERVICE_DIR}）`)
    process.exit(2)
  }

  const files = collectSourceFiles(absDir)

  // 基数断言：遍历失效时绝不能静默通过
  if (files.length < MIN_EXPECTED_FILES) {
    console.error(
      `[matrix-layering] scan failed: 仅扫到 ${files.length} 个源文件（基数断言 <${MIN_EXPECTED_FILES}）—— 目录改名或遍历失效`
    )
    process.exit(2)
  }

  if (update) {
    const result = scan(files, { counters: {}, token_read_sites: {} }, collectExtraFiles())
    const snapshot = buildBaseline(result)
    fs.writeFileSync(path.join(projectRoot, BASELINE_PATH), `${JSON.stringify(snapshot, null, 2)}\n`, 'utf8')
    console.log(`[matrix-layering] baseline 已更新 → ${BASELINE_PATH}`)
    console.log(
      `  文件 ${snapshot.counters.service_files} · 边 ${snapshot.counters.runtime_edges} · 环 ${snapshot.counters.runtime_cycles} · 最长链 ${snapshot.counters.runtime_max_depth} · 副本 ${snapshot.counters.token_copies}`
    )
    const sites = Object.entries(snapshot.token_read_sites)
    console.log(`  token 读取文件 ${sites.length} 个：`)
    for (const [file, count] of sites.sort((a, b) => b[1] - a[1])) {
      const allowed = file in ALLOWED_TOKEN_READ_FILES ? '  (白名单)' : ''
      console.log(`    ${String(count).padStart(2)} × ${path.posix.relative(SERVICE_DIR, file)}${allowed}`)
    }
    process.exit(0)
  }

  const baseline = loadBaseline()
  const result = scan(files, baseline, collectExtraFiles())

  if (jsonOutput) {
    process.stdout.write(
      `${JSON.stringify(
        {
          ok: result.ok,
          checkedFiles: result.checkedFiles,
          counters: result.counters,
          copies: result.copies,
          cycles: result.cycles.map((c) => c.map((p) => path.posix.relative(SERVICE_DIR, p))),
          chain: {
            depth: result.chain.depth,
            path: [result.chain.root, ...result.chain.chain].filter(Boolean).map((p) => path.posix.relative(SERVICE_DIR, p))
          },
          violations: result.violations
        },
        null,
        2
      )}\n`
    )
    process.exit(result.ok ? 0 : 1)
  }

  const c = result.counters
  if (result.ok) {
    console.log(
      `[matrix-layering] OK — 文件 ${c.service_files} · 运行时边 ${c.runtime_edges} · 环 ${c.runtime_cycles} · 最长链 ${c.runtime_max_depth} 层 · token 读取 ${c.token_read_sites} 处/副本 ${c.token_copies} 份`
    )
  } else {
    console.error('[matrix-layering] FAIL — AR-07b 分层或 token 收口回退：')
    for (const v of result.violations) {
      console.error(`  [${v.kind}] ${path.posix.relative('.', v.path)}`)
      console.error(`      ${v.detail}`)
      console.error(`      → ${v.why}`)
    }
    console.error('  说明：token 唯一读入口是 matrixClientAccessor.getMatrixAccessToken()；')
    console.error('        新增旁路会让「刷新后陈旧」的窗口变大（MatrixTokenManager 只回写 Rust 侧）。')
  }

  if (verbose) {
    console.log('\n— 最长运行时链 —')
    for (const p of [result.chain.root, ...result.chain.chain].filter(Boolean)) {
      console.log(`  ${path.posix.relative(SERVICE_DIR, p)}`)
    }
    console.log('\n— 含环 SCC —')
    if (result.cycles.length === 0) console.log('  （无）')
    for (const cycle of result.cycles) {
      console.log(`  size ${cycle.length}: ${cycle.map((p) => path.posix.relative(SERVICE_DIR, p)).join(' ↔ ')}`)
    }
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
    console.error('[matrix-layering] unexpected error', err)
    process.exit(2)
  })
}
