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

import { existsSync, readFileSync, writeFileSync } from 'node:fs'
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
