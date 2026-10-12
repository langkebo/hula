#!/usr/bin/env node
/**
 * DP-01 — Vendored-SDK runtime dependency guard (P2.5-2).
 *
 * The six packages below are NOT dead weight: they are direct runtime
 * `dependencies` of the vendored `matrix-js-sdk` tarball whose source is
 * imported as raw TypeScript via Vite alias. The SDK value-imports them
 * (`content-type`, `loglevel`, `matrix-events-sdk`, `matrix-widget-api`,
 * `sdp-transform`) or reaches Node's `events` builtin, and because the SDK
 * lives under `node_modules` in tarball mode Vite will not pre-bundle those
 * CJS deps on its own. They must therefore be listed in BOTH:
 *
 *   1. `package.json` `dependencies` (so they resolve from the project root), and
 *   2. `build/config/vite.config.base.ts` `optimizeDeps.include` (so Vite
 *      pre-bundles them into ESM).
 *
 * Dropping either half re-triggers the 2026-08-09 login-page white screen
 * (`does not provide an export named 'EventEmitter'`). The dependency report
 * originally flagged these as "zero direct references → likely removable";
 * the runtime evidence says the opposite, so we freeze the binding and fail
 * loudly instead of silently deleting it. See
 * `docs/baseline/dependency-vendor-runtime.md`.
 *
 * Usage:
 *   node scripts/check-vendor-runtime-deps.mjs           # guard check
 *   node scripts/check-vendor-runtime-deps.mjs --json    # machine report
 *
 * Exit codes:
 *   0  all six packages present in both halves
 *   1  at least one package missing from either half
 *   2  scan failure (unreadable config)
 */

import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const projectRoot = path.resolve(__dirname, '..')
const packageJsonFile = path.join(projectRoot, 'package.json')
const viteConfigFile = path.join(projectRoot, 'build', 'config', 'vite.config.base.ts')

/**
 * The vendored-SDK runtime dependencies that must stay bound to
 * `optimizeDeps.include`. Kept in one place so the guard and the doc cannot
 * drift.
 */
export const VENDOR_RUNTIME_DEPS = [
  'content-type',
  'events',
  'loglevel',
  'matrix-events-sdk',
  'matrix-widget-api',
  'sdp-transform'
]

/**
 * Pure gate decision — no I/O, so it can be unit tested.
 *
 * @param {{ pkg?: { dependencies?: Record<string, string> }, optimizeDepsInclude?: string[] }} input
 * @returns {{ ok: boolean, missingFromDependencies: string[], missingFromOptimizeDeps: string[] }}
 */
export function evaluateVendorRuntimeDeps({ pkg, optimizeDepsInclude } = {}) {
  const declared = new Set(Object.keys(pkg?.dependencies ?? {}))
  const included = new Set(optimizeDepsInclude ?? [])
  const missingFromDependencies = VENDOR_RUNTIME_DEPS.filter((dep) => !declared.has(dep))
  const missingFromOptimizeDeps = VENDOR_RUNTIME_DEPS.filter((dep) => !included.has(dep))
  return {
    ok: missingFromDependencies.length === 0 && missingFromOptimizeDeps.length === 0,
    missingFromDependencies,
    missingFromOptimizeDeps
  }
}

/**
 * Extract the string literals of `optimizeDeps.include` from the Vite base
 * config source. Parsing the text keeps this guard dependency-free (the config
 * is TypeScript and cannot be imported from a plain `.mjs` script).
 *
 * @param {string} source raw `vite.config.base.ts` text
 * @returns {string[]}
 */
export function extractOptimizeDepsInclude(source) {
  const optimizeIdx = source.indexOf('optimizeDeps')
  if (optimizeIdx === -1) throw new Error('optimizeDeps block not found in vite.config.base.ts')
  const includeIdx = source.indexOf('include', optimizeIdx)
  if (includeIdx === -1) throw new Error('optimizeDeps.include not found in vite.config.base.ts')
  const openIdx = source.indexOf('[', includeIdx)
  if (openIdx === -1) throw new Error('optimizeDeps.include array not found')
  const closeIdx = source.indexOf(']', openIdx)
  if (closeIdx === -1) throw new Error('optimizeDeps.include array not terminated')
  const body = source.slice(openIdx + 1, closeIdx)
  const values = []
  const literal = /['"]([^'"]+)['"]/g
  let match
  while ((match = literal.exec(body)) !== null) {
    values.push(match[1])
  }
  return values
}

async function main() {
  const jsonOutput = process.argv.includes('--json')

  let pkg
  let source
  try {
    pkg = JSON.parse(await readFile(packageJsonFile, 'utf8'))
    source = await readFile(viteConfigFile, 'utf8')
  } catch (err) {
    console.error(`[vendor-runtime-deps] scan failed: ${err.message}`)
    process.exit(2)
  }

  let optimizeDepsInclude
  try {
    optimizeDepsInclude = extractOptimizeDepsInclude(source)
  } catch (err) {
    console.error(`[vendor-runtime-deps] ${err.message}`)
    process.exit(2)
  }

  const result = evaluateVendorRuntimeDeps({ pkg, optimizeDepsInclude })

  if (jsonOutput) {
    process.stdout.write(`${JSON.stringify({ ...result, checked: VENDOR_RUNTIME_DEPS }, null, 2)}\n`)
  } else if (result.ok) {
    console.log(`[vendor-runtime-deps] OK — all ${VENDOR_RUNTIME_DEPS.length} vendored-SDK runtime deps bound`)
  } else {
    console.error('[vendor-runtime-deps] FAIL — vendored-SDK runtime deps unbound:')
    if (result.missingFromDependencies.length > 0) {
      console.error(`  missing from package.json dependencies: ${result.missingFromDependencies.join(', ')}`)
    }
    if (result.missingFromOptimizeDeps.length > 0) {
      console.error(
        `  missing from optimizeDeps.include (vite.config.base.ts): ${result.missingFromOptimizeDeps.join(', ')}`
      )
    }
    console.error('  see docs/baseline/dependency-vendor-runtime.md — removing these re-triggers the 2026-08-09 white screen')
  }

  process.exit(result.ok ? 0 : 1)
}

const isDirectRun = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)

if (isDirectRun) {
  main().catch((err) => {
    console.error('[vendor-runtime-deps] unexpected error', err)
    process.exit(2)
  })
}
