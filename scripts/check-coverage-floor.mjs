#!/usr/bin/env node
// biome-ignore-all lint/suspicious/noConsole: This CLI script intentionally writes progress to the terminal.
/**
 * 覆盖率的「棘轮地板」守卫。
 *
 * 为什么需要它：`coverage.thresholds`（见 build/config/vitest.config.base.ts）只回答
 * 「当前是否低于某个绝对值」，无法阻止有人把阈值本身调小。本脚本把地板登记到一个独立、
 * 可评审的文件（scripts/coverage-floor.json），并让 `--update` 只升不降，从而让「覆盖率」
 * 变成一个只会变好、不会悄悄变差的指标：
 *
 *   1. **地板断言**：coverage/coverage-summary.json 的 total 各项 pct 不得低于登记值。
 *   2. **只升不降**：`--update` 只会取 `max(旧值, floor(实测))`，不存在"改小地板"的路径。
 *
 * Exit code:
 *   0 通过
 *   1 断言失败（低于地板）
 *   2 环境或自检失败（报告缺失、无法解析、缺 total）
 *
 * Usage:
 *   node scripts/check-coverage-floor.mjs coverage/coverage-summary.json
 *   node scripts/check-coverage-floor.mjs coverage/coverage-summary.json --update   抬高地板（不会降低）
 */

import { existsSync, readFileSync, statSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const scriptDir = fileURLToPath(new URL('.', import.meta.url))
const floorPath = resolve(scriptDir, 'coverage-floor.json')

/** 需要断言的覆盖率维度（与 coverage-summary.json total 字段一致）。 */
const METRICS = ['lines', 'statements', 'functions', 'branches']

const args = process.argv.slice(2)
const doUpdate = args.includes('--update')
const reportPath = args.find((a) => !a.startsWith('--'))

function fail(message, code = 2) {
  console.error(`[check-coverage-floor] ${message}`)
  process.exit(code)
}

if (!reportPath) fail('用法: node scripts/check-coverage-floor.mjs <coverage-summary.json> [--update]')
if (!existsSync(reportPath)) {
  fail(`找不到覆盖率报告: ${reportPath}\n  （用 vitest --coverage 生成，需启用 json-summary reporter）`)
}

// ⚠️ 新鲜度校验（2026-11-19 加）：本脚本读的是**磁盘上的报告文件**，如果本次测试没跑成功、
// 文件还是上一次留下的，覆盖率断言会拿旧数据「通过」——典型的假绿。
// 历史上 `check:coverage` 还写成 `cmd1 ; cmd2`（分号），cmd1 挂了 cmd2 照样跑，
// 配合这里的旧文件就完全看不出来。两处都已修：脚本侧加新鲜度，package.json 侧改 `&&`。
const MAX_REPORT_AGE_MS = Number(process.env.COVERAGE_MAX_AGE_MS ?? 30 * 60 * 1000)
if (!doUpdate) {
  const ageMs = Date.now() - statSync(reportPath).mtimeMs
  if (ageMs > MAX_REPORT_AGE_MS) {
    const mins = Math.round(ageMs / 60000)
    fail(
      `覆盖率报告过旧：${mins} 分钟前生成（阈值 ${Math.round(MAX_REPORT_AGE_MS / 60000)} 分钟）。\n` +
        `  本次测试很可能没跑成功，读的是上一次的残留报告。\n` +
        `  确需放宽可设 COVERAGE_MAX_AGE_MS=0（跳过本校验）。`
    )
  }
}

let report
try {
  report = JSON.parse(readFileSync(reportPath, 'utf8'))
} catch (err) {
  fail(`覆盖率报告无法解析: ${err.message}`)
}

const total = report.total
if (!total || typeof total !== 'object') {
  fail('覆盖率报告缺少 total 字段 —— 拒绝以「通过」收场（报告可能不完整）')
}

const actual = {}
for (const metric of METRICS) {
  const pct = total[metric]?.pct
  if (typeof pct !== 'number' || Number.isNaN(pct)) {
    fail(`覆盖率报告缺少 total.${metric}.pct —— 拒绝以「通过」收场`)
  }
  actual[metric] = pct
}

if (!existsSync(floorPath)) fail(`找不到地板文件: ${floorPath}`)
const floor = JSON.parse(readFileSync(floorPath, 'utf8'))

if (doUpdate) {
  const next = { ...floor }
  const raised = []
  for (const metric of METRICS) {
    const lifted = Math.max(floor[metric] ?? 0, Math.floor(actual[metric]))
    next[metric] = lifted
    if (lifted > (floor[metric] ?? 0)) raised.push(`${metric} ${floor[metric] ?? 0} → ${lifted}`)
  }
  next.updatedAt = new Date().toISOString()
  writeFileSync(floorPath, `${JSON.stringify(next, null, 2)}\n`, 'utf8')
  console.log(
    raised.length
      ? `地板已抬高: ${raised.join(' / ')}`
      : `地板无需变动（${METRICS.map((m) => `${m} ${actual[m].toFixed(2)}%`).join(' / ')}）`
  )
  process.exit(0)
}

const problems = []
for (const metric of METRICS) {
  const floorValue = floor[metric] ?? 0
  if (actual[metric] < floorValue) {
    problems.push(`${metric} 覆盖率 ${actual[metric].toFixed(2)}% < 地板 ${floorValue}%（覆盖率回退了？）`)
  }
}

console.log('覆盖率实测（地板）:')
for (const metric of METRICS) {
  console.log(`  ${metric}: ${actual[metric].toFixed(2)}%（地板 ${floor[metric] ?? 0}%）`)
}

if (problems.length > 0) {
  console.error(`\nFAIL: ${problems.length} 项断言未通过:`)
  for (const p of problems) console.error(`  - ${p}`)
  process.exit(1)
}

console.log('\nOK: 覆盖率地板满足')
process.exit(0)
