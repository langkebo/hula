#!/usr/bin/env node
/**
 * 服务端探针统一入口 —— 让 10 个 `scripts/*probe*.mjs` 从「靠人记命令」变成一条命令。
 *
 * 背景：10 个探针里只有 `probe:admin` 有 npm script，其余 9 个只写在
 * 联调报告 §五「复跑命令速查」里，还各自依赖不同的环境变量（`E2EE_BASE`、`SYNAPSE_DB_CONTAINER`、
 * `ADB_SERIAL_A`、`CDP_A`…）。换人复跑基本等于重来。
 *
 * 本脚本读 `scripts/live/live-manifest.json` 的 `probes`，按 `category` 分组串行执行，
 * 并在执行前检查每条声明的 `requires` 环境变量（缺失即 exit 2，不静默跳过）。
 *
 * Usage:
 *   node scripts/live/run-probe.mjs --list
 *   node scripts/live/run-probe.mjs --group server --dry-run
 *   node scripts/live/run-probe.mjs --group server
 *   node scripts/live/run-probe.mjs --only push-delivery --allow-drift
 *
 * Exit codes: 0 全通过 / 1 有探针失败 / 2 环境不满足
 */

import { readFileSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { captureBaseline, assertBaseline, formatBaseline } from '../lib/live-env.mjs'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const projectRoot = path.resolve(__dirname, '..', '..')
const manifestPath = path.join(projectRoot, 'scripts', 'live', 'live-manifest.json')

const args = process.argv.slice(2)
const has = (flag) => args.includes(flag)
const valueOf = (flag) => {
  const i = args.indexOf(flag)
  return i >= 0 && args[i + 1] && !args[i + 1].startsWith('--') ? args[i + 1] : undefined
}

const LIST = has('--list')
const DRY_RUN = has('--dry-run')
const ALLOW_DRIFT = has('--allow-drift')
const GROUP = valueOf('--group')
const ONLY = valueOf('--only')

function loadManifest() {
  try {
    return JSON.parse(readFileSync(manifestPath, 'utf8'))
  } catch (err) {
    console.error(`[test:probe] 无法读取 manifest：${err.message}`)
    process.exit(2)
  }
}

function main() {
  const manifest = loadManifest()
  const probes = manifest.probes ?? []

  if (!probes.length) {
    console.error('[test:probe] manifest 里没有探针 —— 视为配置失效，不当作通过')
    process.exit(2)
  }

  const selected = probes.filter((p) => {
    if (ONLY && p.name !== ONLY) return false
    if (GROUP && p.category !== GROUP) return false
    return true
  })

  if (LIST) {
    console.log(`[test:probe] ${probes.length} 个探针（选中 ${selected.length}）：`)
    for (const p of probes) {
      const requires = (p.requires ?? []).join(',') || '-'
      console.log(`  ${p.name.padEnd(24)} ${String(p.category).padEnd(8)} oracle=${String(p.oracle).padEnd(14)} requires=${requires}`)
    }
    return
  }

  if (!selected.length) {
    console.error(`[test:probe] 过滤条件（group=${GROUP ?? '-'}, only=${ONLY ?? '-'}）没有命中任何探针`)
    process.exit(2)
  }

  // —— 依赖检查（fail-closed） ——
  const blocked = []
  for (const p of selected) {
    const missing = (p.requires ?? []).filter((k) => !process.env[k])
    if (missing.length) blocked.push(`${p.name}: 缺 ${missing.join(', ')}`)
  }

  if (blocked.length && !DRY_RUN) {
    console.error(`[test:probe] ❌ ${blocked.length} 个探针缺依赖环境变量：`)
    for (const b of blocked) console.error(`  - ${b}`)
    console.error('  缺失意味着探针无法取证，不能当作通过。补齐后重跑，或用 --dry-run 只看计划。')
    process.exit(2)
  }

  const baseline = captureBaseline()
  console.log(`[test:probe] 基线：${formatBaseline(baseline)}`)
  const { drift } = assertBaseline(baseline, {
    expected: manifest.expectedBaseline ?? {},
    requireApk: false,
    allowDrift: ALLOW_DRIFT,
    label: 'test:probe'
  })
  if (drift.length && !ALLOW_DRIFT && !DRY_RUN) process.exit(2)

  let failed = 0
  if (DRY_RUN) {
    console.log(`[test:probe] --dry-run：将串行执行 ${selected.length} 个探针`)
  }
  for (const p of selected) {
    console.log(`\n[test:probe] ▶ ${p.name}（${p.category}，oracle=${p.oracle}）`)
    if (DRY_RUN) {
      console.log(`    node ${p.file}`)
      continue
    }
    const res = spawnSync('node', [p.file], { cwd: projectRoot, stdio: 'inherit', env: { ...process.env } })
    if (res.status !== 0) {
      failed += 1
      console.error(`[test:probe] ✗ ${p.name} exit=${res.status}`)
    }
  }

  if (DRY_RUN) {
    console.log(`\n[test:probe] --dry-run 结束：${selected.length} 个探针已列出，未执行任何探针`)
    return
  }

  console.log(`\n[test:probe] 完成：${selected.length - failed}/${selected.length} 通过`)
  process.exit(failed === 0 ? 0 : 1)
}

main()
