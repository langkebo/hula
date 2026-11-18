#!/usr/bin/env node
/**
 * ROOM-03 覆盖率审计：vendor 房间级端点 ↔ Tjg 触点。
 *
 * 为什么需要这个脚本（2026-11-18 复盘）：
 * 同一批端点被反复误判为「零触点」，根因是检索口径不一致 ——
 *   · 只搜路径字面量 → 漏掉经 SDK manager 封装的调用（ROOM-09 scanner_info）；
 *   · 只搜新方法名 → 漏掉 SDK 的旧名映射（`redactThreadReply` → `/replies/{e}/redact`）；
 *   · 只搜 facade 名 → 漏掉 UI 直接调 service（`adminService.reports.getScannerInfo`）。
 * 本脚本把三路证据（路径字面量 / SDK 方法名 / 旧名映射）串起来，输出可复核的表格，
 * 并且**对无法自动判定的条目输出 NEEDS-REVIEW**，不猜「已接」也不猜「未接」。
 *
 * 用法：
 *   node scripts/audit/room-vendor-endpoint-coverage.mjs \
 *     [--tjg ../Tjg] [--sdk ../matrix-js-sdk] [--routes ../synapse-rust/docs/synapse-rust/ROUTE_HANDLERS.json]
 *
 * 只读：不写任何仓库文件，表格输出到 stdout。
 */
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join, resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const HERE = dirname(fileURLToPath(import.meta.url))

const args = Object.fromEntries(
  process.argv
    .slice(2)
    .join(' ')
    .split('--')
    .filter(Boolean)
    .map((chunk) => {
      const [key, ...rest] = chunk.trim().split(/\s+/)
      return [key, rest.join(' ') || true]
    })
)

const TJG = resolve(args.tjg || join(HERE, '../..'))
const SDK = resolve(args.sdk || join(TJG, '../matrix-js-sdk'))
const ROUTES = args.routes || join(TJG, '../synapse-rust/docs/synapse-rust/ROUTE_HANDLERS.json')

const SKIP_DIRS = new Set(['node_modules', 'dist', '__tests__', '__generated__', '.git'])

function walk(root, exts) {
  const out = []
  const visit = (dir) => {
    let entries
    try {
      entries = readdirSync(dir)
    } catch {
      return
    }
    for (const name of entries) {
      if (SKIP_DIRS.has(name)) continue
      const full = join(dir, name)
      let stat
      try {
        stat = statSync(full)
      } catch {
        continue
      }
      if (stat.isDirectory()) visit(full)
      else if (exts.some((ext) => name.endsWith(ext))) {
        try {
          out.push({ path: full, text: readFileSync(full, 'utf8') })
        } catch {
          /* 读不了就跳过，审计工具不该因单个文件中断 */
        }
      }
    }
  }
  visit(root)
  return out
}

const sdkFiles = walk(join(SDK, 'src'), ['.ts'])
const tjgFiles = walk(join(TJG, 'src'), ['.ts', '.vue'])

/** SDK 侧的旧名 → 新名映射（`threading/index.ts` 的对照表），用于补第三路证据 */
const sdkAliasPairs = (() => {
  const pairs = new Map()
  for (const file of sdkFiles) {
    if (!file.path.endsWith('threading/index.ts')) continue
    for (const line of file.text.split('\n')) {
      const m = line.match(/^\s*\*\s*\|\s*`(\w+)`\s*\|\s*`(\w+)`\s*\|/)
      if (m) pairs.set(m[1], m[2])
      if (m) pairs.set(m[2], m[1])
    }
  }
  return pairs
})()

