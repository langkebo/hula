#!/usr/bin/env node
/**
 * live e2e 统一入口 —— 让「跑一遍 live」从「翻 6 份文档抄命令」变成一条命令。
 *
 * 背景：项目有 11 个 live spec / 56 条用例，但 `test:e2e:live` 只收录 4 个，
 * 其余 7 个只出现在 `UI优化方案` §19.57／§19.61 的手工命令里，事实上"写完就没再跑"。
 *
 * 本脚本读 `scripts/live/live-manifest.json`（单一真源），按 routeSet 自动分派 project，
 * 并要求环境四元组对齐后才执行。
 *
 * 设计要点：
 *   - **SKIP 不是 pass**：缺 MATRIX_LIVE_* 凭据时 exit 2 并列出缺什么，绝不静默跳过；
 *   - `--list` / `--dry-run` 不需要凭据（用于盘点与 CI 静态校验）；
 *   - 路由集复用 `e2e/specRouteSets.ts` 的结论（已由 manifest 固化并经 check:live-manifest 校验）。
 *
 * Usage:
 *   node scripts/live/run-live.mjs --list
 *   node scripts/live/run-live.mjs --dry-run
 *   node scripts/live/run-live.mjs --route-set desktop --grep '房间设置'
 *   node scripts/live/run-live.mjs --allow-drift
 *
 * Exit codes: 0 全通过 / 1 有用例失败 / 2 环境或凭据不满足
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
const ONLY_ROUTE_SET = valueOf('--route-set')
const GREP = valueOf('--grep')

/** 执行 live 所必需的环境变量（缺一即 exit 2）。 */
const REQUIRED_ENV = ['MATRIX_LIVE_E2E', 'MATRIX_LIVE_HOMESERVER_URL', 'MATRIX_LIVE_USERNAME', 'MATRIX_LIVE_PASSWORD']

/** 路由集 → Playwright project。 */
const PROJECT_BY_ROUTE_SET = { desktop: 'desktop-chromium', mobile: 'mobile-chromium' }

function loadManifest() {
  try {
    return JSON.parse(readFileSync(manifestPath, 'utf8'))
  } catch (err) {
    console.error(`[test:live] 无法读取 manifest：${err.message}`)
    process.exit(2)
  }
}

/** 该 spec 是否属于给定路由集（both 两边都跑）。 */
const belongsTo = (spec, routeSet) => spec.routeSet === routeSet || spec.routeSet === 'both'

function main() {
  const manifest = loadManifest()
  const liveSpecs = (manifest.specs ?? []).filter((s) => s.live)

  if (!liveSpecs.length) {
    console.error('[test:live] manifest 里没有 live spec —— 视为配置失效，不当作通过')
    process.exit(2)
  }

  if (LIST) {
    console.log(`[test:live] ${liveSpecs.length} 个 live spec：`)
    for (const s of liveSpecs) {
      console.log(`  ${s.name.padEnd(26)} ${String(s.routeSet).padEnd(8)} oracle=${String(s.oracle).padEnd(14)} ${s.file}`)
    }
    console.log(`[test:live] 提示：真实用例数用 \`npx playwright test <files> --list\` 收集（当前实测 56 条）`)
    return
  }

  const routeSets = ONLY_ROUTE_SET ? [ONLY_ROUTE_SET] : ['desktop', 'mobile']
  const unknown = routeSets.filter((r) => !PROJECT_BY_ROUTE_SET[r])
  if (unknown.length) {
    console.error(`[test:live] --route-set 只能是 desktop / mobile，收到：${unknown.join(', ')}`)
    process.exit(2)
  }

  const plan = routeSets
    .map((routeSet) => {
      const files = liveSpecs.filter((s) => belongsTo(s, routeSet)).map((s) => s.file)
      return { routeSet, project: PROJECT_BY_ROUTE_SET[routeSet], files }
    })
    .filter((p) => p.files.length > 0)

  if (!plan.length) {
    console.error(`[test:live] 路由集 ${routeSets.join('/')} 下没有可跑的 live spec`)
    process.exit(2)
  }

  // —— 凭据检查（fail-closed） ——
  const missing = REQUIRED_ENV.filter((k) => !process.env[k])
  if (missing.length && !DRY_RUN) {
    console.error(`[test:live] ❌ 缺少环境变量 ${missing.length} 个：${missing.join(', ')}`)
    console.error('  这些缺失意味着「没有真后端/没有账号」，不能当作通过。补齐后重跑，或用 --dry-run 只看计划。')
    process.exit(2)
  }

  // —— 环境四元组 ——
  const baseline = captureBaseline()
  console.log(`[test:live] 基线：${formatBaseline(baseline)}`)
  const { drift } = assertBaseline(baseline, {
    expected: manifest.expectedBaseline ?? {},
    requireApk: Boolean(manifest.requireApk),
    allowDrift: ALLOW_DRIFT,
    label: 'test:live'
  })
  if (drift.length && !ALLOW_DRIFT && !DRY_RUN) process.exit(2)

  if (DRY_RUN) {
    console.log('[test:live] --dry-run：仅打印计划，不执行')
    for (const p of plan) {
      console.log(`  project=${p.project} (${p.routeSet}) → ${p.files.length} 个文件`)
      console.log(`    npx playwright test ${p.files.join(' ')} --project=${p.project} --workers=1${GREP ? ` --grep "${GREP}"` : ''}`)
    }
    if (missing.length) console.warn(`  ⚠️ 实测时仍缺：${missing.join(', ')}（届时会 exit 2）`)
    return
  }

  let failed = 0
  for (const p of plan) {
    const argv = ['playwright', 'test', ...p.files, `--project=${p.project}`, '--workers=1']
    if (GREP) argv.push('--grep', GREP)
    console.log(`\n[test:live] ▶ project=${p.project} routeSet=${p.routeSet} files=${p.files.length}`)
    const res = spawnSync('npx', argv, {
      cwd: projectRoot,
      stdio: 'inherit',
      env: { ...process.env, NODE_OPTIONS: '' }
    })
    if (res.status !== 0) failed += 1
  }

  console.log(`\n[test:live] 完成：${plan.length - failed}/${plan.length} 组通过`)
  process.exit(failed === 0 ? 0 : 1)
}

main()
