#!/usr/bin/env node
/**
 * audit-transport-inventory — enumerate every non-SDK transport call site.
 *
 * Scans src/ for:
 *   1. `client.http.authedRequest(...)` — raw SDK transport
 *   2. `fetch(` or `globalThis.fetch(` calls outside the approved boundary
 *   3. `invoke(` calls into Tauri (for cross-reference only; not flagged)
 *   4. `/_matrix/...` or `/_synapse/...` route literals outside the boundary
 *
 * Produces docs/generated/transport-inventory.json — the source of truth for
 * plan §15 #3 and §16.3.4.
 *
 * Ratchet (strict mode):
 *   --strict compares violations against scripts/transport-inventory-baseline.json.
 *   Violations are keyed by (kind, file); the per-key count and the global
 *   violationCount budget may only shrink. New keys or growing counts fail.
 *   Refresh intentionally with `--update-baseline` (or env
 *   TRANSPORT_AUDIT_BASELINE_UPDATE=1) in a dedicated commit.
 *
 * Exit codes:
 *   0 — scan completed with no regressions (or non-strict mode).
 *   1 — scan failed (unreadable file etc.).
 *   2 — regression detected vs baseline in --strict, or --strict with no
 *       baseline present and non-zero violations.
 *
 * Authoritative reference: plan §15, §16.3.4, §17.
 */

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const srcRoot = path.join(repoRoot, 'src')
const outDir = path.join(repoRoot, 'docs', 'generated')
const outPath = path.join(outDir, 'transport-inventory.json')

// Files allowed to hold raw transport — the approved boundary per §16.3.4.
const APPROVED_BOUNDARY = [
  'src/services/matrix/network/',
  'src/services/matrix/sdk.ts',
  'src/services/matrix/MatrixClientService.ts',
  'src/services/matrix/MatrixRequestHelper.ts',
  'src/services/backend/',
  'src/services/performance/ChunkUploadService.ts',
  'src/services/api/',
  'src/utils/MatrixDiagnostics.ts',
]

