#!/usr/bin/env node
// biome-ignore-all lint/suspicious/noConsole: This CLI script intentionally writes progress to the terminal.
/**
 * 全量单元套件的「基数断言」守卫。
 *
 * 为什么需要它：把 `pnpm test:run` 接进 CI 只是第一步——一个「跑当前发现到的用例」的门禁
 * 可以被一行 `exclude` 悄悄架空（谁都不会注意到套件从 200 个文件缩到 20 个）。本脚本对
 * vitest 的 JSON 报告做两组断言，把「覆盖面」变成可执行的：
 *
 *   1. **计数地板**（`scripts/unit-suite-floor.json`）：测试文件数与用例数不得低于登记值。
 *      地板**只升不降**：`--update` 只会取 `max(旧值, 当前值)`，因此不存在"改小地板"的路径。
 *   2. **目录覆盖**：若干关键目录必须至少各有一个用例文件被执行到。计数地板拦不住
 *      「整块目录被 exclude、同时别处新增了文件」这种替换。
 *
 * Exit code:
 *   0 通过
 *   1 断言失败（低于地板 / 目录覆盖缺失 / 报告里有失败用例）
 *   2 环境或自检失败（报告缺失、无法解析、报告为空）
 *
 * Usage:
 *   node scripts/check-unit-suite-floor.mjs <vitest-json-report>
 *   node scripts/check-unit-suite-floor.mjs <report> --update   抬高地板（不会降低）
 */

import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { resolve, relative, sep } from 'node:path'
import { fileURLToPath } from 'node:url'

const scriptDir = fileURLToPath(new URL('.', import.meta.url))
const repoRoot = resolve(scriptDir, '..')
const floorPath = resolve(scriptDir, 'unit-suite-floor.json')

/** 必须被覆盖到的目录（相对 repo 根，posix 分隔符）。 */
const REQUIRED_DIRS = [
  'src/services/matrix/admin',
  'src/services/matrix/user',
  'src/services/matrix/notifications',
  'src/services/matrix/media',
  'src/services/matrix/room',
  'src/components/workbench',
  'src/locales',
  'src/utils',
  'tests/unit',
  'tests/lint'
]

const args = process.argv.slice(2)
const doUpdate = args.includes('--update')
const reportPath = args.find((a) => !a.startsWith('--'))

function fail(message, code = 2) {
  console.error(`[check-unit-suite-floor] ${message}`)
  process.exit(code)
}

if (!reportPath) fail('用法: node scripts/check-unit-suite-floor.mjs <vitest-json-report> [--update]')
if (!existsSync(reportPath)) {
  fail(`找不到 vitest JSON 报告: ${reportPath}\n  （用 --reporter=json --outputFile.json=<path> 生成）`)
}

let report
try {
  report = JSON.parse(readFileSync(reportPath, 'utf8'))
} catch (err) {
  fail(`JSON 报告无法解析: ${err.message}`)
}

const resultFiles = Array.isArray(report.testResults) ? report.testResults : []
if (resultFiles.length === 0) {
  fail('报告里没有 testResults —— 拒绝以「通过」收场（套件可能根本没跑）')
}
const totalTests = Number(report.numTotalTests ?? 0)
if (totalTests === 0) fail('报告里 numTotalTests = 0 —— 拒绝以「通过」收场')

if (!existsSync(floorPath)) fail(`找不到地板文件: ${floorPath}`)
const floor = JSON.parse(readFileSync(floorPath, 'utf8'))

const relPaths = resultFiles.map((r) => relative(repoRoot, r.name).split(sep).join('/'))
const actual = { testFiles: resultFiles.length, tests: totalTests }

if (doUpdate) {
  const next = {
    ...floor,
    testFiles: Math.max(floor.testFiles ?? 0, actual.testFiles),
    tests: Math.max(floor.tests ?? 0, actual.tests),
    updatedAt: new Date().toISOString()
  }
  writeFileSync(floorPath, `${JSON.stringify(next, null, 2)}\n`, 'utf8')
  const raised = []
  if (next.testFiles > (floor.testFiles ?? 0)) raised.push(`testFiles ${floor.testFiles ?? 0} → ${next.testFiles}`)
  if (next.tests > (floor.tests ?? 0)) raised.push(`tests ${floor.tests ?? 0} → ${next.tests}`)
  console.log(
    raised.length ? `地板已抬高: ${raised.join(' / ')}` : `地板无需变动（当前 ${actual.testFiles} 文件 / ${actual.tests} 用例）`
  )
  process.exit(0)
}

const problems = []
if (actual.testFiles < (floor.testFiles ?? 0)) {
  problems.push(`测试文件数 ${actual.testFiles} < 地板 ${floor.testFiles}（套件被缩小了？）`)
}
if (actual.tests < (floor.tests ?? 0)) {
  problems.push(`用例数 ${actual.tests} < 地板 ${floor.tests}（套件被缩小了？）`)
}
for (const dir of REQUIRED_DIRS) {
  if (!relPaths.some((p) => p.startsWith(`${dir}/`))) {
    problems.push(`关键目录未被任何用例覆盖: ${dir}`)
  }
}
const failedTests = Number(report.numFailedTests ?? 0)
if (failedTests > 0) {
  problems.push(`报告中有 ${failedTests} 个失败用例（本步骤作为独立判据，不依赖上一步的退出码）`)
}

console.log(`执行的测试文件: ${actual.testFiles}（地板 ${floor.testFiles}）`)
console.log(`执行的用例数: ${actual.tests}（地板 ${floor.tests}）`)
console.log(`覆盖的关键目录: ${REQUIRED_DIRS.length - problems.filter((p) => p.includes('关键目录')).length}/${REQUIRED_DIRS.length}`)

if (problems.length > 0) {
  console.error(`\nFAIL: ${problems.length} 项断言未通过:`)
  for (const p of problems) console.error(`  - ${p}`)
  process.exit(1)
}

console.log('\nOK: 套件地板与目录覆盖均满足')
process.exit(0)
