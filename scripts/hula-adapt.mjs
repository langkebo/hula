#!/usr/bin/env node
/**
 * hula-adapt — single-shot backend adaptation bootstrap.
 *
 * Plan §20.11 operationalises "前端项目通过集成 SDK 即可一次性完成与后端
 * 项目的全量适配" through this script. Running `pnpm hula:adapt` performs:
 *
 *   1. Toolchain check   — Node >= 22.12, pnpm >= 10
 *   2. SDK pin verify     — calls scripts/verify-sdk-pin.mjs
 *   3. Env schema check   — calls scripts/verify-env.mjs (current mode)
 *   4. Ledger diff        — compares ledger_schema of installed SDK vs pin
 *   5. Transport audit    — runs scripts/audit-transport-inventory.mjs and
 *                           flags violations of the approved boundary
 *   6. Capability probe   — (optional) hits the configured homeserver's
 *                           `/_matrix/client/versions`; timeout 5 s;
 *                           skipped if VITE_HOMESERVER_URL is missing or
 *                           the network is unavailable
 *
 * Emits docs/generated/compatibility-report.md summarising each step. Exit
 * code is 0 only when every mandatory step passes; the capability probe is
 * advisory.
 */

import { execFileSync, spawnSync } from 'node:child_process'
import fs from 'node:fs'
import http from 'node:http'
import https from 'node:https'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const outDir = path.join(repoRoot, 'docs', 'generated')
const outPath = path.join(outDir, 'compatibility-report.md')

const MIN_NODE = [22, 12, 0]
const MIN_PNPM = [10, 0, 0]

function cmp(a, b) {
  for (let i = 0; i < a.length; i++) {
    const x = a[i] ?? 0
    const y = b[i] ?? 0
    if (x < y) return -1
    if (x > y) return 1
  }
  return 0
}

function parseSemver(raw) {
  const m = /(\d+)\.(\d+)\.(\d+)/.exec(raw || '')
  return m ? [Number(m[1]), Number(m[2]), Number(m[3])] : [0, 0, 0]
}

function runNodeScript(relPath, args = [], env = {}) {
  const abs = path.join(repoRoot, relPath)
  const result = spawnSync(process.execPath, [abs, ...args], {
    cwd: repoRoot,
    env: { ...process.env, ...env },
    encoding: 'utf8',
  })
  return {
    ok: result.status === 0,
    status: result.status ?? -1,
    stdout: result.stdout || '',
    stderr: result.stderr || '',
  }
}

function step(name, fn) {
  const start = Date.now()
  let outcome = { status: 'fail', detail: '' }
  try {
    const r = fn()
    outcome = r
  } catch (err) {
    outcome = { status: 'fail', detail: err?.message || String(err) }
  }
  const duration = Date.now() - start
  return { name, duration, ...outcome }
}

function stepToolchain() {
  const node = parseSemver(process.versions.node)
  const pnpmRaw = (() => {
    try {
      return execFileSync('pnpm', ['--version'], { encoding: 'utf8' }).trim()
    } catch {
      return ''
    }
  })()
  const pnpm = parseSemver(pnpmRaw)
  const nodeOk = cmp(node, MIN_NODE) >= 0
  const pnpmOk = pnpmRaw !== '' && cmp(pnpm, MIN_PNPM) >= 0
  if (nodeOk && pnpmOk) {
    return { status: 'pass', detail: `node=${node.join('.')}, pnpm=${pnpmRaw}` }
  }
  const parts = []
  if (!nodeOk) parts.push(`node ${node.join('.')} < ${MIN_NODE.join('.')}`)
  if (!pnpmOk) parts.push(pnpmRaw ? `pnpm ${pnpmRaw} < ${MIN_PNPM.join('.')}` : 'pnpm missing')
  return { status: 'fail', detail: parts.join(', ') }
}

function stepSdkPin() {
  const r = runNodeScript('scripts/verify-sdk-pin.mjs')
  return {
    status: r.ok ? 'pass' : 'fail',
    detail: (r.stdout + r.stderr).trim() || `exit ${r.status}`,
  }
}

