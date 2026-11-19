#!/usr/bin/env node
/**
 * 夹具字面量棘轮：禁止在测试里直接给 mock 传**对象字面量**。
 *
 * ## 为什么
 *
 * `mockResolvedValueOnce({ enabled: true, token: 't' })` 这种写法，**没有任何东西**
 * 保证它长得像后端。实测样本：`getRoomTokenSync` 被 mock 成 `{enabled, token}`，
 * 而后端返回的是 18 键条目 + total/next_batch + summary —— 测试一直绿，测的是
 * 不存在的响应。
 *
 * 改成从 `__tests__/fixtures/*.ts` 取**带类型标注**的夹具后，缺字段/多字段会被
 * `vue-tsc` 直接拦下（已做变异自证：注入 `not_a_real_field` ⇒ TS2353）。
 *
 * 本脚本守的是「有没有绕过夹具」：直接传字面量即视为绕过。
 *
 * ## 棘轮
 *
 * 存量按**文件**计数登记在 `scripts/fixture-literal-baseline.json`，只降不升：
 * - 某文件的字面量数 > 基线 ⇒ FAIL（新增了绕过）
 * - 某文件的字面量数 < 基线 ⇒ 提示可收紧（不 FAIL）
 *
 * 合理例外用行内标记豁免：
 *   mockResolvedValueOnce({ ok: true }) // fixture-literal-ok: 内部 service，非后端响应
 *
 * ## 用法
 *
 *   node scripts/check-fixture-literals.mjs            # 校验
 *   node scripts/check-fixture-literals.mjs --update   # 收紧基线（只下调）
 *   node scripts/check-fixture-literals.mjs --print    # 只看统计不改文件
 */
import { readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const BASELINE_PATH = path.join(ROOT, 'scripts/fixture-literal-baseline.json')
const SCAN_ROOTS = ['src']

/**
 * **只**拦「一次性返回」的字面量：`mockResolvedValueOnce({...})` / `mockReturnValueOnce({...})`。
 *
 * 口径说明（2026-11-19 修正）：早先把 `mockResolvedValue({...})` 也算进来，结果 2147 处里
 * 绝大多数是文件顶部的**默认桩**（`vi.fn().mockResolvedValue({ rooms: [], next_token: undefined })`），
 * 它们的作用只是「没被显式设置时别炸」，不是测试断言的输入。真正会造出「测不存在的响应」
 * 的是 `...Once({...})` —— 那才是测试数据。
 *
 * 默认桩另行统计（`LITERAL_STUB`），只上报不阻断，逐步收敛。
 */
const LITERAL_MOCK = /\bmock(?:Resolved|Returned|Return)?(?:ValueOnce|ResolvedValueOnce)\s*\(\s*\{/g
/** 默认桩（不阻断，仅统计） */
const LITERAL_STUB = /\bmock(?:Resolved|Returned|Return)?(?:Value|ResolvedValue)\s*\(\s*\{/g
const EXEMPT_MARK = /fixture-literal-ok\s*:\s*\S+/

function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    if (name === 'node_modules' || name === '.git') continue
    const full = path.join(dir, name)
    const st = statSync(full)
    if (st.isDirectory()) walk(full, out)
    else if (/\.(test|spec)\.ts$/.test(name)) out.push(full)
  }
  return out
}

/** 统计单个文件里的「字面量 mock」处数（豁免行不计） */
export function countLiterals(source) {
  const lines = source.split('\n')
  let count = 0
  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i]
    LITERAL_MOCK.lastIndex = 0
    if (!LITERAL_MOCK.test(line)) {
      // 允许 `(` 与 `{` 分行的写法
      if (!/\bmock\w*\s*\(\s*$/.test(line)) continue
      if (!(lines[i + 1] ?? '').trimStart().startsWith('{')) continue
    }
    if (EXEMPT_MARK.test(line) || EXEMPT_MARK.test(lines[i + 1] ?? '')) continue
    count += 1
  }
  return count
}

export function scan(roots = SCAN_ROOTS) {
  const counts = {}
  for (const root of roots) {
    const abs = path.join(ROOT, root)
    let files = []
    try {
      files = walk(abs)
    } catch {
      continue
    }
    for (const f of files) {
      const n = countLiterals(readFileSync(f, 'utf8'))
      if (n > 0) counts[path.relative(ROOT, f)] = n
    }
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
    console.log(`[fixture-literals] 当前 ${total} 处，分布在 ${Object.keys(current).length} 个测试文件；Top:`)
    for (const [f, n] of top) console.log(`  ${String(n).padStart(3)}  ${f}`)
    if (!baseline && !doUpdate) {
      console.log('\n[fixture-literals] 尚无基线，请先 `--update` 生成')
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
        '夹具字面量棘轮：测试里 mock 直接传对象字面量的处数，按文件计，只降不升。' +
        '合理例外用行内 `// fixture-literal-ok: <理由>` 豁免。',
      updated_at: new Date().toISOString(),
      counts: next
    }
    writeFileSync(BASELINE_PATH, `${JSON.stringify(payload, null, 2)}\n`, 'utf8')
    const newTotal = Object.values(next).reduce((a, b) => a + b, 0)
    console.log(`[fixture-literals] 基线已写入：${newTotal} 处 / ${Object.keys(next).length} 文件`)
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
    console.log(`[fixture-literals] 可收紧 ${shrunk.length} 个文件（跑 --update 下调基线）`)
  }

  if (grown.length > 0) {
    console.error('[fixture-literals] FAIL — 新增了「mock 直接传对象字面量」：')
    for (const g of grown) {
      console.error(`  ${g.f}: ${g.base} → ${g.now}（+${g.now - g.base}）`)
    }
    console.error('  修法：把响应结构放进 src/**/__tests__/fixtures/*.ts 并**带类型标注**，')
    console.error('        mock 时传夹具变量 —— 这样缺字段/多字段会被 vue-tsc 直接拦下；')
    console.error('        确属内部 structure（非后端响应）可加行内 `// fixture-literal-ok: <理由>`。')
    process.exit(1)
  }

  console.log(
    `[fixture-literals] OK — ${total} 处 / ${Object.keys(current).length} 文件（基线内，无新增）`
  )
}
