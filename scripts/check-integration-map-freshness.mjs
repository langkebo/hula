#!/usr/bin/env node
// biome-ignore-all lint/suspicious/noConsole: This CLI script intentionally writes progress to the terminal.
/**
 * Guard: 集成图谱的**量化声明**必须与当前代码/契约台账一致。
 *
 * 问题（图谱 §8.5 D1）：`docs/Tjg-SDK-集成架构与能力图谱-2026-10-08.md` 里的数字（后端路由数、
 * 服务文件数、SDK 管理器数、commit 锚点…）写于 2026-10-08，此后后端与 SDK 都有大批优化，
 * 数字大面积失效 **而没有任何门禁会红** —— `check:doc-paths` 只校验路径存在，不校验数字与行号。
 * 本轮实测差异：路由 1159 → 1027、私有面 35.2% → 51.8%、服务文件 220 → 215。
 *
 * 做法：文档里放一个**机器可读的标记块**（`<!-- numbers:begin -->` … `<!-- numbers:end -->`），
 * 每行 `key=value`；本守卫从权威来源现场计算每个 key，与文档值比对，不一致即红。
 * 权威来源：契约台账 `route-manifest.all.json`、pin 文件 `meta/sdk-pin.json`、
 * 以及仓库/已安装依赖的实时扫描。
 *
 * Exit code:
 *   0  全部一致
 *   1  存在不一致（打印 key / 文档值 / 实测值）
 *   2  环境或自检异常（标记块缺失、权威来源读不到、实测值为 0 —— 基数断言）
 *
 * Usage:
 *   node scripts/check-integration-map-freshness.mjs
 *   node scripts/check-integration-map-freshness.mjs --json
 *   node scripts/check-integration-map-freshness.mjs --print   # 只打印实测值（便于更新文档）
 */

import { readdirSync, readFileSync, statSync, existsSync } from 'node:fs'
import { join, resolve, relative, sep } from 'node:path'
import { fileURLToPath } from 'node:url'

/**
 * 解析仓库根：脚本自身位置优先，其次 cwd；两者都必须能看见 `src/services/matrix`，
 * 否则抛错（避免静默扫错目录）。在 vitest（`import.meta.url` 非 file: scheme）下靠 cwd 兜底。
 */
export function resolveRepoRoot() {
  const candidates = []
  try {
    candidates.push(resolve(fileURLToPath(new URL('.', import.meta.url)), '..'))
  } catch {
    // vitest 下不是 file: scheme
  }
  candidates.push(process.cwd())
  for (const candidate of candidates) {
    if (existsSync(join(candidate, 'src/services/matrix'))) return candidate
  }
  throw new Error(`无法定位仓库根（候选：${candidates.join(', ')}）`)
}

const repoRoot = resolveRepoRoot()

export const MAP_DOC = 'docs/Tjg-SDK-集成架构与能力图谱-2026-10-08.md'
export const MARKER_BEGIN = '<!-- numbers:begin -->'
export const MARKER_END = '<!-- numbers:end -->'
export const MANIFEST = '../matrix-js-sdk/docs/api-contract/generated/route-manifest.all.json'
export const SDK_PIN = 'meta/sdk-pin.json'

const SKIP_DIR = new Set(['node_modules', 'dist', 'coverage', '.worktrees'])

/**
 * 判定一条路由是否落在**私有命名空间**下。
 *
 * 图谱 §9 D 与 `private_routes` 指标共用这一口径；两侧必须一致，否则会得出互相矛盾的结论。
 */
export function isPrivatePath(path) {
  const value = String(path ?? '')
  return value.startsWith('/_matrix/vendor/') || value.startsWith('/_synapse/')
}

/**
 * 「私有语义」关键词表 —— 用于度量「尚未迁到私有前缀、仍压在标准 Matrix 前缀上」的私有面。
 *
 * 这是**观测口径**，不是待办清单：某个关键词归零只说明那类私有语义已经迁完（好事），
 * 因此不要为归零加断言。真正要防止的是**整张表与后端路由面脱节**（见 collectActual 的基数断言）。
 */
export const PRIVATE_SEMANTICS = ['friends', 'spaces', 'threads', 'summary', 'widgets', 'report', 'voice', 'sticky']

/**
 * 纯函数：解析文档标记块里的 `key=value`。
 * @param {string} text
 * @returns {Record<string, string> | null} 找不到标记块返回 null
 */
