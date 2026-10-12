#!/usr/bin/env node
/**
 * check-bare-matrix-paths — 前端裸 Matrix 路径门禁（批次 L / §9.14.4 盲区 2）。
 *
 * 判据（L2）：Tjg 源码中每一个**可静态解析**的 Matrix/Synapse API 路径字面量，
 * 必须命中 SDK 契约路由表（安装产物 `matrix-js-sdk/contract`，即钉版 tarball 内的
 * 39 张 route-table）∪ **后端权威路径集**。
 *
 * 后端权威（C-1，spec §7 C-1 / §8 C-1）：权威口径为 synapse-rust 导出 ledger 的
 * **distinct path 数 814**（entry_count 1027 是 (method, path) 条目数，非 distinct path，
 * 二者差 213 属单位口径差异，非覆盖缺口）。权威来源优先级：
 *   `--manifest <path>` 覆盖 > sibling `../matrix-js-sdk` 在场时的新鲜 manifest >
 *   本地 vendored 快照 `scripts/contract-authority-paths.json`（`--sync-authority` 刷新）。
 * 判据面 = SDK 契约 ∪ 权威路径；差集（权威 \ 判据面）必须为 0，否则失败（除非显式登记）。
 *
 * 抽取范围（L1）：
 *   1. 全 src/** 的绝对 API 形态字面量：`/_matrix/`、`/_synapse/`、`/.well-known/`
 *      （字符串/模板字面量均支持；注释不计——tokenizer 剥离；`*.d.ts` 跳过）；
 *   2. `src/services/matrix/paths/**` 的**相对**路径（如 '/createRoom'）——按前缀候选
 *      （SDK 默认 v3 + prefixes.ts 常量值）补全后再比对
 *      （L1 教训：不算默认前缀会把 '/register/captcha/status' 误判成不存在）；
 *   3. `${PREFIX_X}/...` 模板与 `PREFIX_X + '...'` 拼接：代入前缀常量/模块内局部常量后比对。
 *      多段变量拼接等抽不到的形态落「unresolved」具名桶（只降不升）。
 *   4. 前缀**本体**（如 '/_matrix/client/v3'、`MSC4354_PREFIX`）不是端点，按结构识别
 *      （值 ∈ prefixes.ts 常量值，或由 `*PREFIX*`/`*_BASE*` 命名的常量）
 *      进 prefixRoots 桶，不算违规。
 *   5. 末段为占位符且存在更长路由以该 head 开头 ⇒ 动态尾段（如 MatrixHttpClient 的
 *      `${PREFIX_V3}/user/${userId}/${suffix}`），进 dynamicTails 桶，不算违规。
 *
 * 台账（L3）：`scripts/bare-matrix-paths-baseline.json`
 *   - inventory：命中路径 → 出现文件（键集棘轮**只降不升**，新增需 --accept-new）；
 *   - knownDefects：命中失败的路径——**真缺陷**，显式登记（含 tracking/证据），不得静默；
 *   - prefixRoots / dynamicTails / unresolved：命名桶，只降不升；**台账腐烂**（缺陷已修
 *     但条目未回收）硬失败。
 *
 * 用法：
 *   node scripts/check-bare-matrix-paths.mjs                    # 门禁（默认）
 *   node scripts/check-bare-matrix-paths.mjs --json             # 机器可读报告
 *   node scripts/check-bare-matrix-paths.mjs --strict           # knownDefects 也当违规（修复批次用）
 *   node scripts/check-bare-matrix-paths.mjs --accept-new       # 接受本次新增路径并写台账
 *   node scripts/check-bare-matrix-paths.mjs --update-baseline  # 刷新台账
 *   node scripts/check-bare-matrix-paths.mjs --report           # 写 C-1 差集报告（CI 产物）
 *   node scripts/check-bare-matrix-paths.mjs --sync-authority   # 从 sibling/--manifest 刷新本地权威快照
 *
 * 退出码：0 通过；1 违规/回归；2 扫描失败。
 */

import { readdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const projectRoot = path.resolve(__dirname, '..')
const srcRoot = path.join(projectRoot, 'src')
const pathsDir = path.join(srcRoot, 'services', 'matrix', 'paths')
const prefixesFile = path.join(pathsDir, 'prefixes.ts')
const baselineFile = path.join(projectRoot, 'scripts', 'bare-matrix-paths-baseline.json')
// C-1：后端权威路径的**本地 vendored 快照**（CI 无 sibling 时的判据面来源，见 spec §7 C-1 / §8 C-1）。
const authorityFile = path.join(projectRoot, 'scripts', 'contract-authority-paths.json')
// C-1：差集报告（CI 产物）与「剩余项登记理由」表。
const diffReportFile = path.join(projectRoot, 'scripts', 'contract-judgment-diff.json')
const registeredFile = path.join(projectRoot, 'scripts', 'contract-judgment-diff-registered.json')

const args = process.argv.slice(2)
const argSet = new Set(args)
const jsonOutput = argSet.has('--json')
const strictMode = argSet.has('--strict')
const updateBaseline = argSet.has('--update-baseline')
const acceptNew = argSet.has('--accept-new') || updateBaseline
const writeReport = argSet.has('--report')
const syncAuthorityFlag = argSet.has('--sync-authority')
const manifestOverride = args.includes('--manifest') ? args[args.indexOf('--manifest') + 1] : null

const FILE_EXT = /\.(ts|tsx|vue)$/
const SKIP_DIR = /(^|\/)(node_modules|dist|dist-electron|coverage|__tests__|typings)(\/|$)/
const TEST_FILE = /\.(spec|test)\.[cm]?[jt]sx?$/
const SKIP_FILE = /\.d\.ts$|(^|\/)sdk-paths\.ts$/
const API_SHAPE = /^\/(_matrix|_synapse|\.well-known)\//

/* ------------------------------------------------------------------ */
/* 1. 前缀常量 / 前缀本体 / 路由表                                       */
/* ------------------------------------------------------------------ */

async function loadPrefixConstants() {
  const text = await readFile(prefixesFile, 'utf8')
  const consts = {}
  for (const m of text.matchAll(/export\s+const\s+([A-Z][A-Z0-9_]*)\s*=\s*['"]([^'"]+)['"]/g)) {
    consts[m[1]] = m[2]
  }
  return consts
}

/** 前缀本体单一来源：prefixes.ts 常量值（前缀解析已随批次 B-1 收敛到 SDK，本地表删除）。 */
async function loadPrefixRoots(prefixConsts) {
  const roots = new Set(Object.values(prefixConsts))
  roots.add('/_matrix/') // startsWith('/_matrix/') 守卫字符串，非端点
  return roots
}

async function loadSdkRoutes() {
  const paths = new Map()
  let count = 0
  try {
    const mod = await import('matrix-js-sdk/contract')
    count = mod.SDK_CONTRACT_ROUTES.length
    for (const r of mod.SDK_CONTRACT_ROUTES) if (!paths.has(r.path)) paths.set(r.path, 'sdk-contract')
  } catch (err) {
    console.error(`扫描失败：无法导入安装产物的 SDK 契约路由表（matrix-js-sdk/contract）：${err.message}`)
    process.exit(2)
  }
  return { count, paths }
}

/** sibling 新鲜 manifest 路径（`../matrix-js-sdk` 在场时可用；CI 无 sibling）。 */
function siblingManifestPath() {
  return path.resolve(projectRoot, '..', 'matrix-js-sdk', 'docs', 'api-contract', 'generated', 'route-manifest.all.json')
}

/** 从 manifest 抽取 **distinct path 集**（去重；entry 数另计）。 */
export function distinctPathsFromManifest(manifest) {
  const entries = manifest.entries || manifest.routes || []
  const set = new Set()
  for (const e of entries) if (e.path) set.add(e.path)
  return set
}

async function readManifest(p) {
  const m = JSON.parse(await readFile(p, 'utf8'))
  const entries = m.entries || m.routes || []
  return {
    paths: distinctPathsFromManifest(m),
    entryCount: entries.length,
    meta: {
      schema_version: m.schema_version ?? null,
      generated_at: m.generated_at ?? null,
      synapse_rust_commit: m.synapse_rust_commit ?? null,
      state_profile: m.state_profile ?? null,
    },
  }
}

/**
 * 后端权威路径集（C-1）。来源优先级：`--manifest` 覆盖 > sibling 新鲜 manifest > 本地 vendored 快照。
 * 无论哪条来源，**distinct path 集合**即权威口径（entry_count 的 (method, path) 口径另存于 meta）。
 */
async function loadBackendAuthority() {
  if (manifestOverride) {
    try {
      return { source: 'manifest-override', sourcePath: manifestOverride, ...(await readManifest(manifestOverride)) }
    } catch (err) {
      console.error(`扫描失败：--manifest 不可读：${manifestOverride}（${err.message}）`)
      process.exit(2)
    }
  }
  const sib = siblingManifestPath()
  try {
    return { source: 'sibling-manifest', sourcePath: sib, ...(await readManifest(sib)) }
  } catch {
    // 无 sibling（如 CI）：回落到本地 vendored 快照
  }
  try {
    const m = JSON.parse(await readFile(authorityFile, 'utf8'))
    return {
      source: 'vendored-snapshot',
      sourcePath: authorityFile,
      paths: new Set(m.paths || []),
      entryCount: m.entry_count ?? null,
      meta: {
        schema_version: m.schema_version ?? null,
        generated_at: m.generated_at ?? null,
        synapse_rust_commit: m.synapse_rust_commit ?? null,
        state_profile: m.state_profile ?? null,
      },
    }
  } catch (err) {
    console.error(
      `扫描失败：无法加载后端权威路径（sibling manifest 缺失且本地快照不可读）：${authorityFile}（${err.message}）`
    )
    process.exit(2)
  }
}

/** C-1 差集：权威路径 \ 判据面；未登记项须失败，已登记项进「剩余理由」清单。 */
export function computeContractDiff({ authorityPaths, surfacePaths, registeredPaths = [] }) {
  const reg = new Set(registeredPaths)
  const missing = [...authorityPaths].filter((p) => !surfacePaths.has(p)).sort()
  return {
    missingFromSurface: missing.filter((p) => !reg.has(p)),
    registeredRemaining: missing.filter((p) => reg.has(p)),
  }
}

async function loadRegistered() {
  try {
    const m = JSON.parse(await readFile(registeredFile, 'utf8'))
    return Array.isArray(m.registered) ? m.registered : []
  } catch {
    return []
  }
}

/** 由 sibling/--manifest 刷新本地权威快照（`--sync-authority`）。 */
async function syncAuthority() {
  const src = manifestOverride ? path.resolve(manifestOverride) : siblingManifestPath()
  let manifest
  try {
    manifest = JSON.parse(await readFile(src, 'utf8'))
  } catch (err) {
    console.error(`同步失败：权威 manifest 不可读：${src}（${err.message}）`)
    process.exit(2)
  }
  const entries = manifest.entries || manifest.routes || []
  const paths = [...distinctPathsFromManifest(manifest)].sort()
  const out = {
    schema_version: '1',
    generated_at: new Date().toISOString(),
    source: path.relative(projectRoot, src),
    upstream: {
      schema_version: manifest.schema_version ?? null,
      generated_at: manifest.generated_at ?? null,
      synapse_rust_commit: manifest.synapse_rust_commit ?? null,
      state_profile: manifest.state_profile ?? null,
    },
    synapse_rust_commit: manifest.synapse_rust_commit ?? null,
    state_profile: manifest.state_profile ?? null,
    entry_count: entries.length,
    distinct_path_count: paths.length,
    note:
      'synapse-rust 导出 ledger 的 distinct path 权威快照（C-1）。entry_count 为 (method, path) 条目数；' +
      'distinct_path_count 才是判据面口径。由 scripts/check-bare-matrix-paths.mjs --sync-authority 生成。',
    paths,
  }
  await writeFile(authorityFile, formatJsonForBiome(out) + '\n', 'utf8')
  console.log(
    `[bare-matrix-paths] 已刷新权威快照 ${path.relative(projectRoot, authorityFile)}：` +
      `entries=${entries.length}，distinct paths=${paths.length}，来源 ${path.relative(projectRoot, src)}`
  )
}

function routeTemplateToRegExp(template) {
  const escaped = template.replace(/[.*+?^${}()|[\]\\]/g, (c) => (c === '{' ? '{' : c === '}' ? '}' : `\\${c}`))
  return new RegExp('^' + escaped.replace(/\{[^}]+\}/g, '[^/]+') + '$')
}