function stepEnv() {
  const r = runNodeScript('scripts/verify-env.mjs')
  return {
    status: r.ok ? 'pass' : 'fail',
    detail: (r.stdout + r.stderr).trim() || `exit ${r.status}`,
  }
}

function stepLedgerDiff() {
  const pinPath = path.join(repoRoot, 'meta', 'sdk-pin.json')
  const sdkLedgerIndex = path.join(
    repoRoot,
    '..',
    'matrix-js-sdk',
    'docs',
    'api-contract',
    'generated',
    'index.json',
  )
  if (!fs.existsSync(pinPath)) return { status: 'fail', detail: 'meta/sdk-pin.json missing' }
  if (!fs.existsSync(sdkLedgerIndex)) {
    return { status: 'warn', detail: 'matrix-js-sdk ledger index.json not found (tarball mode?)' }
  }
  const pin = JSON.parse(fs.readFileSync(pinPath, 'utf8'))
  const ledger = JSON.parse(fs.readFileSync(sdkLedgerIndex, 'utf8'))
  const ledgerSchema = String(ledger.schema_version ?? ledger.ledger_schema ?? '')
  if (pin.ledger_schema && ledgerSchema && pin.ledger_schema !== ledgerSchema) {
    return {
      status: 'fail',
      detail: `ledger_schema mismatch: pin=${pin.ledger_schema} sdk=${ledgerSchema}`,
    }
  }
  const moduleCount = Object.keys(ledger.modules ?? {}).length
  return { status: 'pass', detail: `ledger_schema=${ledgerSchema || 'unknown'}, modules=${moduleCount}` }
}

function stepTransport() {
  const r = runNodeScript('scripts/audit-transport-inventory.mjs')
  if (!r.ok) return { status: 'fail', detail: (r.stderr || r.stdout).trim() }
  const reportPath = path.join(repoRoot, 'docs', 'generated', 'transport-inventory.json')
  if (!fs.existsSync(reportPath)) return { status: 'fail', detail: 'report not written' }
  const report = JSON.parse(fs.readFileSync(reportPath, 'utf8'))
  const s = report.summary
  const total = s.authedRequest.violations + s.rawFetch.violations
  if (total === 0) {
    return {
      status: 'pass',
      detail: `authedRequest=${s.authedRequest.total}/${s.authedRequest.violations}, fetch=${s.rawFetch.total}/${s.rawFetch.violations}`,
    }
  }
  return {
    status: 'warn',
    detail: `${total} call site(s) outside approved boundary; see docs/generated/transport-inventory.json`,
  }
}

function probe(url, timeoutMs = 5000) {
  return new Promise((resolve) => {
    let settled = false
    const lib = url.startsWith('https://') ? https : http
    const t = setTimeout(() => {
      if (!settled) {
        settled = true
        resolve({ ok: false, error: 'timeout' })
      }
    }, timeoutMs)
    try {
      const req = lib.get(url, (res) => {
        clearTimeout(t)
        let body = ''
        res.setEncoding('utf8')
        res.on('data', (chunk) => {
          if (body.length < 4096) body += chunk
        })
        res.on('end', () => {
          if (!settled) {
            settled = true
            resolve({ ok: (res.statusCode ?? 0) < 400, statusCode: res.statusCode, body })
          }
        })
      })
      req.on('error', (err) => {
        clearTimeout(t)
        if (!settled) {
          settled = true
          resolve({ ok: false, error: err.message })
        }
      })
    } catch (err) {
      clearTimeout(t)
      resolve({ ok: false, error: err?.message || String(err) })
    }
  })
}

async function stepCapabilityProbe() {
  const homeserver = process.env.VITE_HOMESERVER_URL || readEnvKey('VITE_HOMESERVER_URL')
  if (!homeserver) {
    return { status: 'skip', detail: 'VITE_HOMESERVER_URL unset' }
  }
  const base = homeserver.replace(/\/$/, '')
  const url = `${base}/_matrix/client/versions`
  const r = await probe(url)
  if (!r.ok) {
    return { status: 'warn', detail: `probe ${url}: ${r.error || `HTTP ${r.statusCode}`}` }
  }
  try {
    const json = JSON.parse(r.body || '{}')
    const versions = Array.isArray(json.versions) ? json.versions.length : 0
    const unstable = Object.keys(json.unstable_features || {}).length
    return {
      status: 'pass',
      detail: `${url} → HTTP ${r.statusCode}, versions=${versions}, unstable_features=${unstable}`,
    }
  } catch {
    return { status: 'warn', detail: `${url} → HTTP ${r.statusCode}, non-JSON body` }
  }
}

