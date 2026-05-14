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
 * The map's `generatedAt` and `ledger.synapseRustCommit` fields legitimately
 * vary between runs, so they are normalized before comparison: timestamps
 * are stripped and the SDK commit is cleared so the diff only reflects
 * structural drift (caller files, URLs, ledger matches).
 *
 * Exit codes:
 *   0  no drift; committed map matches regenerated content
 *   1  drift detected; commit the regenerated map
 *   2  scan failure (missing source, unreadable file, etc.)
 *
 * Usage:
 *   node scripts/contract-codegen-check.mjs
 */

import { readFile } from 'node:fs/promises'
import { spawnSync } from 'node:child_process'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const projectRoot = path.resolve(__dirname, '..')
const mapPath = path.join(projectRoot, 'scripts', 'contract-coverage-map.json')
const scanScript = path.join(__dirname, 'contract-coverage-scan.mjs')

function normalize(json) {
  const cloned = JSON.parse(JSON.stringify(json))
  delete cloned.generatedAt
  if (cloned.ledger && typeof cloned.ledger === 'object') {
    delete cloned.ledger.synapseRustCommit
  }
  return cloned
}

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

  const result = spawnSync(process.execPath, [scanScript], {
    cwd: projectRoot,
    stdio: ['ignore', 'pipe', 'pipe'],
    encoding: 'utf8'
  })
  if (result.status !== 0) {
    process.stderr.write(result.stderr ?? '')
    console.error('[contract-codegen-check] FAIL — contract coverage scan exited non-zero')
    process.exit(2)
  }

  let regenerated
  try {
    regenerated = JSON.parse(await readFile(mapPath, 'utf8'))
  } catch (err) {
    console.error(`[contract-codegen-check] FAIL — could not read regenerated map: ${err.message}`)
    process.exit(2)
  }

  const a = normalize(committed)
  const b = normalize(regenerated)
  if (JSON.stringify(a) === JSON.stringify(b)) {
    console.log('[contract-codegen-check] OK — committed contract coverage map is up to date')
    process.exit(0)
  }

  console.error(
    '[contract-codegen-check] FAIL — committed scripts/contract-coverage-map.json drifted from source.'
  )
  console.error('Run `pnpm contract:coverage:scan` and commit the regenerated file.')
  // Quick hint: report top-level keys whose serialization changed.
  for (const key of new Set([...Object.keys(a), ...Object.keys(b)])) {
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