/* ------------------------------------------------------------------ */
/* 2. tokenizer：剥注释（保留字符串）/ 收字面量                          */
/* ------------------------------------------------------------------ */

/** 剥注释但**原样保留**字符串与模板字面量（concat 解析依赖字面量原值）。 */
export function stripComments(source) {
  let out = ''
  let i = 0
  const n = source.length
  while (i < n) {
    const c = source[i]
    if (c === '/' && source[i + 1] === '/') {
      while (i < n && source[i] !== '\n') i++
      continue
    }
    if (c === '/' && source[i + 1] === '*') {
      i += 2
      while (i < n && !(source[i] === '*' && source[i + 1] === '/')) {
        if (source[i] === '\n') out += '\n'
        i++
      }
      i += 2
      continue
    }
    if (c === "'" || c === '"') {
      const q = c
      out += c
      i++
      while (i < n && source[i] !== q) {
        if (source[i] === '\\') {
          out += source[i] + (source[i + 1] ?? '')
          i += 2
        } else {
          out += source[i]
          i++
        }
      }
      out += q
      i++
      continue
    }
    if (c === '`') {
      out += c
      i++
      let depth = 0
      while (i < n) {
        const ch = source[i]
        if (ch === '\\') {
          out += ch + (source[i + 1] ?? '')
          i += 2
          continue
        }
        if (ch === '$' && source[i + 1] === '{') {
          depth++
          out += '${'
          i += 2
          continue
        }
        if (ch === '}' && depth > 0) depth--
        if (ch === '`' && depth === 0) {
          out += '`'
          i++
          break
        }
        out += ch
        i++
      }
      continue
    }
    out += c
    i++
  }
  return out
}

/** 收集字符串/模板字面量（含 `${...}` 原文）。返回 [{ raw, isTemplate }]。 */
export function extractStringLiterals(source) {
  const out = []
  let i = 0
  const n = source.length
  while (i < n) {
    const c = source[i]
    if (c === "'" || c === '"') {
      const q = c
      i++
      let raw = ''
      while (i < n && source[i] !== q) {
        if (source[i] === '\\') {
          raw += source[i] + (source[i + 1] ?? '')
          i += 2
        } else {
          raw += source[i]
          i++
        }
      }
      i++
      out.push({ raw, isTemplate: false })
      continue
    }
    if (c === '`') {
      i++
      let raw = ''
      let depth = 0
      while (i < n) {
        const ch = source[i]
        if (ch === '\\') {
          raw += ch + (source[i + 1] ?? '')
          i += 2
          continue
        }
        if (ch === '$' && source[i + 1] === '{') {
          depth++
          raw += '${'
          i += 2
          continue
        }
        if (ch === '}' && depth > 0) {
          depth--
          raw += '}'
          i++
          continue
        }
        if (ch === '`' && depth === 0) {
          i++
          break
        }
        raw += ch
        i++
      }
      out.push({ raw, isTemplate: true })
      continue
    }
    i++
  }
  return out
}