function readEnvKey(key) {
  const chain = ['.env', '.env.local']
  for (const f of chain) {
    const p = path.join(repoRoot, f)
    if (!fs.existsSync(p)) continue
    for (const raw of fs.readFileSync(p, 'utf8').split(/\r?\n/)) {
      const line = raw.trim()
      if (!line || line.startsWith('#')) continue
      const eq = line.indexOf('=')
      if (eq < 0) continue
      if (line.slice(0, eq).trim() === key) {
        let v = line.slice(eq + 1).trim()
        if (v.startsWith('"') && v.endsWith('"')) v = v.slice(1, -1)
        return v
      }
    }
  }
  return ''
}

function renderReport(results) {
  const iconFor = (s) =>
    s === 'pass' ? '[PASS]' : s === 'warn' ? '[WARN]' : s === 'skip' ? '[SKIP]' : '[FAIL]'

  const lines = [
    '# HuLa Compatibility Report',
    '',
    `Generated: ${new Date().toISOString()}`,
    `Plan: docs/HULA_SDK_REINTEGRATION_OPTIMIZATION_PLAN_2026-05-03.md §20.11`,
    '',
    '## Summary',
    '',
    '| Step | Status | Duration | Detail |',
    '| --- | --- | --- | --- |',
  ]
  for (const r of results) {
    const detail = (r.detail || '').split('\n').slice(0, 3).join(' / ').slice(0, 300)
    lines.push(
      `| ${r.name} | ${iconFor(r.status)} | ${r.duration} ms | ${detail.replace(/\|/g, '\\|')} |`,
    )
  }
  lines.push('')
  lines.push('## Details')
  lines.push('')
  for (const r of results) {
    lines.push(`### ${r.name} — ${iconFor(r.status)}`)
    lines.push('')
    lines.push('```text')
    lines.push(r.detail || '(no detail)')
    lines.push('```')
    lines.push('')
  }
  return lines.join('\n') + '\n'
}

async function main() {
  const results = []
  results.push({ ...step('toolchain', stepToolchain) })
  results.push({ ...step('sdk-pin', stepSdkPin) })
  results.push({ ...step('env', stepEnv) })
  results.push({ ...step('ledger-diff', stepLedgerDiff) })
  results.push({ ...step('transport-audit', stepTransport) })

  // Async step, run outside the step() helper
  const probeStart = Date.now()
  let probeResult = { status: 'skip', detail: 'probe not executed' }
  try {
    probeResult = await stepCapabilityProbe()
  } catch (err) {
    probeResult = { status: 'warn', detail: err?.message || String(err) }
  }
  results.push({ name: 'capability-probe', duration: Date.now() - probeStart, ...probeResult })

  fs.mkdirSync(outDir, { recursive: true })
  fs.writeFileSync(outPath, renderReport(results))

  // Log to stdout
  for (const r of results) {
    const tag =
      r.status === 'pass'
        ? 'PASS'
        : r.status === 'warn'
          ? 'WARN'
          : r.status === 'skip'
            ? 'SKIP'
            : 'FAIL'
    process.stdout.write(`  [${tag}] ${r.name} (${r.duration} ms) — ${r.detail}\n`)
  }
  process.stdout.write(
    `\nhula-adapt: wrote ${path.relative(repoRoot, outPath)}\n`,
  )

  const blockers = results.filter(
    (r) => r.status === 'fail' && r.name !== 'capability-probe',
  )
  if (blockers.length > 0) {
    process.stderr.write(
      `\nhula-adapt: ${blockers.length} blocking failure(s): ${blockers.map((b) => b.name).join(', ')}\n`,
    )
    process.exit(1)
  }
}

main().catch((err) => {
  process.stderr.write(`hula-adapt: fatal: ${err?.stack || err}\n`)
  process.exit(1)
})
