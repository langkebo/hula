#!/usr/bin/env node
/**
 * 服务层 Record 棘轮：禁止在 `src/services/matrix/**` 里继续堆 `Record<string, unknown>`。
 *
 * ## 为什么
 *
 * `Record<string, unknown>` 是「我不知道这坨数据长什么样」的匿名声明。它能编译通过，
 * 但把所有字段校验推迟到运行时，等于把 SDK 契约丢掉了。多数位置其实是能从
 * matrix-js-sdk 契约派生出来的（`IContent` / `KeyBackupInfo['auth_data']` /
 * `KeyBackupSession['session_data']` / `ISigned['signatures']` 等）。
 *
 * 确属**动态包**（错误对象、配置包、未建模的事件扩展字段）的，允许保留，但必须
 * 具名（如 `HttpErrorRecord`）并注释说明为什么不能派生 —— 而不是就地写全局 Record。
 *
 * ## 棘轮
 *
 * 存量按**文件**计数登记在 `scripts/service-record-baseline.json`，只降不升：
 * - 某文件处数 > 基线 ⇒ FAIL（新增了匿名 Record）
 * - 某文件处数 < 基线 ⇒ 提示可收紧（不 FAIL）
 *
 * 合理例外用行内标记豁免：
 *   type Foo = Record<string, unknown> // record-type-ok: 配置包，键名由后端插件决定
 *
 * ## 用法
 *
 *   node scripts/check-service-record-types.mjs            # 校验
 *   node scripts/check-service-record-types.mjs --update   # 收紧基线（只下调）
 *   node scripts/check-service-record-types.mjs --print    # 只看统计不改文件
 */
import { readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const BASELINE_PATH = path.join(ROOT, 'scripts/service-record-baseline.json')
const SCAN_ROOT = 'src/services/matrix'

/** 只统计「匿名 Record」，豁免行不计 */
const RECORD = /Record<\s*string\s*,\s*unknown\s*>/g
const EXEMPT_MARK = /record-type-ok\s*:\s*\S+/

function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    if (name === 'node_modules' || name === '.git' || name === '__tests__') continue
    const full = path.join(dir, name)
    const st = statSync(full)
    if (st.isDirectory()) walk(full, out)
    else if (/\.ts$/.test(name) && !/\.(test|spec)\.ts$/.test(name)) out.push(full)
  }
  return out
}

/** 统计单个文件里的匿名 Record 处数（同一行含豁免标记则整行不计） */
export function countRecords(source) {
  let count = 0
  for (const line of source.split('\n')) {
    if (EXEMPT_MARK.test(line)) continue
    RECORD.lastIndex = 0
    const matches = line.match(RECORD)
    if (matches) count += matches.length
  }
  return count
}

export function scan() {
  const counts = {}
  const abs = path.join(ROOT, SCAN_ROOT)
  for (const f of walk(abs)) {
    const n = countRecords(readFileSync(f, 'utf8'))
    if (n > 0) counts[path.relative(ROOT, f)] = n
  }
  return counts
}

function loadBaseline() {
  try {
    return JSON.parse(readFileSync(BASELINE_PATH, 'utf8'))
  } catch {
    return null
  }
}

function isDirectRun() {
  const entry = process.argv[1]
  if (!entry) return false
  try {
    return path.resolve(entry) === path.resolve(fileURLToPath(import.meta.url))
  } catch {
    return false
  }
}

if (isDirectRun()) {
  const doUpdate = process.argv.includes('--update')
  const doPrint = process.argv.includes('--print')
  const current = scan()
  const total = Object.values(current).reduce((a, b) => a + b, 0)
  const baseline = loadBaseline()

  if (doPrint || !baseline) {
    const top = Object.entries(current)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 12)
    console.log(
      `[service-record-types] 当前 ${total} 处，分布在 ${Object.keys(current).length} 个服务文件；Top:`
    )
    for (const [f, n] of top) console.log(`  ${String(n).padStart(3)}  ${f}`)
    if (!baseline && !doUpdate) {
      console.log('\n[service-record-types] 尚无基线，请先 `--update` 生成')
      process.exit(0)
    }
  }

  if (doUpdate) {
    // 只降不升：取 min(当前, 基线)
    const prev = baseline?.counts ?? {}
    const next = {}
    for (const [f, n] of Object.entries(current)) {
      next[f] = prev[f] === undefined ? n : Math.min(prev[f], n)
    }
    const payload = {
      comment:
        '服务层匿名 Record 棘轮：src/services/matrix 下 Record<string, unknown> 的处数，按文件计，只降不升。' +
        '能从 SDK 契约派生的必须派生；确属动态包必须具名并注释，行内 `// record-type-ok: <理由>` 豁免。',
      updated_at: new Date().toISOString(),
      counts: next
    }
    writeFileSync(BASELINE_PATH, `${JSON.stringify(payload, null, 2)}\n`, 'utf8')
    const newTotal = Object.values(next).reduce((a, b) => a + b, 0)
    console.log(`[service-record-types] 基线已写入：${newTotal} 处 / ${Object.keys(next).length} 文件`)
    process.exit(0)
  }

  const baseCounts = baseline.counts ?? {}
  const grown = []
  const shrunk = []
  for (const [f, n] of Object.entries(current)) {
    const base = baseCounts[f] ?? 0
    if (n > base) grown.push({ f, base, now: n })
    else if (n < base) shrunk.push({ f, base, now: n })
  }
  for (const [f, base] of Object.entries(baseCounts)) {
    if (!(f in current) && base > 0) shrunk.push({ f, base, now: 0 })
  }

  if (shrunk.length > 0) {
    console.log(`[service-record-types] 可收紧 ${shrunk.length} 个文件（跑 --update 下调基线）`)
  }

  if (grown.length > 0) {
    console.error('[service-record-types] FAIL — 新增了匿名 `Record<string, unknown>`：')
    for (const g of grown) {
      console.error(`  ${g.f}: ${g.base} → ${g.now}（+${g.now - g.base}）`)
    }
    console.error('  修法：从 matrix-js-sdk 契约派生（IContent / KeyBackupInfo 等）；')
    console.error('        确属动态包请具名并注释，必须保留时加行内 `// record-type-ok: <理由>`。')
    process.exit(1)
  }

  console.log(
    `[service-record-types] OK — ${total} 处 / ${Object.keys(current).length} 文件（基线内，无新增）`
  )
}