/* ------------------------------------------------------------------ */
/* 3. 归一化                                                            */
/* ------------------------------------------------------------------ */

/** 模块内局部常量：`const NAME = '...'` 或 `const NAME = GLOBAL_CONST`。 */
function collectLocalConsts(code, globalConsts) {
  const locals = {}
  for (const m of code.matchAll(/\b(?:const|let)\s+([A-Za-z_$][\w$]*)\s*=\s*'([^']*)'/g)) locals[m[1]] = m[2]
  for (const m of code.matchAll(/\b(?:const|let)\s+([A-Za-z_$][\w$]*)\s*=\s*([A-Z][A-Z0-9_]*)\b/g)) {
    if (globalConsts[m[2]] !== undefined) locals[m[1]] = globalConsts[m[2]]
  }
  return locals
}

/** 形如 `X_UNSTABLE_PREFIX` / `SYNAPSE_ADMIN_BASE` 的常量值是**前缀本体**而非端点。 */
function collectLocalPrefixRoots(code, prefixConsts) {
  const roots = new Set()
  for (const m of code.matchAll(/\b(?:const|let)\s+([A-Za-z_$][\w$]*)\s*=\s*'([^']*)'/g)) {
    if (/(PREFIX|_BASE|_ROOT)/.test(m[1])) roots.add(m[2])
  }
  // 模板形态（`const NAME = \`${PREFIX_X}/seg\`` 之类）：代入已知常量后若仍是 API 形态，
  // 同样按前缀本体的命名语义收进桶（否则会被当成"未命中路由"的假缺陷）。
  for (const m of code.matchAll(/\b(?:const|let)\s+([A-Za-z_$][\w$]*)\s*=\s*`([^`]*)`/g)) {
    if (!/(PREFIX|_BASE|_ROOT)/.test(m[1])) continue
    const resolved = m[2].replace(/\$\{\s*([A-Za-z_$][\w$]*)\s*\}/g, (whole, name) =>
      prefixConsts[name] !== undefined ? prefixConsts[name] : whole
    )
    if (API_SHAPE.test(resolved)) roots.add(resolved)
  }
  return roots
}

/** 动态尾段：末段是占位符且存在更长路由以该 head 开头 ⇒ 具名桶（非缺陷）。 */
function segsOf(p) {
  return p.split('/').filter(Boolean)
}
function looksLikeDynamicTail(norm, routeTemplates) {
  const ns = segsOf(norm)
  if (ns.length < 4 || ns[ns.length - 1] !== '{p}') return false
  const head = ns.slice(0, -1)
  return routeTemplates.some((rs) => {
    const r = segsOf(rs)
    if (r.length <= ns.length) return false
    for (let i = 0; i < head.length; i++) {
      if (head[i] !== '{p}' && r[i] !== head[i]) return false
      if (head[i] === '{p}' && !r[i].startsWith('{')) return false
    }
    return true
  })
}

/** `${...}` → `{p}`（含嵌套，逐步内层优先）；去查询串；full URL → path；截取 API 形态后缀。 */
function normalizeLiteral(raw, isTemplate, consts) {
  let s = raw
  if (isTemplate) {
    let prev = null
    while (prev !== s) {
      prev = s
      s = s.replace(/\$\{\s*([A-Za-z_$][\w$]*)\s*\}/g, (whole, name) => (consts[name] !== undefined ? consts[name] : '{p}'))
      s = s.replace(/\$\{[^{}]*\}/g, '{p}')
    }
  }
  const q = s.indexOf('?')
  if (q >= 0) s = s.slice(0, q)
  const urlM = s.match(/^https?:\/\/[^/]*(\/.*)$/)
  if (urlM) s = urlM[1]
  // 形如 `${baseUrl}/_matrix/...` 或 'https://h/_matrix/...' → 截取 API 形态后缀
  const shapeIdx = s.search(/(?:\/_matrix\/|\/_synapse\/|\.well-known\/)/)
  if (shapeIdx > 0 && s[shapeIdx] === '/') s = s.slice(shapeIdx)
  return s
}

/** 代码区行内 `CONST + 'lit'` / `'lit' + CONST` 拼接（保留字符串的文本上做，逐行以避免回溯）。 */
function resolveConcats(code, consts) {
  const resolved = []
  const unresolved = []
  const CONST_FIRST = /\b([A-Z][A-Z0-9_]*)\s*\+\s*'([^']*)'/
  const LIT_FIRST = /'([^']*)'\s*\+\s*\b([A-Z][A-Z0-9_]*)\b/
  for (const line of code.split('\n')) {
    if (!line.includes('+')) continue
    let m = CONST_FIRST.exec(line)
    if (m) {
      if (consts[m[1]] === undefined) {
        if (API_SHAPE.test(m[2]) || m[1].startsWith('PREFIX_')) unresolved.push({ snippet: m[0].slice(0, 80) })
      } else resolved.push(consts[m[1]] + m[2])
      continue
    }
    m = LIT_FIRST.exec(line)
    if (m) {
      if (consts[m[2]] === undefined) {
        if (API_SHAPE.test(m[1]) || m[2].startsWith('PREFIX_')) unresolved.push({ snippet: m[0].slice(0, 80) })
      } else resolved.push(m[1] + consts[m[2]])
    }
  }
  return { resolved, unresolved }
}

/* ------------------------------------------------------------------ */
/* 4. 扫描                                                             */
/* ------------------------------------------------------------------ */

async function walk(dir, acc) {
  let entries
  try {
    entries = await readdir(dir, { withFileTypes: true })
  } catch {
    return acc
  }
  for (const e of entries) {
    const full = path.join(dir, e.name)
    const rel = path.relative(projectRoot, full)
    if (e.isDirectory()) {
      if (SKIP_DIR.test(rel)) continue
      await walk(full, acc)
    } else if (FILE_EXT.test(e.name) && !TEST_FILE.test(e.name) && !SKIP_FILE.test(rel)) {
      acc.push({ full, rel })
    }
  }
  return acc
}

export async function scanBarePaths({ files, prefixConsts, prefixRoots, pathsDirRel }) {
  const inventory = new Map() // norm -> Set(rel)
  const foundPrefixRoots = new Set()
  const unresolved = []
  for (const { full, rel } of files) {
    let source
    try {
      source = await readFile(full, 'utf8')
    } catch (err) {
      return { error: `无法读取 ${rel}: ${err.message}` }
    }
    const code = stripComments(source)
    const consts = { ...prefixConsts, ...collectLocalConsts(code, prefixConsts) }
    const localRoots = collectLocalPrefixRoots(code, prefixConsts)
    const inPathsTable = rel.startsWith(pathsDirRel + path.sep)
    const found = new Set()
    for (const lit of extractStringLiterals(code)) {
      const norm = normalizeLiteral(lit.raw, lit.isTemplate, consts)
      if (!norm) continue
      if (prefixRoots.has(norm) || localRoots.has(norm)) {
        foundPrefixRoots.add(norm)
        continue
      }
      const api = API_SHAPE.test(norm)
      if (!api && !(inPathsTable && norm.startsWith('/'))) continue
      found.add(norm)
    }
    for (const norm of found) {
      if (!inventory.has(norm)) inventory.set(norm, new Set())
      inventory.get(norm).add(rel)
    }
    for (const p of resolveConcats(code, consts).resolved) {
      const norm = normalizeLiteral(p, false, consts)
      if (prefixRoots.has(norm) || localRoots.has(norm)) continue
      if (!API_SHAPE.test(norm) && !(inPathsTable && norm.startsWith('/'))) continue
      if (!inventory.has(norm)) inventory.set(norm, new Set())
      inventory.get(norm).add(rel)
    }
    for (const x of resolveConcats(code, consts).unresolved) unresolved.push({ file: rel, ...x })
  }
  return { inventory, prefixRoots: foundPrefixRoots, unresolved }
}

/* ------------------------------------------------------------------ */
/* 5. 匹配与台账                                                        */
/* ------------------------------------------------------------------ */

function prefixCandidates(prefixConsts, prefixRoots) {
  const set = new Set(['/_matrix/client/v3', ...Object.values(prefixConsts), ...prefixRoots])
  return [...set]
}

function matchPath(norm, routeRegexes, prefixCands) {
  if (API_SHAPE.test(norm)) return routeRegexes.some((re) => re.test(norm))
  return prefixCands.some((pfx) => routeRegexes.some((re) => re.test(pfx + norm)))
}

async function loadBaseline() {
  try {
    return JSON.parse(await readFile(baselineFile, 'utf8'))
  } catch {
    return null
  }
}

/**
 * 已修缺陷的沿革（evidence trail；证据已回源 synapse-rust 源码/守卫测试复核）。
 *
 * ⚠️ **本表只作历史记录，不参与豁免判定**：若某条路径被重新引入，它会被当作
 * 「未登记缺陷」直接失败 —— 不会因为这里留着条目而被放行（避免"历史即豁免"的纸面门禁）。
 */
const DEFECT_HISTORY = {
  '/_matrix/admin/v1/whoami': {
    tracking: 'L-D01',
    severity: 'latent',
    consumer: 'MATRIX_WHOAMI（admin.ts 常量，生产零调用点）',
    reason:
      '后端已移除 /_matrix/admin/v1* 命名空间（synapse-rust external_service.rs:420 注释「原先还挂了一份 /_matrix/admin/v1/external_services*」）。正式形态：/_synapse/admin/v1/whoami、/_matrix/client/v1|v3/account/whoami。',
  },
  '/_matrix/client/v1/rooms/{p}/report/{p}/scanner_info': {
    tracking: 'L-D02',
    severity: 'latent',
    consumer: 'MATRIX_PATHS.ROOM.REPORT_SCANNER_INFO（ReportService 实际走 vendor/v1，常量本身错误）',
    reason:
      '正式形态 /_matrix/vendor/v1/rooms/{room_id}/report/{event_id}/scanner_info（synapse-rust derived_route_table_always.inc.rs:3327；Tjg timeline.account.contract.test.ts 亦断言 vendor/v1）。client/v1 形态后端零命中。',
  },
  '/_matrix/client/v3/rooms/{p}/sticky_events': {
    tracking: 'L-D03',
    severity: 'live',
    consumer: 'SynapseStickyEventService.getStickyEvents',
    reason:
      '正式形态 /_matrix/client/unstable/org.matrix.msc4354/rooms/{room_id}/sticky_events（synapse-rust derived_route_table_always.inc.rs:207）。v3 形态零命中 ⇒ 404。',
  },
  '/_matrix/client/v3/rooms/{p}/sticky_events/{p}': {
    tracking: 'L-D04',
    severity: 'live',
    consumer: 'SynapseStickyEventService.setStickyEvent/clearStickyEvent',
    reason: '正式形态 .../msc4354/rooms/{room_id}/sticky_events/{event_type}（同 L-D03）。v3 形态零命中 ⇒ 404。',
  },
  '/_matrix/client/v3/rooms/{p}/summary': {
    tracking: 'L-D05',
    severity: 'live',
    consumer: 'SynapseRoomSummaryService.getRoomSummary ← SummaryService',
    reason:
      '后端守卫测试 room_module.rs:372-374 显式断言 client/v3 rooms/{room_id}/summary 计数为 0（「私有 room summary 仍挂在 client v3 前缀下」）。正式形态 /_matrix/client/v1/rooms/{room_id}/summary 或 /_matrix/vendor/v1/... ⇒ v3 恒 404。',
  },
  '/_matrix/client/v3/rooms/{p}/summary/members': {
    tracking: 'L-D06',
    severity: 'live',
    consumer: 'SynapseRoomSummaryService',
    reason: '正式形态 /_matrix/vendor/v1/rooms/{room_id}/summary/members（room_module.rs:371 断言）。v3 形态零命中。',
  },
  '/_matrix/client/v3/rooms/{p}/summary/state': {
    tracking: 'L-D07',
    severity: 'live',
    consumer: 'SynapseRoomSummaryService',
    reason: '正式形态 /_matrix/vendor/v1/rooms/{room_id}/summary/state。v3 形态零命中。',
  },
  '/_matrix/client/v3/rooms/{p}/summary/stats': {
    tracking: 'L-D08',
    severity: 'live',
    consumer: 'SynapseRoomSummaryService',
    reason: '正式形态 /_matrix/vendor/v1/rooms/{room_id}/summary/stats。v3 形态零命中。',
  },
  '/_synapse/admin/v2/users/{p}/deactivate': {
    tracking: 'L-D09',
    severity: 'latent',
    consumer: 'ADMIN.USER_DEACTIVATE（生产零调用点）',
    reason:
      '正式形态 /_synapse/admin/v1/users/{user_id}/deactivate（synapse-rust admin_auth.rs:501/533 断言 v1）。v2 形态零命中 ⇒ 404。',
  },
  '/rooms/{p}/widgets/{p}/send': {
    tracking: 'L-D10',
    severity: 'latent',
    consumer: 'WIDGET.SEND（生产零调用点）',
    reason:
      '后端 widget 面无 /send 端点（仅有 /_matrix/vendor/v1/rooms/{room_id}/widgets/{widget_id}/capabilities、/_matrix/vendor/v1/widgets/{widget_id}/config 等）。任意前缀候选均零命中 ⇒ 404。',
  },
}

/**
 * biome 兼容的 JSON 序列化：短的基本类型数组折成单行（`expand: "auto"`），
 * 否则 `pnpm lint`（biome check）会因格式不符报错 —— 落盘物必须过格式化器。
 */
export function formatJsonForBiome(value, indent = '') {
  const pad = indent + '  '
  if (Array.isArray(value)) {
    const inline = '[' + value.map((v) => JSON.stringify(v)).join(', ') + ']'
    if (!value.some((v) => v !== null && typeof v === 'object') && pad.length + inline.length <= 120) return inline
    if (value.length === 0) return '[]'
    return '[\n' + value.map((v) => pad + formatJsonForBiome(v, pad)).join(',\n') + '\n' + indent + ']'
  }
  if (value !== null && typeof value === 'object') {
    const keys = Object.keys(value)
    if (keys.length === 0) return '{}'
    return (
      '{\n' +
      keys.map((k) => pad + JSON.stringify(k) + ': ' + formatJsonForBiome(value[k], pad)).join(',\n') +
      '\n' +
      indent +
      '}'
    )
  }
  return JSON.stringify(value)
}

export async function runGate({ tracking = {} } = {}) {
  const prefixConsts = await loadPrefixConstants()
  const prefixRoots = await loadPrefixRoots(prefixConsts)
  const sdk = await loadSdkRoutes()
  const authority = await loadBackendAuthority()
  const registered = await loadRegistered()

  // 判据面 = SDK 契约 ∪ 后端权威路径（C-1：把权威并入判据面，消除口径缺口）。
  const paths = new Map(sdk.paths)
  let authorityAdded = 0
  for (const p of authority.paths) {
    if (!paths.has(p)) {
      paths.set(p, 'backend-authority')
      authorityAdded++
    }
  }
  const sources = [
    `sdk-contract(installed): ${sdk.count}`,
    `backend-authority(${authority.source}): ${authority.paths.size}（并入判据面 +${authorityAdded}）`,
  ]
  const surfacePaths = new Set(paths.keys())
  const contractDiff = computeContractDiff({
    authorityPaths: authority.paths,
    surfacePaths,
    registeredPaths: registered.map((r) => r.path),
  })
  const sdkContractCovered = [...authority.paths].filter((p) => sdk.paths.has(p)).length

  const routeRegexes = [...paths.keys()].map(routeTemplateToRegExp)
  const prefixCands = prefixCandidates(prefixConsts, prefixRoots)

  const files = await walk(srcRoot, [])
  const scan = await scanBarePaths({ files, prefixConsts, prefixRoots, pathsDirRel: path.relative(projectRoot, pathsDir) })
  if (scan.error) {
    console.error(`扫描失败：${scan.error}`)
    process.exit(2)
  }
  const { inventory, prefixRoots: usedPrefixRoots, unresolved } = scan

  const baseline = await loadBaseline()
  const knownDefects = (baseline && baseline.knownDefects) || {}
  const baseInventory = (baseline && baseline.inventory) || {}
  const baseUnresolved = (baseline && baseline.unresolved) || []

  const report = {
    generatedAt: new Date().toISOString(),
    routeSources: sources,
    routeCount: paths.size,
    scannedFiles: files.length,
    matchedPaths: 0,
    knownDefects: 0,
    prefixRoots: usedPrefixRoots.size,
    unresolved: unresolved.length,
    contractDiff: {
      authoritySource: authority.source,
      authoritySourcePath: path.relative(projectRoot, authority.sourcePath),
      authorityEntriesMethodPath: authority.entryCount,
      authorityDistinctPaths: authority.paths.size,
      surfaceDistinctPaths: surfacePaths.size,
      sdkContractPaths: sdk.paths.size,
      sdkContractCoveredAuthorityPaths: sdkContractCovered,
      authorityRequiringVendored: authority.paths.size - sdkContractCovered,
      missingFromSurface: contractDiff.missingFromSurface.length,
      registeredRemaining: contractDiff.registeredRemaining.length,
    },
  }

  const defects = []
  const dynamicTails = []
  const routeTemplates = [...paths.keys()]
  for (const [norm, fileSet] of [...inventory.entries()].sort(([a], [b]) => a.localeCompare(b))) {
    if (matchPath(norm, routeRegexes, prefixCands)) continue
    const entry = { path: norm, files: [...fileSet].sort() }
    if (looksLikeDynamicTail(norm, routeTemplates)) {
      dynamicTails.push(entry)
      continue
    }
    const tracked = knownDefects[norm]
    if (tracked) {
      entry.tracking = tracked.tracking || null
      entry.reason = tracked.reason || null
    }
    defects.push(entry)
  }

  const newPaths = Object.keys(baseInventory).length ? [...inventory.keys()].filter((k) => !(k in baseInventory)) : []
  const removedPaths = Object.keys(baseInventory).filter((k) => !inventory.has(k))
  const untrackedDefects = defects.filter((d) => !knownDefects[d.path])
  const fixedDefects = Object.keys(knownDefects).filter((k) => !defects.some((d) => d.path === k))
  const unresolvedGrew = unresolved.length > baseUnresolved.length

  const problems = []
  if (contractDiff.missingFromSurface.length) {
    problems.push(
      `C-1 契约差集：${contractDiff.missingFromSurface.length} 条后端权威路径不在判据面内（判据面未覆盖后端 ⇒ 裸调写错不报）：` +
        contractDiff.missingFromSurface.map((p) => `\n  ${p}`).join('') +
        `\n  （如确属有意排除，登记到 ${path.relative(projectRoot, registeredFile)} 并附理由）`
    )
  }
  if (untrackedDefects.length) {
    problems.push(
      `发现 ${untrackedDefects.length} 条未登记缺陷路径（裸调命中失败，W-02/W-03/W-04 形态 404）：` +
        untrackedDefects.map((u) => `\n  ${u.path}  <- ${u.files.join(', ')}`).join('')
    )
  }
  if (strictMode && defects.length) {
    problems.push(
      `--strict：${defects.length} 条已登记缺陷仍存在（修复批次要求清零）：` +
        defects.map((d) => `\n  [${d.tracking || '?'}] ${d.path}`).join('')
    )
  }
  if (fixedDefects.length && !updateBaseline) {
    problems.push(
      `台账腐烂：${fixedDefects.length} 条 knownDefects 已不复现（缺陷应已修复）——请跑 --update-baseline 回收条目：` +
        fixedDefects.map((k) => `\n  [${knownDefects[k].tracking || '?'}] ${k}`).join('')
    )
  }
  if (newPaths.length && !acceptNew) {
    problems.push(
      `新增 ${newPaths.length} 条裸路径（棘轮只降不升；确属新增需 --accept-new 显式接受）：` +
        newPaths.map((p) => `\n  ${p}  <- ${[...inventory.get(p)].join(', ')}`).join('')
    )
  }
  if (unresolvedGrew) problems.push(`unresolved 桶 ${baseUnresolved.length} → ${unresolved.length}（只降不升）`)

  const wrote = updateBaseline || (acceptNew && !problems.length)
  if (wrote) {
    const nextKnown = {}
    for (const d of defects) {
      nextKnown[d.path] = knownDefects[d.path] || {
        tracking: tracking[d.path] || 'L-fix-pending',
        severity: 'unknown',
        reason: '命中失败：后端 manifest/SDK 路由表无此路径（疑似 404）',
        files: d.files,
      }
    }
    const next = {
      generatedAt: new Date().toISOString(),
      routeSources: sources,
      note:
        'knownDefects = 当前未修的裸调 404 缺陷（须为 0 或显式登记；--strict 时失败）。history = 已修缺陷沿革（仅记录，不参与豁免）。',
      defectEvidence: '每条缺陷已回源 synapse-rust 后端源码/守卫测试复核（证据见各条 reason 字段）。',
      inventory: Object.fromEntries(
        [...inventory.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([k, v]) => [k, { files: [...v].sort() }])
      ),
      knownDefects: nextKnown,
      history: Object.entries(DEFECT_HISTORY)
        .map(([p, v]) => ({ path: p, ...v, status: 'fixed' }))
        .sort((a, b) => a.tracking.localeCompare(b.tracking)),
      dynamicTails: dynamicTails.map((d) => ({ path: d.path, files: d.files })),
      prefixRoots: [...usedPrefixRoots].sort(),
      unresolved: unresolved.map((u) => ({ file: u.file, snippet: u.snippet })).sort((a, b) => a.file.localeCompare(b.file)),
    }
    await writeFile(baselineFile, formatJsonForBiome(next) + '\n', 'utf8')
    void fixedDefects
  }

  report.matchedPaths = inventory.size - defects.length - dynamicTails.length
  report.knownDefects = defects.length
  report.dynamicTails = dynamicTails.length

  if (writeReport) {
    const diffReport = {
      generatedAt: report.generatedAt,
      spec: 'C-1（§7 C-1 / §8 C-1）：契约口径单一化 —— 后端权威 distinct path 为 814，判据面向上对齐并记录差集',
      calibre: {
        note:
          '权威 ledger entry_count=1027 为 (method, path) 条目数；distinct path=814 才是判据面口径。' +
          '1027-814=213 属单位口径差异，非覆盖缺口（spec §2.1/§5 P2-6 旧结论按此口径修正）。',
      },
      authority: {
        source: authority.source,
        sourcePath: path.relative(projectRoot, authority.sourcePath),
        entryCountMethodPath: authority.entryCount,
        distinctPaths: authority.paths.size,
        upstream: authority.meta,
      },
      judgmentSurface: {
        distinctPaths: surfacePaths.size,
        sources,
        sdkContractPaths: sdk.paths.size,
        authorityOnlyPaths: authority.paths.size - sdkContractCovered,
      },
      diff: {
        missingFromSurface: contractDiff.missingFromSurface,
        registeredRemaining: registered.filter((r) => contractDiff.registeredRemaining.includes(r.path)),
      },
    }
    await writeFile(diffReportFile, formatJsonForBiome(diffReport) + '\n', 'utf8')
  }

  return { report, defects, dynamicTails, untrackedDefects, fixedDefects, newPaths, removedPaths, unresolved, problems, wrote }
}

const isDirectRun = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
if (isDirectRun) {
  if (syncAuthorityFlag) {
    await syncAuthority()
    process.exit(0)
  }
  const r = await runGate()
  if (jsonOutput) {
    console.log(JSON.stringify({ ...r.report, problems: r.problems }, null, 2))
  } else {
    console.log(`[bare-matrix-paths] 路由源：${r.report.routeSources.join(' | ')}（判据面共 ${r.report.routeCount} 条）`)
    const cd = r.report.contractDiff
    console.log(
      `[bare-matrix-paths] C-1 契约差集：权威 ${cd.authorityDistinctPaths} distinct（ledger ${cd.authorityEntriesMethodPath} 条目，源 ${cd.authoritySource}）` +
        ` vs 判据面 ${cd.surfaceDistinctPaths} ⇒ 缺 ${cd.missingFromSurface}（已登记剩余 ${cd.registeredRemaining}）`
    )
    console.log(
      `[bare-matrix-paths] 扫描 ${r.report.scannedFiles} 文件：命中 ${r.report.matchedPaths}，登记缺陷 ${r.report.knownDefects}，动态尾段 ${r.report.dynamicTails}，前缀本体 ${r.report.prefixRoots}，unresolved ${r.report.unresolved}`
    )
    if (r.fixedDefects.length) console.log(`[bare-matrix-paths] 缺陷已消除 ${r.fixedDefects.length} 条 ✅`)
    if (r.removedPaths.length) console.log(`[bare-matrix-paths] 台账回收 ${r.removedPaths.length} 条（棘轮下降 ✅）`)
    if (r.defects.length) {
      console.log(`[bare-matrix-paths] 已登记缺陷 ${r.defects.length} 条（显式登记，非静默；--strict 下会失败）：`)
      for (const d of r.defects) console.log(`  [${d.tracking || '?'}] ${d.path}  <- ${d.files.join(', ')}`)
    }
    if (r.problems.length) {
      for (const p of r.problems) console.error(`❌ ${p}`)
      process.exit(1)
    }
    console.log(`✅ 裸 Matrix 路径判据通过（未登记缺陷 0，台账一致）`)
  }
  process.exit(r.problems.length ? 1 : 0)
}
