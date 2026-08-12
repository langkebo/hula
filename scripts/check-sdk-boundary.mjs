#!/usr/bin/env node
/**
 * §5.2 / §21.2 P1 — SDK boundary gate (ratcheting).
 *
 * Enforces that the only files allowed to import from `matrix-js-sdk` or any
 * of its subpaths are the sanctioned boundary modules. Every other file in
 * `src/**` is a violator; the current violator set is frozen in
 * `scripts/sdk-boundary-baseline.json` and may only shrink.
 *
 * CI fails when:
 *   - a new violator appears that is not in the baseline, OR
 *   - the total violator count exceeds the baseline count.
 *
 * Refresh the baseline intentionally with `--update-baseline` (or env
 * `SDK_BOUNDARY_BASELINE_UPDATE=1`). The baseline count MUST only shrink.
 *
 * Usage:
 *   node scripts/check-sdk-boundary.mjs                 # ratchet check
 *   node scripts/check-sdk-boundary.mjs --json          # machine report
 *   node scripts/check-sdk-boundary.mjs --strict        # fail on ANY violation
 *   node scripts/check-sdk-boundary.mjs --update-baseline
 *
 * Exit codes:
 *   0  no regression vs baseline (or strict mode with zero violators)
 *   1  regression detected
 *   2  scan failure
 */

