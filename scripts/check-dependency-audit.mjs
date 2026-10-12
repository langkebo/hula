#!/usr/bin/env node
/**
 * P0-5 — Dependency audit gate (ratcheting).
 *
 * The default `.npmrc` points at the Huawei Cloud mirror, which does not
 * serve the audit API, so `pnpm audit` could not return machine-readable
 * results. CI papered over that with `continue-on-error: true`, so a real
 * high-severity advisory could ship unnoticed (report SC-04). This gate:
 *
 *   1. forces the canonical npmjs registry for the audit call only;
 *   2. parses `pnpm audit --json` (`advisories` + `metadata.vulnerabilities`);
 *   3. ratchets against `scripts/dependency-audit-baseline.json`, tolerating
 *      the pre-existing advisory set while failing on any NEW blocking
 *      advisory (severity >= threshold) or a blocking-count regression.
 *
 * Why a baseline instead of a bare `--audit-level=high`: the tree currently
 * carries transitive advisories inherited from the toolchain (dev-only).
 * Failing on all of them would make the gate red forever and invite another
 * `continue-on-error`. The ratchet freezes the present set and blocks growth,
 * mirroring `check-sdk-boundary.mjs`.
 *
 * Usage:
 *   node scripts/check-dependency-audit.mjs                 # ratchet check
 *   node scripts/check-dependency-audit.mjs --json          # machine report
 *   node scripts/check-dependency-audit.mjs --strict        # fail on ANY blocking advisory
 *   node scripts/check-dependency-audit.mjs --update-baseline
 *   node scripts/check-dependency-audit.mjs --audit-level=critical
 *   node scripts/check-dependency-audit.mjs --registry=https://registry.npmjs.org/
 *
 * Exit codes:
 *   0  no regression vs baseline (or strict mode with zero blocking advisories)
 *   1  regression detected
 *   2  audit/scan failure (network, pnpm missing, unparseable output)
 */