export function parseMarkerBlock(text) {
  const source = String(text ?? '')
  const begin = source.indexOf(MARKER_BEGIN)
  const end = source.indexOf(MARKER_END)
  if (begin < 0 || end < begin) return null
  const body = source.slice(begin + MARKER_BEGIN.length, end)
  const values = {}
  for (const line of body.split('\n')) {
    const match = /^\s*[-*]?\s*([a-z0-9_]+)\s*=\s*([^\s#]+)\s*(?:#.*)?$/i.exec(line)
    if (match) values[match[1]] = match[2]
  }
  return values
}

/**
 * 纯函数：比对文档值与实测值。
 * @param {{ documented: Record<string,string>, actual: Record<string,string|number> }} input
 */
export function evaluateFreshness({ documented, actual } = {}) {
  const mismatches = []
  const missing = []
  for (const [key, value] of Object.entries(actual ?? {})) {
    const docValue = documented?.[key]
    if (docValue === undefined) {
      missing.push({ key, actual: String(value) })
      continue
    }
    if (String(value) !== String(docValue)) {
      mismatches.push({ key, documented: String(docValue), actual: String(value) })
    }
  }
  return { ok: mismatches.length === 0, mismatches, missing, checked: Object.keys(actual ?? {}).length }
}

function countFiles(dir, predicate) {
  let total = 0
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
      total += countFiles(full, predicate)
    } else if (predicate(full)) {
      total += 1
    }
  }
  return total
}

/** 现场计算所有受管指标 */
export function collectActual({ root = repoRoot, requireManifest = false } = {}) {
  const actual = {}
  /** 无法实测的指标（例如 CI 里没有兄弟仓的契约台账）—— 必须显式声明，不能静默通过 */
  const unavailable = []

  // —— 契约台账（后端路由面）——
  const manifestPath = resolve(root, MANIFEST)
  const routeKeys = ['backend_routes', 'private_routes', 'route_modules', 'ledger_schema', 'synapse_rust_commit', 'state_profile']
  if (!existsSync(manifestPath)) {
    if (requireManifest) throw new Error(`契约台账不存在: ${MANIFEST}（需要 matrix-js-sdk 兄弟仓）`)
    unavailable.push(...routeKeys.map((key) => ({ key, reason: `缺少契约台账 ${MANIFEST}（需兄弟仓）` })))
  } else {
    const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'))
    const entries = manifest.entries ?? []
    if (entries.length === 0) throw new Error('契约台账 entries 为空（基数断言）')

    actual.backend_routes = entries.length
    actual.private_routes = entries.filter((e) => isPrivatePath(e.path)).length
    actual.route_modules = new Set(entries.map((e) => e.registered_by ?? '?')).size
    actual.ledger_schema = manifest.schema_version
    actual.synapse_rust_commit = String(manifest.synapse_rust_commit ?? '').slice(0, 9)
    actual.state_profile = manifest.state_profile

    // —— 「私有语义仍压在标准前缀上」（2026-10-13 新增受管指标）——
    //
    // ⚠️ 口径固定为「命中关键词 **且** 路径不在 `/_matrix/vendor/` 或 `/_synapse/` 之下」。
    // 旧稿（图谱 §9 D 第一版）用的是**全量路径子串**计数，会把 `/_matrix/vendor/v1/.../friends`
    // 这类**已经迁移到位**的路由也算成"挂在标准前缀上"，数字比实际大一个数量级，
    // 而且与"仍挂在标准前缀上"这句话自相矛盾。把口径钉死在门禁里，避免再退回去。
    const keywordMatches = entries.filter((e) => PRIVATE_SEMANTICS.some((k) => String(e.path).includes(k))).length
    // 基数断言：关键词若在后端路由里整体消失，说明关键词表已过期、指标失去意义 —— 不许静默全 0。
    if (keywordMatches === 0) {
      throw new Error(`关键词表与契约台账完全不相交（${PRIVATE_SEMANTICS.join('/')}）—— 请更新关键词表（基数断言）`)
    }
    for (const keyword of PRIVATE_SEMANTICS) {
      actual[`private_on_std_${keyword}`] = entries.filter(
        (e) => String(e.path).includes(keyword) && !isPrivatePath(e.path)
      ).length
    }
  }

  // —— pin 文件 ——
  const pin = JSON.parse(readFileSync(resolve(root, SDK_PIN), 'utf8'))
  actual.sdk_version = pin.sdk_version
  actual.sdk_commit = String(pin.sdk_commit ?? '').slice(0, 9)

  // —— 服务面 ——
  const servicesRoot = resolve(root, 'src/services/matrix')
  const isTest = (p) => /\.(test|spec)\.[cm]?ts$/.test(p)
  actual.matrix_service_files = countFiles(servicesRoot, (p) => p.endsWith('.ts') && !isTest(p))
  actual.matrix_service_tests = countFiles(servicesRoot, (p) => isTest(p))
  actual.base_matrix_service_subclasses = countFiles(
    servicesRoot,
    (p) => p.endsWith('.ts') && !isTest(p) && readFileSync(p, 'utf8').includes('extends BaseMatrixService')
  )

  // —— Tauri command ——
  const commandDir = resolve(root, 'src-tauri/src/command')
  if (!existsSync(commandDir)) throw new Error('src-tauri/src/command 不存在')
  actual.tauri_command_modules = readdirSync(commandDir).filter((f) => f.endsWith('.rs') && f !== 'mod.rs').length

  // —— SDK（已安装依赖）——
  const sdkLib = resolve(root, 'node_modules/matrix-js-sdk/lib')
  if (!existsSync(sdkLib)) throw new Error('node_modules/matrix-js-sdk 未安装 —— 请先 pnpm install')
  const managerAccessors = new Set()
  const walkDts = (dir) => {
    for (const entry of readdirSync(dir)) {
      const full = join(dir, entry)
      let st
      try {
        st = statSync(full)
      } catch {
        continue
      }
      if (st.isDirectory()) walkDts(full)
      else if (entry.endsWith('.d.ts')) {
        const text = readFileSync(full, 'utf8')
        for (const match of text.matchAll(/\b(get[A-Z]\w*Manager)\s*\(\)\s*:/g)) managerAccessors.add(match[1])
      }
    }
  }
  walkDts(sdkLib)
  actual.sdk_manager_accessors = managerAccessors.size

  const managerTypes = join(sdkLib, 'manager-extensions/types.d.ts')
  if (existsSync(managerTypes)) {
    const toggles = new Set(readFileSync(managerTypes, 'utf8').matchAll(/(include[A-Z]\w*)\?:/g))
    actual.sdk_manager_toggles = [...toggles].length
  }

  // 基数断言：可实测的关键指标不得为 0
  for (const key of ['matrix_service_files', 'base_matrix_service_subclasses', 'tauri_command_modules']) {
    if (!actual[key]) throw new Error(`实测指标 ${key} = ${actual[key]}（基数断言失败）`)
  }
  if (actual.backend_routes !== undefined && !actual.backend_routes) {
    throw new Error('实测指标 backend_routes = 0（基数断言失败）')
  }

  return { ...actual, __unavailable: unavailable }
}

