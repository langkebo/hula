#!/usr/bin/env node
/**
 * 联调资产清单门禁 —— 让「新增用例忘了登记」变成编译错误，而不是靠人记得更新文档。
 *
 * 背景：项目已有 38 个 e2e spec（含 visual/）与 10 个服务端探针，但
 * `test:e2e:live` 只收录 4 个 live spec，10 个探针只有 1 个有 npm script。
 * 结果是大量已写好的用例事实上「写完就没再跑」，而文档里的状态表仍写着「已完成」。
 *
 * 本脚本把 `scripts/live/live-manifest.json` 作为单一真源，做四件事：
 *   1. 双向比对：磁盘上的 spec/探针必须全部登记；登记的文件必须存在；
 *   2. 路由集一致性：manifest 的 routeSet 必须与 `e2e/specRouteSets.ts` 两张名单推导值一致；
 *   3. 判据完整性：live spec 必须声明 oracle，且 oracle 必须在 oracleKinds 白名单内；
 *   4. 基数断言：扫到的 spec/探针数量低于地板即 exit 2（防止扫描规则失效后「全绿」）。
 *
 * Exit codes:
 *   0  清单与磁盘一致
 *   1  发现不一致（未登记 / 不存在 / 路由集不符 / 判据缺失）
 *   2  扫描或解析失败（含基数不足）—— 绝不当作通过
 *
 * Usage:
 *   node scripts/check-live-manifest.mjs
 *   node scripts/check-live-manifest.mjs --json
 */

import { readFileSync, readdirSync, statSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const projectRoot = path.resolve(__dirname, '..')
const manifestPath = path.join(projectRoot, 'scripts', 'live', 'live-manifest.json')
const routeSetPath = path.join(projectRoot, 'e2e', 'specRouteSets.ts')
const e2eRoot = path.join(projectRoot, 'e2e')
const scriptsRoot = path.join(projectRoot, 'scripts')

/** 地板值：低于此数量视为扫描失效（当前实测 38 spec / 10 探针）。 */
const SPEC_FLOOR = 30
const PROBE_FLOOR = 8

const wantJson = process.argv.includes('--json')

const problems = []
const fail = (code, msg) => problems.push(`[${code}] ${msg}`)

/** 递归收集指定后缀的文件（相对 projectRoot，正斜杠）。 */
function walk(dir, suffix, acc = []) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) {
      walk(full, suffix, acc)
    } else if (entry.isFile() && entry.name.endsWith(suffix)) {
      acc.push(path.relative(projectRoot, full).split(path.sep).join('/'))
    }
  }
  return acc
}

/** `e2e/a/b.spec.ts` → `b` */
function specStem(relPath) {
  return path.basename(relPath).replace(/\.spec\.ts$/, '')
}

/** 从 specRouteSets.ts 里提取两个数组的字面量。 */
function parseRouteSets() {
  const src = readFileSync(routeSetPath, 'utf8')
  const pick = (exportName) => {
    const re = new RegExp(`export const ${exportName}[^=]*=\\s*\\[([\\s\\S]*?)\\]`)
    const m = src.match(re)
    if (!m) {
      throw new Error(`无法在 e2e/specRouteSets.ts 定位 ${exportName}`)
    }
    return [...m[1].matchAll(/'([^']+)'|"([^"]+)"/g)].map((x) => x[1] ?? x[2])
  }
  return { mobile: new Set(pick('MOBILE_ONLY_SPECS')), desktop: new Set(pick('DESKTOP_ONLY_SPECS')) }
}