import { spawnSync } from 'node:child_process'
import { readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const projectRoot = path.resolve(__dirname, '..')
const baselineFile = path.join(projectRoot, 'scripts', 'dependency-audit-baseline.json')

/** Canonical registry that serves the npm audit API. */
export const DEFAULT_REGISTRY = 'https://registry.npmjs.org/'

/** Severity ladder, ascending. Index doubles as rank. */
export const SEVERITY_ORDER = ['info', 'low', 'moderate', 'high', 'critical']

export function severityRank(severity) {
  const idx = SEVERITY_ORDER.indexOf(String(severity ?? '').toLowerCase())
  return idx === -1 ? -1 : idx
}

/**
 * True when `severity` is at or above the `threshold` on the severity ladder.
 * Unknown severities rank -1 and never block.
 */
export function isBlocking(severity, threshold = 'high') {
  const rank = severityRank(severity)
  return rank >= 0 && rank >= severityRank(threshold)
}

/**
 * Normalize `pnpm audit --json` output into `{ advisories, metadata }`.
 * Accepts a raw JSON string or an already-parsed object.
 *
 * pnpm emits the npm v6 shape: `advisories` is a map keyed by advisory id,
 * each value carrying `module_name`/`severity`/`title`/`url`.
 */
export function parseAuditReport(input) {
  const raw = typeof input === 'string' ? JSON.parse(input) : input
  if (!raw || typeof raw !== 'object') {
    throw new Error('audit report must be a JSON object')
  }
  const advisories = []
  const source = raw.advisories && typeof raw.advisories === 'object' ? raw.advisories : {}
  for (const [key, value] of Object.entries(source)) {
    if (!value || typeof value !== 'object') continue
    advisories.push({
      id: String(value.id ?? key),
      module: String(value.module_name ?? value.module ?? 'unknown'),
      severity: String(value.severity ?? 'info').toLowerCase(),
      title: String(value.title ?? ''),
      url: value.url ? String(value.url) : ''
    })
  }
  const meta = raw.metadata && typeof raw.metadata === 'object' ? raw.metadata : {}
  const vulnerabilities =
    meta.vulnerabilities && typeof meta.vulnerabilities === 'object' ? meta.vulnerabilities : null
  return { advisories, metadata: { vulnerabilities } }
}

/** Count advisories per severity bucket. */
export function summarizeBySeverity(advisories) {
  const summary = { info: 0, low: 0, moderate: 0, high: 0, critical: 0, total: 0 }
  for (const advisory of advisories) {
    const sev = Object.hasOwn(summary, advisory.severity) ? advisory.severity : 'info'
    summary[sev] += 1
    summary.total += 1
  }
  return summary
}

/**
 * Stable identity for ratcheting: module + advisory id. Unaffected by
 * title/url edits or by how many dependency paths reach the advisory.
 */
export function advisoryKey(advisory) {
  return `${advisory.module}::${advisory.id}`
}

/** Freeze the current blocking advisory set into a baseline payload. */
export function buildBaseline(advisories, { threshold = 'high' } = {}) {
  const keys = [...new Set(advisories.filter((a) => isBlocking(a.severity, threshold)).map(advisoryKey))].sort()
  return {
    generatedAt: new Date().toISOString(),
    threshold,
    count: keys.length,
    advisories: keys
  }
}

/**
 * Pure gate decision — no I/O, no process.exit, so it can be unit tested.
 *
 * @param {Array<object>} advisories parsed advisories
 * @param {{count: number, advisories: Set<string>}|null} baseline
 * @param {{threshold?: string, strict?: boolean}} [opts]
 * @returns {{
 *   blocking: Array<object>,
 *   regressed: Array<object>,
 *   fixed: string[],
 *   countRegression: boolean,
 *   failed: boolean,
 *   hasBaseline: boolean
 * }}
 */
export function evaluateAuditGate(advisories, baseline, { threshold = 'high', strict = false } = {}) {
  const blocking = advisories.filter((a) => isBlocking(a.severity, threshold))
  if (!baseline) {
    return {
      blocking,
      regressed: [],
      fixed: [],
      countRegression: false,
      failed: strict ? blocking.length > 0 : false,
      hasBaseline: false
    }
  }
  const currentKeys = new Set(blocking.map(advisoryKey))
  const regressed = blocking.filter((a) => !baseline.advisories.has(advisoryKey(a)))
  const fixed = [...baseline.advisories].filter((k) => !currentKeys.has(k))
  // Count ratchet: blocking total must not exceed the frozen baseline.
  const countRegression = blocking.length > baseline.count
  const failed = strict ? blocking.length > 0 : regressed.length > 0 || countRegression
  return { blocking, regressed, fixed, countRegression, failed, hasBaseline: true }
}

async function loadBaseline() {
  try {
    const text = await readFile(baselineFile, 'utf8')
    const parsed = JSON.parse(text)
    if (!parsed || typeof parsed !== 'object' || !Array.isArray(parsed.advisories)) {
      throw new Error('baseline shape invalid; expected { count, advisories[] }')
    }
    return {
      count: Number(parsed.count ?? parsed.advisories.length),
      advisories: new Set(parsed.advisories)
    }
  } catch (err) {
    if (err && err.code === 'ENOENT') return null
    throw err
  }
}

async function writeBaseline(payload) {
  await writeFile(baselineFile, `${JSON.stringify(payload, null, 2)}\n`, 'utf8')
}

/**
 * Run `pnpm audit --json` against `registry` and return raw stdout.
 * A non-zero exit status is expected (vulnerabilities present); only empty
 * output or a spawn failure is treated as an error.
 */
export function runAuditJson({ registry = DEFAULT_REGISTRY } = {}) {
  const res = spawnSync('pnpm', ['audit', '--json', `--registry=${registry}`], {
    cwd: projectRoot,
    encoding: 'utf8',
    maxBuffer: 64 * 1024 * 1024
  })
  if (res.error) throw res.error
  const stdout = res.stdout ?? ''
  if (!stdout.trim()) {
    throw new Error(`pnpm audit produced no output (exit ${res.status})\n${res.stderr ?? ''}`)
  }
  return stdout
}

function resolveRegistry(argv) {
  const arg = argv.find((a) => a.startsWith('--registry='))
  if (arg) return arg.slice('--registry='.length)
  return process.env.TJG_AUDIT_REGISTRY || DEFAULT_REGISTRY
}

function resolveThreshold(argv) {
  const arg = argv.find((a) => a.startsWith('--audit-level='))
  return arg ? arg.slice('--audit-level='.length).toLowerCase() : 'high'
}

async function main() {
  const argv = process.argv.slice(2)
  const jsonOutput = argv.includes('--json')
  const strictMode = argv.includes('--strict')
  const updateBaseline = argv.includes('--update-baseline') || process.env.DEPENDENCY_AUDIT_BASELINE_UPDATE === '1'
  const registry = resolveRegistry(argv)
  const threshold = resolveThreshold(argv)

  let report
  try {
    report = parseAuditReport(runAuditJson({ registry }))
  } catch (err) {
    console.error(`[dependency-audit] audit failed: ${err.message}`)
    process.exit(2)
  }

  if (updateBaseline) {
    const payload = buildBaseline(report.advisories, { threshold })
    await writeBaseline(payload)
    console.log(
      `[dependency-audit] baseline updated: ${payload.count} blocking advisory(ies) at threshold "${threshold}" recorded at ${path.relative(
        projectRoot,
        baselineFile
      )}`
    )
    process.exit(0)
  }

  const baseline = await loadBaseline()
  const { blocking, regressed, fixed, countRegression, failed } = evaluateAuditGate(report.advisories, baseline, {
    threshold,
    strict: strictMode
  })
  const bySeverity = summarizeBySeverity(report.advisories)

  const machineReport = {
    registry,
    threshold,
    totalAdvisories: report.advisories.length,
    bySeverity,
    blockingCount: blocking.length,
    baselineBlockingCount: baseline?.count ?? null,
    countRegression,
    newRegressions: regressed,
    nowResolved: fixed
  }

  if (jsonOutput) {
    process.stdout.write(`${JSON.stringify(machineReport, null, 2)}\n`)
  } else {
    console.log(
      `[dependency-audit] ${report.advisories.length} advisory(ies) total (critical=${bySeverity.critical}, high=${bySeverity.high}, moderate=${bySeverity.moderate}, low=${bySeverity.low}, info=${bySeverity.info})`
    )
    console.log(`[dependency-audit] blocking at >= ${threshold}: ${blocking.length}`)
    if (baseline) {
      console.log(`[dependency-audit] baseline blocking: ${baseline.count}`)
      if (fixed.length > 0) console.log(`[dependency-audit] ${fixed.length} blocking advisory(ies) resolved since baseline`)
      if (regressed.length > 0) {
        console.log(`[dependency-audit] FAIL — ${regressed.length} new blocking advisory(ies):`)
        for (const advisory of regressed) {
          console.log(`  ${advisory.severity}  ${advisory.module} — ${advisory.title}`)
        }
      }
      if (countRegression) {
        console.log(
          `[dependency-audit] FAIL — blocking count regressed: ${blocking.length} > baseline ${baseline.count}`
        )
      }
      if (!failed) console.log('[dependency-audit] OK — no blocking regressions vs baseline')
    } else {
      console.log('[dependency-audit] no baseline present; run with --update-baseline to record the current state')
    }
  }

  process.exit(failed ? 1 : 0)
}

const isDirectRun = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)

if (isDirectRun) {
  main().catch((err) => {
    console.error('[dependency-audit] unexpected error', err)
    process.exit(2)
  })
}