const PATTERNS = [
  {
    kind: 'authedRequest',
    // Matches any `.http.authedRequest(` — identifier, chained call, or expression.
    regex: /\.\s*http\s*\.\s*authedRequest\s*\(/g,
  },
  {
    kind: 'rawFetch',
    // Matches `fetch(`, `globalThis.fetch(`, `window.fetch(`; ignores `.fetch(` on arbitrary objects
    // (that would catch MatrixClient.fetch, which we don't want to flag).
    regex: /(?<![A-Za-z0-9_$])(?:globalThis\.|window\.)?fetch\s*\(/g,
  },
  {
    kind: 'tauriInvoke',
    regex: /(?<![A-Za-z0-9_$])invoke\s*\(/g,
  },
  {
    kind: 'inlineMatrixUri',
    // Matches Matrix/Synapse path literals whether they appear as plain string
    // literals ("/_matrix/foo") or as route fragments inside template literals
    // (`${baseUrl}/_matrix/foo`). Approved boundary owns the route table;
    // everywhere else must call SDK managers or MatrixRequestHelper instead of
    // typing route paths. Path stops at the first quote, backtick, whitespace,
    // or template-expression delimiter so one match per route literal.
    regex: /\/_(matrix|synapse)\/[A-Za-z0-9_\-./]+/g,
  },
]

function walk(dir, out = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name.startsWith('.')) continue
    if (entry.name === 'node_modules' || entry.name === 'dist' || entry.name === '__tests__') {
      continue
    }
    const p = path.join(dir, entry.name)
    if (entry.isDirectory()) walk(p, out)
    else if (/\.(ts|tsx|vue|mjs|cjs|js)$/.test(entry.name) && !entry.name.endsWith('.d.ts')) out.push(p)
  }
  return out
}

function relPath(absolute) {
  return path.relative(repoRoot, absolute).replace(/\\/g, '/')
}

function isApproved(rel) {
  return APPROVED_BOUNDARY.some((prefix) => rel.startsWith(prefix))
}

function lineForOffset(text, offset) {
  let line = 1
  for (let i = 0; i < offset; i++) if (text.charCodeAt(i) === 10) line++
  return line
}

function scan() {
  const findings = {
    authedRequest: [],
    rawFetch: [],
    tauriInvoke: [],
    inlineMatrixUri: [],
  }

  for (const file of walk(srcRoot)) {
    let text
    try {
      text = fs.readFileSync(file, 'utf8')
    } catch (err) {
      process.stderr.write(`audit-transport-inventory: cannot read ${file}: ${err.message}\n`)
      process.exit(1)
    }
    const rel = relPath(file)
    for (const { kind, regex } of PATTERNS) {
      regex.lastIndex = 0
      let m
      while ((m = regex.exec(text)) !== null) {
        const line = lineForOffset(text, m.index)
        findings[kind].push({
          file: rel,
          line,
          approved: isApproved(rel),
        })
      }
    }
  }

  return findings
}

function summarize(findings) {
  const counts = {
    authedRequest: {
      total: findings.authedRequest.length,
      violations: findings.authedRequest.filter((f) => !f.approved).length,
    },
    rawFetch: {
      total: findings.rawFetch.length,
      violations: findings.rawFetch.filter((f) => !f.approved).length,
    },
    tauriInvoke: {
      total: findings.tauriInvoke.length,
      violations: 0, // not gated
    },
    inlineMatrixUri: {
      total: findings.inlineMatrixUri.length,
      violations: findings.inlineMatrixUri.filter((f) => !f.approved).length,
    },
  }
  return counts
}

const baselineFile = path.join(repoRoot, 'scripts', 'transport-inventory-baseline.json')

// Ratchet: group violations by (kind, file) so line shifts don't churn the
// baseline. Count tracks how many literals that file+kind currently owns; the
// baseline's budget for a key may only shrink.
function violationBuckets(findings) {
  const buckets = new Map()
  const gatedKinds = ['authedRequest', 'rawFetch', 'inlineMatrixUri']
  for (const kind of gatedKinds) {
    for (const f of findings[kind]) {
      if (f.approved) continue
      const key = `${kind}::${f.file}`
      buckets.set(key, (buckets.get(key) ?? 0) + 1)
    }
  }
  return buckets
}

function bucketsToPayload(buckets, totalViolations) {
  const perFile = [...buckets.entries()]
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    .map(([key, count]) => {
      const [kind, ...rest] = key.split('::')
      return { kind, file: rest.join('::'), count }
    })
  return {
    generatedAt: new Date().toISOString(),
    violationCount: totalViolations,
    perFile,
  }
}

function loadBaseline() {
  try {
    const parsed = JSON.parse(fs.readFileSync(baselineFile, 'utf8'))
    if (!parsed || typeof parsed !== 'object' || !Array.isArray(parsed.perFile)) {
      process.stderr.write('audit-transport-inventory: baseline shape invalid; expected { violationCount, perFile[] }\n')
      process.exit(2)
    }
    const buckets = new Map()
    for (const entry of parsed.perFile) {
      buckets.set(`${entry.kind}::${entry.file}`, Number(entry.count))
    }
    return {
      violationCount: Number(parsed.violationCount ?? 0),
      buckets,
    }
  } catch (err) {
    if (err && err.code === 'ENOENT') return null
    throw err
  }
}

function writeBaseline(buckets, totalViolations) {
  const payload = bucketsToPayload(buckets, totalViolations)
  fs.writeFileSync(baselineFile, `${JSON.stringify(payload, null, 2)}\n`)
}

function main() {
  const args = process.argv.slice(2)
  const strict = args.includes('--strict')
  const updateBaseline =
    args.includes('--update-baseline') || process.env.TRANSPORT_AUDIT_BASELINE_UPDATE === '1'

  const findings = scan()
  const summary = summarize(findings)
  const report = {
    generated_at: new Date().toISOString(),
    approved_boundary: APPROVED_BOUNDARY,
    summary,
    findings,
  }

  fs.mkdirSync(outDir, { recursive: true })
  fs.writeFileSync(outPath, `${JSON.stringify(report, null, 2)}\n`)

  const lines = [
    `audit-transport-inventory: wrote ${relPath(outPath)}`,
    `  authedRequest:    ${summary.authedRequest.total} call site(s), ${summary.authedRequest.violations} outside approved boundary`,
    `  rawFetch:         ${summary.rawFetch.total} call site(s), ${summary.rawFetch.violations} outside approved boundary`,
    `  inlineMatrixUri:  ${summary.inlineMatrixUri.total} call site(s), ${summary.inlineMatrixUri.violations} outside approved boundary`,
    `  tauriInvoke:      ${summary.tauriInvoke.total} call site(s) (informational only)`,
  ]
  process.stdout.write(`${lines.join('\n')}\n`)

  const violations =
    summary.authedRequest.violations +
    summary.rawFetch.violations +
    summary.inlineMatrixUri.violations

  const buckets = violationBuckets(findings)

  if (updateBaseline) {
    writeBaseline(buckets, violations)
    process.stdout.write(
      `audit-transport-inventory: baseline updated: ${violations} violation(s) across ${buckets.size} (kind,file) key(s) at ${relPath(baselineFile)}\n`
    )
    process.exit(0)
  }

  if (!strict) return

  const baseline = loadBaseline()

  if (!baseline) {
    if (violations > 0) {
      process.stderr.write(
        `audit-transport-inventory: ${violations} violation(s) outside approved boundary and no baseline present; failing (--strict)\n`
      )
      process.exit(2)
    }
    return
  }

  const regressions = []
  for (const [key, count] of buckets.entries()) {
    const baseCount = baseline.buckets.get(key) ?? 0
    if (count > baseCount) {
      const [kind, ...rest] = key.split('::')
      regressions.push({ kind, file: rest.join('::'), baseline: baseCount, current: count })
    }
  }

  const fixed = []
  for (const [key, count] of baseline.buckets.entries()) {
    const current = buckets.get(key) ?? 0
    if (current < count) {
      const [kind, ...rest] = key.split('::')
      fixed.push({ kind, file: rest.join('::'), baseline: count, current })
    }
  }

  if (fixed.length > 0) {
    process.stdout.write(
      `audit-transport-inventory: ${fixed.length} baseline entry(ies) shrunk — refresh baseline with --update-baseline\n`
    )
  }

  // Hard invariant: total violation count may only shrink vs baseline.
  const budgetExceeded = violations > baseline.violationCount

  if (regressions.length === 0 && !budgetExceeded) {
    process.stdout.write('audit-transport-inventory: OK — no regressions vs baseline.\n')
    return
  }

  if (regressions.length > 0) {
    process.stderr.write(
      `audit-transport-inventory: ${regressions.length} regression(s) vs baseline:\n`
    )
    for (const r of regressions) {
      process.stderr.write(
        `  + [${r.kind}] ${r.file}: ${r.baseline} -> ${r.current}\n`
      )
    }
  }
  if (budgetExceeded) {
    process.stderr.write(
      `audit-transport-inventory: total violations ${violations} exceed baseline budget ${baseline.violationCount}.\n`
    )
  }
  process.stderr.write(
    'audit-transport-inventory: if the new violation is intentional, refresh with `pnpm audit:transport:strict --update-baseline` in a dedicated commit.\n'
  )
  process.exit(2)
}

main()
