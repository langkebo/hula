#!/usr/bin/env node
/**
 * §21.1 P0 — Contract codegen drift gate.
 *
 * Regenerates `scripts/contract-coverage-map.json` via
 * `contract-coverage-scan.mjs` and fails if the freshly-scanned content
 * differs from the committed copy. This catches PRs that add a service
 * call without re-running the contract scan, ensuring the coverage map
 * stays in lockstep with the code.
 *
 * The map's `generatedAt` and every ledger-derived field (`ledger`,
 * `uncoveredLedger`, `entries[].ledgerRoutes`, `unmatchedUrls`) legitimately
 * vary between runs and **between environments** — Tjg-only CI has no
 * `../matrix-js-sdk` sibling, so the scan runs with `ledger: null` there.
 * Comparison therefore uses a source-derived projection only
 * (`scanned` / `callerFiles` / `totalCalls` / `totalUrls` / `entries[].{file,callCount,kinds,urlCount}`),
 * which is exactly the invariant this gate owns: the map stays in lockstep
 * with the service layer's call sites.
 *
 * Exit codes:
 *   0  no drift; committed map matches regenerated content
 *   1  drift detected; commit the regenerated map
 *   2  scan failure (missing source, unreadable file, etc.)
 *
 * Usage:
 *   node scripts/contract-codegen-check.mjs
 */

import { mkdtemp, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { spawnSync } from 'node:child_process'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const projectRoot = path.resolve(__dirname, '..')
const mapPath = path.join(projectRoot, 'scripts', 'contract-coverage-map.json')
const scanScript = path.join(__dirname, 'contract-coverage-scan.mjs')

/**
 * 只投影**源码派生**字段用于比对。
 *
 * 为什么不再整份 JSON 对比：`ledger` 段来自 `../matrix-js-sdk` sibling 的
 * `route-manifest.default.json`，而 Tjg-only CI **没有该 sibling**（见 quality-gate.yml
 * 「SDK Pin Verification」上方的降级说明）—— CI 里扫描会以 `ledger: null` 运行，
 * 本地开发则有完整 ledger。把 ledger / uncoveredLedger / entries[].ledgerRoutes /
 * unmatchedUrls 纳入比对，等于让同一份源码在不同环境得出不同结论，门禁在本地与 CI
 * 之间来回红，最终被当成「反正一直是红的」而忽略。
 *
 * 因此门禁只守「地图与源码是否同步」这一条不变量：
 * scanner 覆盖到的文件集、调用数、URL 数、调用类别。
 * ledger 快照仍会写进 map（供人查阅），但**不参与判定**。
 */
function projectSourceContract(json) {
  const entries = Array.isArray(json.entries) ? json.entries : []
  return {
    scanned: json.scanned ?? 0,
    callerFiles: json.callerFiles ?? 0,
    totalCalls: json.totalCalls ?? 0,
    totalUrls: json.totalUrls ?? 0,
    entries: entries.map((entry) => ({
      file: entry.file,
      callCount: entry.callCount,
      kinds: entry.kinds ?? [],
      urlCount: entry.urlCount ?? 0
    }))
  }
}

/** 参与判定的字段（用于失败时的提示语） */
const COMPARED_FIELDS = ['scanned', 'callerFiles', 'totalCalls', 'totalUrls', 'entries']

async function readCommittedMap() {
  try {
    const text = await readFile(mapPath, 'utf8')
    return JSON.parse(text)
  } catch (err) {
    if (err && err.code === 'ENOENT') return null
    throw err
  }
}

async function main() {
  const committed = await readCommittedMap()
  if (!committed) {
    console.error(
      `[contract-codegen-check] FAIL — ${path.relative(projectRoot, mapPath)} is missing; run pnpm contract:coverage:scan and commit the result.`
    )
    process.exit(1)
  }

  // 扫描到**临时文件**再比对，绝不就地把提交进仓的 map 重写：否则每跑一次门禁
  // 只有 `generatedAt` 变、工作区就脏一次，`check:release` 会天天制造时间戳噪声。
  const scratchDir = await mkdtemp(path.join(tmpdir(), 'tjg-contract-coverage-'))
  const scratchMap = path.join(scratchDir, 'contract-coverage-map.json')

  let regenerated
  try {
    const result = spawnSync(process.execPath, [scanScript, '--out', scratchMap], {
      cwd: projectRoot,
      stdio: ['ignore', 'pipe', 'pipe'],
      encoding: 'utf8'
    })
    if (result.status !== 0) {
      process.stderr.write(result.stderr ?? '')
      console.error('[contract-codegen-check] FAIL — contract coverage scan exited non-zero')
      process.exit(2)
    }
    regenerated = JSON.parse(await readFile(scratchMap, 'utf8'))
  } catch (err) {
    console.error(`[contract-codegen-check] FAIL — could not read regenerated map: ${err.message}`)
    process.exit(2)
  } finally {
    await rm(scratchDir, { recursive: true, force: true })
  }

  const a = projectSourceContract(committed)
  const b = projectSourceContract(regenerated)
  if (JSON.stringify(a) === JSON.stringify(b)) {
    console.log('[contract-codegen-check] OK — committed contract coverage map is up to date')
    process.exit(0)
  }

  console.error(
    '[contract-codegen-check] FAIL — committed scripts/contract-coverage-map.json drifted from source.'
  )
  console.error('Run `pnpm contract:coverage:scan` and commit the regenerated file.')
  // 只报「参与判定」的字段；ledger 段属外部输入，不解释漂移原因
  for (const key of COMPARED_FIELDS) {
    const aSer = JSON.stringify(a[key])
    const bSer = JSON.stringify(b[key])
    if (aSer !== bSer) console.error(`  - drift in: ${key}`)
  }
  process.exit(1)
}

main().catch((err) => {
  console.error('[contract-codegen-check] unexpected error', err)
  process.exit(2)
})