const signatureRe = /(?:public\s+|private\s+|protected\s+)?async\s+([A-Za-z_$][\w$]*)\s*\(/

/**
 * 在 SDK 中找到「真正发起该端点」的方法名。
 *
 * 做法（刻意不用正则拼路径模板，那对 `{id}` 夹在中间的情况极脆）：
 *   1. 在该文件里找**同一行**同时包含全部静态段（如 `event` 与 `/url`）且含 `/rooms/` 的行；
 *   2. 从该行向上找最近的 `async NAME(` —— 中间若又出现别的方法声明，说明匹配跑偏，跳过。
 */
function findSdkMethod(staticSegments) {
  const needles = ['/rooms/', ...staticSegments]
  for (const file of sdkFiles) {
    const lines = file.text.split('\n')
    for (let i = 0; i < lines.length; i += 1) {
      const line = lines[i]
      if (!needles.every((needle) => line.includes(needle))) continue
      // 向上最多看 40 行：太远说明命中的是相邻方法（曾把 pinned_events 的三条都
      // 归到同一个方法上），宁可靠 NEEDS-REVIEW 交人工，也不要输出错的证据。
      for (let j = i; j >= Math.max(0, i - 40); j -= 1) {
        const m = signatureRe.exec(lines[j])
        if (m && !['if', 'for', 'while', 'switch', 'catch', 'function'].includes(m[1])) {
          return { method: m[1], file: file.path.replace(`${SDK}/`, '') }
        }
      }
    }
  }
  return null
}

/** Tjg 侧触点：方法名（新名 + 旧名）∪ 路径片段 */
function findTjgHits(method, alias, pathFragment) {
  const needles = [method, alias, pathFragment].filter(Boolean)
  const hits = []
  for (const file of tjgFiles) {
    const matched = needles.find((needle) => needle && file.text.includes(needle))
    if (matched) hits.push({ file: file.path.replace(`${TJG}/`, ''), matched })
  }
  return hits
}

const routes = JSON.parse(readFileSync(ROUTES, 'utf8')).routes.filter((r) =>
  r.path.startsWith('/_matrix/vendor/v1/rooms/{room_id}')
)

const short = (path) => path.replace('/_matrix/vendor/v1/rooms/{room_id}', '…')

const rows = []
for (const route of routes) {
  const rawSegments = route.path.split('/').slice(5).filter(Boolean)
  const tail = rawSegments.filter((seg) => !seg.startsWith('{'))
  const fragment = tail.length >= 2 ? `/${tail[0]}/${tail[1]}` : `/${tail[tail.length - 1] ?? ''}`
  const sdkHit = findSdkMethod(tail)
  const method = sdkHit?.method ?? null
  const alias = method ? (sdkAliasPairs.get(method) ?? null) : null
  const hits = findTjgHits(method, alias, fragment)

  let verdict
  if (hits.length > 0) verdict = 'WIRED'
  else if (!method) verdict = 'NEEDS-REVIEW（SDK 未定位到方法）'
  else verdict = 'NOT-WIRED（方法名与路径均无命中）'

  rows.push({
    method: route.method,
    path: short(route.path),
    sdkMethod: method ? `${method}()${alias ? ` [旧名 ${alias}]` : ''}` : '—',
    tjg:
      hits.length > 0
        ? hits
            .slice(0, 2)
            .map((h) => `${h.file}`)
            .join('<br>')
        : '—',
    verdict
  })
}

const wired = rows.filter((r) => r.verdict === 'WIRED').length
const review = rows.filter((r) => r.verdict.startsWith('NEEDS-REVIEW')).length
const notWired = rows.filter((r) => r.verdict.startsWith('NOT-WIRED')).length

console.log(`# vendor 房间级端点覆盖率（${rows.length} 条）\n`)
console.log(`- WIRED：${wired}`)
console.log(`- NEEDS-REVIEW：${review}`)
console.log(`- NOT-WIRED：${notWired}`)
console.log(`\n> 口径：WIRED 需命中「SDK 方法名 / 旧名映射 / 路径片段」任一；`)
console.log(`> NEEDS-REVIEW 表示 SDK 里定位不到发起方法（可能经通用 request 直发），需人工确认。\n`)

console.log('| HTTP | 端点 | SDK 方法 | Tjg 触点 | 判定 |')
console.log('| :--- | :--- | :--- | :--- | :--- |')
for (const row of rows) {
  if (row.verdict === 'WIRED') continue
  console.log(`| ${row.method} | ${row.path} | ${row.sdkMethod} | ${row.tjg} | ${row.verdict} |`)
}

console.log('\n## 已接线条目（仅列端点）\n')
console.log(
  rows
    .filter((r) => r.verdict === 'WIRED')
    .map((r) => `${r.method} ${r.path}`)
    .join('<br>')
)