import { readdir, readFile, stat, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const projectRoot = path.resolve(__dirname, '..')
const srcRoot = path.join(projectRoot, 'src')
const baselineFile = path.join(projectRoot, 'scripts', 'sdk-boundary-baseline.json')

const args = new Set(process.argv.slice(2))
const jsonOutput = args.has('--json')
const strictMode = args.has('--strict')
const updateBaseline = args.has('--update-baseline') || process.env.SDK_BOUNDARY_BASELINE_UPDATE === '1'

/**
 * Paths (repo-relative) that are authorized to import from matrix-js-sdk.
 * Anything else importing from `matrix-js-sdk` / `matrix-js-sdk/*` is a violation.
 */
const ALLOWED_BOUNDARY_FILES = new Set([
  'src/services/matrix/sdk.ts',
  'src/services/matrix/sdk-entry.ts',
  'src/services/matrix/sdk-compat.ts',
  'src/services/matrix/sdk-errors.ts',
  'src/types/matrix-js-sdk/index.ts',
  'src/types/matrix-js-sdk-augmentations.d.ts',
  // Worker SDK boundary — runs matrix-js-sdk in a dedicated thread.
  // These files are the Worker's equivalent of sdk.ts: they own the SDK
  // instance and expose it to sibling handler modules via shared state.
  'src/workers/workerState.ts',
  'src/workers/workerClientHandlers.ts'
])

/**
 * Paths (repo-relative) that are authorized to call `client.http.authedRequest()`
 * directly. `MatrixRequestHelper` is the canonical adapter (`safeGet`/`safePost`/
 * `safePut`/`safeDelete`); every other production caller is bypassing the
 * fallback-API governance contract in §6.3 of the reintegration plan.
 *
 * Test files (`__tests__/`) are excluded by the scanner — they only mock the
 * surface, they do not exercise it.
 */
const ALLOWED_AUTHED_REQUEST_FILES = new Set([
  'src/services/matrix/MatrixRequestHelper.ts'
])

const FILE_PATTERN = /\.(ts|tsx|d\.ts|vue)$/
const SKIP_PATTERN = /(^|\/)(node_modules|dist|dist-electron|coverage)(\/|$)/
const TEST_PATTERN = /(^|\/)__tests__\//
// Matches static imports/re-exports of `matrix-js-sdk` and its subpaths.
// The binding list between `import` and `from` must tolerate newlines so
// multi-line `import type { A, B, C } from 'matrix-js-sdk/dm'` is caught.
const IMPORT_RE = /(?:^|\n)\s*(?:import\s+(?:type\s+)?(?:[\s\S]*?\s+from\s+)?|export\s+(?:\*|\{[\s\S]*?\})\s+from\s+)['"](matrix-js-sdk(?:\/[^'"]+)?)['"]/g
// Matches dynamic import forms the static IMPORT_RE does not catch:
//   await import('matrix-js-sdk')
//   typeof import('matrix-js-sdk/core')
//   import('matrix-js-sdk').MatrixClient   (inline type reference)
const DYNAMIC_IMPORT_RE = /\bimport\s*\(\s*['"](matrix-js-sdk(?:\/[^'"]+)?)['"]\s*\)/g
// Matches direct calls to `client.http.authedRequest(...)` or aliased
// equivalents like `http.authedRequest(...)` / `someClient.http.authedRequest(...)`.
// We deliberately match `.authedRequest(` as a method call — type-declaration
// references in `.d.ts` files are allowed (declarations don't perform requests).
const AUTHED_REQUEST_RE = /\.authedRequest\s*\(/g
// Matches raw `client.http.request(...)` and `.requestOtherUrl(...)` calls.
// These bypass the fallback-API adapter and the canonical `authedRequest`
// contract. No production code should use them outside the adapter boundary.
const HTTP_REQUEST_RE = /\.http\.(request|requestOtherUrl)\s*\(/g
// Matches SDK-type laundering casts of the form `as unknown as <SDK-type>`.
// This double-cast forces shape mismatch past the compiler's normal
// assignability checks and silently fabricates SDK-typed values from arbitrary
// structures. Legitimate probe-typing (e.g. `as unknown as Record<string, unknown>`
// to peek at extension fields on an SDK object) is not matched because those
// targets are not concrete SDK types.
const SDK_UNKNOWN_CAST_RE = /\bas\s+unknown\s+as\s+(MatrixClient|MatrixEvent|Room|RoomMember|User|SlidingSync)\b/g

async function* walk(dir) {
  let entries
  try {
    entries = await readdir(dir, { withFileTypes: true })
  } catch (err) {
    if (err.code === 'ENOENT') return
    throw err
  }
  for (const entry of entries) {
    const full = path.join(dir, entry.name)
    if (SKIP_PATTERN.test(full)) continue
    if (entry.isDirectory()) {
      yield* walk(full)
    } else if (entry.isFile() && FILE_PATTERN.test(full)) {
      yield full
    }
  }
}

function scanFileText(text) {
  // Strip comments before running the import regex. `[\s\S]*?` in IMPORT_RE
  // spans newlines (so multi-line imports are caught) but it also happily
  // walks from an unrelated `import` line into a later comment that mentions
  // `from 'matrix-js-sdk'`, producing false positives. Stripping first
  // eliminates that failure mode without losing coverage of real imports.
  const stripped = stripComments(text)
  const imports = []
  IMPORT_RE.lastIndex = 0
  let m
  while ((m = IMPORT_RE.exec(stripped)) !== null) {
    imports.push({ specifier: m[1], dynamic: false })
  }
  DYNAMIC_IMPORT_RE.lastIndex = 0
  while ((m = DYNAMIC_IMPORT_RE.exec(stripped)) !== null) {
    imports.push({ specifier: m[1], dynamic: true })
  }
  return imports
}

function stripComments(text) {
  // Replace comments with equivalent whitespace so line/column offsets stay
  // stable for anything that consumes the output later.
  let out = ''
  let i = 0
  const n = text.length
  while (i < n) {
    const c = text[i]
    const next = text[i + 1]
    if (c === '/' && next === '/') {
      const end = text.indexOf('\n', i)
      const stop = end === -1 ? n : end
      out += ' '.repeat(stop - i)
      i = stop
      continue
    }
    if (c === '/' && next === '*') {
      const end = text.indexOf('*/', i + 2)
      const stop = end === -1 ? n : end + 2
      for (let k = i; k < stop; k++) out += text[k] === '\n' ? '\n' : ' '
      i = stop
      continue
    }
    if (c === '"' || c === "'" || c === '`') {
      // Skip string literals so a `//` or `/*` inside them isn't mistaken for a comment.
      const quote = c
      out += c
      i++
      while (i < n) {
        const ch = text[i]
        out += ch
        if (ch === '\\' && i + 1 < n) {
          out += text[i + 1]
          i += 2
          continue
        }
        i++
        if (ch === quote) break
      }
      continue
    }
    out += c
    i++
  }
  return out
}

function scanAuthedRequestCalls(text) {
  const hits = []
  AUTHED_REQUEST_RE.lastIndex = 0
  let m
  while ((m = AUTHED_REQUEST_RE.exec(text)) !== null) {
    // 1-based line number of the match start
    const line = text.slice(0, m.index).split('\n').length
    hits.push({ line })
  }
  return hits
}

function scanHttpRequestCalls(text) {
  const hits = []
  HTTP_REQUEST_RE.lastIndex = 0
  let m
  while ((m = HTTP_REQUEST_RE.exec(text)) !== null) {
    const line = text.slice(0, m.index).split('\n').length
    hits.push({ line, method: m[1] })
  }
  return hits
}

function scanSdkUnknownCasts(text) {
  const hits = []
  SDK_UNKNOWN_CAST_RE.lastIndex = 0
  let m
  while ((m = SDK_UNKNOWN_CAST_RE.exec(text)) !== null) {
    const line = text.slice(0, m.index).split('\n').length
    hits.push({ line, type: m[1] })
  }
  return hits
}

function classifySpecifier(specifier, dynamic) {
  // 'matrix-js-sdk' → bare; 'matrix-js-sdk/core' → subpath 'core'
  const base = specifier === 'matrix-js-sdk'
    ? { kind: 'bare', subpath: null }
    : { kind: 'subpath', subpath: specifier.slice('matrix-js-sdk/'.length) }
  if (dynamic) return { ...base, kind: `${base.kind}-dynamic` }
  return base
}

function keyOf(entry) {
  if (entry.kind === 'authed-request') {
    // Per-file ordinal: stable under within-file refactors; only changes
    // when a new call is added (ordinal grows) or one is removed (shrinks).
    return `${entry.file}::authedRequest#${entry.ordinal}`
  }
  if (entry.kind === 'http-request') {
    return `${entry.file}::http.${entry.method}#${entry.ordinal}`
  }
  if (entry.kind === 'sdk-unknown-cast') {
    return `${entry.file}::unknown-as-${entry.type}#${entry.ordinal}`
  }
  return `${entry.file}::${entry.specifier}${entry.dynamic ? '::dynamic' : ''}`
}

async function loadBaseline() {
  try {
    const text = await readFile(baselineFile, 'utf8')
    const parsed = JSON.parse(text)
    if (!parsed || typeof parsed !== 'object' || !Array.isArray(parsed.violations)) {
      throw new Error('baseline shape invalid; expected { count, violations[] }')
    }
    return {
      count: Number(parsed.count ?? parsed.violations.length),
      violations: new Set(parsed.violations)
    }
  } catch (err) {
    if (err && err.code === 'ENOENT') return null
    throw err
  }
}

async function writeBaseline(violations) {
  const sorted = [...violations.map(keyOf)].sort()
  const payload = {
    generatedAt: new Date().toISOString(),
    count: sorted.length,
    violations: sorted
  }
  await writeFile(baselineFile, `${JSON.stringify(payload, null, 2)}\n`, 'utf8')
}

async function main() {
  try {
    await stat(srcRoot)
  } catch {
    console.error(`[sdk-boundary] src root not found: ${srcRoot}`)
    process.exit(2)
  }

  const violations = []
  let scanned = 0

  for await (const file of walk(srcRoot)) {
    scanned++
    let text
    try {
      text = await readFile(file, 'utf8')
    } catch (err) {
      console.error(`[sdk-boundary] failed to read ${file}: ${err.message}`)
      process.exit(2)
    }

    const rel = path.relative(projectRoot, file).split(path.sep).join('/')
    const isTest = TEST_PATTERN.test(rel)

    const imports = scanFileText(text)
    if (imports.length > 0 && !ALLOWED_BOUNDARY_FILES.has(rel)) {
      for (const imp of imports) {
        const classification = classifySpecifier(imp.specifier, imp.dynamic)
        violations.push({
          file: rel,
          specifier: imp.specifier,
          kind: classification.kind,
          subpath: classification.subpath,
          dynamic: imp.dynamic
        })
      }
    }

    // authedRequest channel — skip tests and the canonical adapter file.
    if (!isTest && !ALLOWED_AUTHED_REQUEST_FILES.has(rel)) {
      const calls = scanAuthedRequestCalls(text)
      // Sort by line so the per-file ordinal is stable; refactors that move
      // call sites within the file stay matched against baseline as long as
      // the call count doesn't change.
      calls.sort((a, b) => a.line - b.line)
      calls.forEach((call, idx) => {
        violations.push({
          file: rel,
          specifier: 'authedRequest',
          kind: 'authed-request',
          line: call.line,
          ordinal: idx + 1
        })
      })
    }

    // http.request / http.requestOtherUrl channel — skip tests; no file is
    // currently allowlisted (no production caller exists). Adapter files are
    // still scanned because even the adapter should not bypass `authedRequest`.
    if (!isTest) {
      const calls = scanHttpRequestCalls(text)
      calls.sort((a, b) => a.line - b.line)
      calls.forEach((call, idx) => {
        violations.push({
          file: rel,
          specifier: `http.${call.method}`,
          kind: 'http-request',
          method: call.method,
          line: call.line,
          ordinal: idx + 1
        })
      })
    }

    // SDK-type laundering channel — `as unknown as <SDK-concrete-type>`.
    // Skip tests (mocks routinely fabricate shapes) and the augmentation
    // adapter files (they legitimately describe SDK-shaped contracts).
    if (!isTest && !ALLOWED_BOUNDARY_FILES.has(rel)) {
      const casts = scanSdkUnknownCasts(text)
      casts.sort((a, b) => a.line - b.line)
      casts.forEach((cast, idx) => {
        violations.push({
          file: rel,
          specifier: `as unknown as ${cast.type}`,
          kind: 'sdk-unknown-cast',
          type: cast.type,
          line: cast.line,
          ordinal: idx + 1
        })
      })
    }
  }

  if (updateBaseline) {
    await writeBaseline(violations)
    console.log(
      `[sdk-boundary] baseline updated: ${violations.length} violation(s) recorded at ${path.relative(
        projectRoot,
        baselineFile
      )}`
    )
    process.exit(0)
  }

  const baseline = await loadBaseline()
  const currentKeys = new Set(violations.map(keyOf))

  let regressed = []
  let fixed = []
  if (baseline) {
    regressed = violations.filter((v) => !baseline.violations.has(keyOf(v)))
    fixed = [...baseline.violations].filter((k) => !currentKeys.has(k))
  }

  const byKind = violations.reduce((acc, v) => {
    acc[v.kind] = (acc[v.kind] ?? 0) + 1
    return acc
  }, {})

  const report = {
    scanned,
    currentViolations: violations.length,
    baselineViolations: baseline?.count ?? null,
    byKind,
    newRegressions: regressed,
    nowResolved: fixed
  }

  if (jsonOutput) {
    process.stdout.write(`${JSON.stringify(report, null, 2)}\n`)
  } else {
    console.log(`[sdk-boundary] scanned ${scanned} source file(s) under src/`)
    console.log(
      `[sdk-boundary] current violations: ${violations.length} (bare=${byKind.bare ?? 0}, subpath=${byKind.subpath ?? 0}, bare-dynamic=${byKind['bare-dynamic'] ?? 0}, subpath-dynamic=${byKind['subpath-dynamic'] ?? 0}, authed-request=${byKind['authed-request'] ?? 0}, http-request=${byKind['http-request'] ?? 0}, sdk-unknown-cast=${byKind['sdk-unknown-cast'] ?? 0})`
    )
    if (baseline) {
      console.log(`[sdk-boundary] baseline violations: ${baseline.count}`)
      if (fixed.length > 0) console.log(`[sdk-boundary] ${fixed.length} violation(s) resolved since baseline`)
      if (regressed.length > 0) {
        console.log(`[sdk-boundary] FAIL — ${regressed.length} new violation(s):`)
        for (const v of regressed) {
          if (v.kind === 'authed-request') {
            console.log(`  ${v.file}:${v.line}  <- authedRequest()`)
          } else if (v.kind === 'http-request') {
            console.log(`  ${v.file}:${v.line}  <- http.${v.method}()`)
          } else if (v.kind === 'sdk-unknown-cast') {
            console.log(`  ${v.file}:${v.line}  <- as unknown as ${v.type}`)
          } else {
            console.log(`  ${v.file}  <- '${v.specifier}'`)
          }
        }
      } else {
        console.log('[sdk-boundary] OK — no regressions vs baseline')
      }
    } else {
      console.log('[sdk-boundary] no baseline present; run with --update-baseline to record the current state')
    }
  }

  if (strictMode) {
    process.exit(violations.length === 0 ? 0 : 1)
  }
  process.exit(regressed.length === 0 ? 0 : 1)
}

main().catch((err) => {
  console.error('[sdk-boundary] unexpected error', err)
  process.exit(2)
})