function main() {
  let manifest
  try {
    manifest = JSON.parse(readFileSync(manifestPath, 'utf8'))
  } catch (err) {
    console.error(`[check:live-manifest] 无法读取 manifest：${err.message}`)
    process.exit(2)
  }

  const specsOnDisk = walk(e2eRoot, '.spec.ts').sort()
  const probesOnDisk = readdirSync(scriptsRoot)
    .filter((f) => f.endsWith('.mjs') && f.includes('probe'))
    .map((f) => `scripts/${f}`)
    .filter((rel) => {
      try {
        return statSync(path.join(projectRoot, rel)).isFile()
      } catch {
        return false
      }
    })
    .sort()

  if (specsOnDisk.length < SPEC_FLOOR || probesOnDisk.length < PROBE_FLOOR) {
    console.error(
      `[check:live-manifest] 扫描基数不足：spec=${specsOnDisk.length}（地板 ${SPEC_FLOOR}）、` +
        `probe=${probesOnDisk.length}（地板 ${PROBE_FLOOR}）—— 视为扫描失效，不当作通过`
    )
    process.exit(2)
  }

  let routeSets
  try {
    routeSets = parseRouteSets()
  } catch (err) {
    console.error(`[check:live-manifest] ${err.message}`)
    process.exit(2)
  }

  const registeredSpecs = Array.isArray(manifest.specs) ? manifest.specs : []
  const registeredProbes = Array.isArray(manifest.probes) ? manifest.probes : []
  const oracleKinds = new Set(Array.isArray(manifest.oracleKinds) ? manifest.oracleKinds : [])

  // —— 1. spec 双向比对 ——
  const diskSpecSet = new Set(specsOnDisk)
  const seenSpecFiles = new Set()
  const seenSpecNames = new Set()

  for (const spec of registeredSpecs) {
    const file = String(spec.file ?? '')
    const name = String(spec.name ?? '')
    if (!file) {
      fail('SPEC-NO-FILE', `条目 "${name || '(无名)'}" 缺 file`)
      continue
    }
    if (!diskSpecSet.has(file)) {
      fail('SPEC-MISSING-FILE', `登记了不存在的文件：${file}`)
      continue
    }
    if (seenSpecFiles.has(file)) fail('SPEC-DUP-FILE', `文件重复登记：${file}`)
    if (seenSpecNames.has(name)) fail('SPEC-DUP-NAME', `名称重复登记：${name}`)
    seenSpecFiles.add(file)
    seenSpecNames.add(name)

    if (specStem(file) !== name) {
      fail('SPEC-NAME-MISMATCH', `name="${name}" 与文件名推导 "${specStem(file)}" 不一致（${file}）`)
    }

    const expectedRouteSet = routeSets.mobile.has(name) ? 'mobile' : routeSets.desktop.has(name) ? 'desktop' : 'both'
    if (spec.routeSet !== expectedRouteSet) {
      fail('SPEC-ROUTESET', `${file}: routeSet="${spec.routeSet}"，specRouteSets.ts 推导为 "${expectedRouteSet}"`)
    }

    if (!Array.isArray(spec.covers) || spec.covers.length === 0) {
      fail('SPEC-NO-COVERS', `${file}: 缺 covers（该用例覆盖哪个能力/缺陷）`)
    }

    if (spec.live) {
      if (!spec.oracle) {
        fail('LIVE-NO-ORACLE', `${file}: live 用例必须声明 oracle（服务端事件 / DB / timeline …）`)
      } else if (oracleKinds.size > 0 && !oracleKinds.has(spec.oracle)) {
        fail('LIVE-BAD-ORACLE', `${file}: oracle="${spec.oracle}" 不在 oracleKinds 白名单内`)
      }
    }
  }

  for (const file of specsOnDisk) {
    if (!seenSpecFiles.has(file)) {
      fail('SPEC-UNREGISTERED', `磁盘存在但未登记：${file}（请补进 scripts/live/live-manifest.json）`)
    }
  }

  // —— 2. 探针双向比对 ——
  const diskProbeSet = new Set(probesOnDisk)
  const seenProbeFiles = new Set()

  for (const probe of registeredProbes) {
    const file = String(probe.file ?? '')
    const name = String(probe.name ?? '')
    if (!file) {
      fail('PROBE-NO-FILE', `条目 "${name || '(无名)'}" 缺 file`)
      continue
    }
    if (!diskProbeSet.has(file)) {
      fail('PROBE-MISSING-FILE', `登记了不存在的探针：${file}`)
      continue
    }
    if (seenProbeFiles.has(file)) fail('PROBE-DUP-FILE', `探针重复登记：${file}`)
    seenProbeFiles.add(file)

    if (!probe.oracle) {
      fail('PROBE-NO-ORACLE', `${file}: 探针必须声明 oracle（否则判据无法审计）`)
    } else if (oracleKinds.size > 0 && !oracleKinds.has(probe.oracle)) {
      fail('PROBE-BAD-ORACLE', `${file}: oracle="${probe.oracle}" 不在 oracleKinds 白名单内`)
    }
    if (!Array.isArray(probe.covers) || probe.covers.length === 0) {
      fail('PROBE-NO-COVERS', `${file}: 缺 covers`)
    }
  }

  for (const file of probesOnDisk) {
    if (!seenProbeFiles.has(file)) {
      fail('PROBE-UNREGISTERED', `磁盘存在但未登记：${file}`)
    }
  }

  // —— 3. 状态一致性（live-status.json 是「跑没跑过」的单一真源） ——
  const statusPath = path.join(projectRoot, 'scripts', 'live', 'live-status.json')
  let statusDoc
  try {
    statusDoc = JSON.parse(readFileSync(statusPath, 'utf8'))
  } catch (err) {
    console.error(`[check:live-manifest] 无法读取 scripts/live/live-status.json：${err.message}`)
    process.exit(2)
  }

  const statusEntries = statusDoc.entries ?? {}
  const knownNames = new Set([...registeredSpecs.map((s) => s.name), ...registeredProbes.map((p) => p.name)])
  const VALID_STATUS = new Set(['passed', 'failed', 'stale', 'never-run', 'manual'])

  for (const [name, entry] of Object.entries(statusEntries)) {
    if (!knownNames.has(name)) {
      fail('STATUS-ORPHAN', `live-status.json 有 manifest 中不存在的条目：${name}（改名或删除后未清理）`)
      continue
    }
    if (!VALID_STATUS.has(entry.status)) {
      fail('STATUS-BAD-VALUE', `${name}: status="${entry.status}" 不在 ${[...VALID_STATUS].join(' / ')} 内`)
    }
    if (entry.status === 'passed') {
      const run = entry.last_run
      const lacking = []
      if (!run) lacking.push('last_run')
      else {
        if (!run.backend_image) lacking.push('backend_image')
        if (!run.backend_started_at) lacking.push('backend_started_at')
        if (!run.sdk_pin?.commit) lacking.push('sdk_pin.commit')
      }
      if (lacking.length) {
        fail('STATUS-PASSED-NO-BASELINE', `${name}: status=passed 但缺 ${lacking.join(', ')} —— 结论不可核验，应降级为 stale`)
      }
    }
  }

  const statusCounts = {}
  for (const entry of Object.values(statusEntries)) {
    statusCounts[entry.status] = (statusCounts[entry.status] ?? 0) + 1
  }

  // —— 4. 汇总 ——
  const liveCount = registeredSpecs.filter((s) => s.live).length
  const manualCount = Array.isArray(manifest.manual) ? manifest.manual.length : 0

  if (wantJson) {
    console.log(
      JSON.stringify(
        {
          ok: problems.length === 0,
          specs: { disk: specsOnDisk.length, registered: registeredSpecs.length, live: liveCount },
          probes: { disk: probesOnDisk.length, registered: registeredProbes.length },
          status: statusCounts,
          manual: manualCount,
          problems
        },
        null,
        2
      )
    )
  } else {
    const statusText = Object.entries(statusCounts)
      .map(([k, v]) => `${k} ${v}`)
      .join('／')
    console.log(
      `[check:live-manifest] spec ${specsOnDisk.length}（live ${liveCount}）｜探针 ${probesOnDisk.length}｜状态 ${statusText || '空'}｜人工清单 ${manualCount}`
    )
    if (problems.length) {
      console.error(`[check:live-manifest] ❌ ${problems.length} 项不一致：`)
      for (const p of problems) console.error(`  ${p}`)
    } else {
      console.log('[check:live-manifest] ✅ 清单与磁盘一致')
    }
  }

  process.exit(problems.length === 0 ? 0 : 1)
}

main()