async function main() {
  const emitJson = process.argv.includes('--json')
  const printOnly = process.argv.includes('--print')

  let actual
  try {
    actual = collectActual({ requireManifest: process.argv.includes('--require-manifest') })
  } catch (err) {
    console.error(`[integration-map-freshness] scan failed: ${err.message}`)
    process.exit(2)
  }

  if (printOnly) {
    for (const [key, value] of Object.entries(actual)) console.log(`${key}=${value}`)
    process.exit(0)
  }

  const docPath = resolve(repoRoot, MAP_DOC)
  if (!existsSync(docPath)) {
    console.error(`[integration-map-freshness] scan failed: 找不到 ${MAP_DOC}`)
    process.exit(2)
  }
  const documented = parseMarkerBlock(readFileSync(docPath, 'utf8'))
  if (!documented) {
    console.error(
      `[integration-map-freshness] scan failed: ${MAP_DOC} 缺少标记块 ${MARKER_BEGIN} … ${MARKER_END}（基数断言）`
    )
    process.exit(2)
  }

  const { __unavailable: unavailable = [], ...measured } = actual
  const unchecked = Object.keys(documented).filter((key) => measured[key] === undefined)
  const result = { ...evaluateFreshness({ documented, actual: measured }), actual: measured, documented, unavailable, unchecked }

  if (emitJson) {
    process.stdout.write(`${JSON.stringify(result, null, 2)}\n`)
  } else if (result.ok) {
    console.log(`[integration-map-freshness] OK — ${result.checked} 项指标与代码/台账一致（${MAP_DOC}）`)
    if (unavailable.length > 0) {
      console.log(`\nWARN: ${unavailable.length} 项指标**未实测**（本次跳过，不等于通过）:`)
      for (const item of unavailable) console.log(`  - ${item.key}: ${item.reason}`)
    }
    if (unchecked.length > 0) {
      console.log(`提示：文档里另有 ${unchecked.length} 项标记未纳入实测: ${unchecked.join(', ')}`)
    }
    if (result.missing.length > 0) {
      console.log(`提示：文档标记块未声明 ${result.missing.length} 项实测指标（建议补上以便继续受管）:`)
      for (const m of result.missing) console.log(`  - ${m.key}=${m.actual}`)
    }
  } else {
    console.error(`[integration-map-freshness] FAIL — ${result.mismatches.length} 项与实测不符:`)
    for (const m of result.mismatches) {
      console.error(`  ${m.key}: 文档=${m.documented}  实测=${m.actual}`)
    }
    console.error('  修法：重跑 `node scripts/check-integration-map-freshness.mjs --print`，更新标记块与正文数字。')
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
    console.error('[integration-map-freshness] unexpected error', err)
    process.exit(2)
  })
}
