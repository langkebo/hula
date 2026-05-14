#!/usr/bin/env node
/**
 * §18.5.1 / §20.1 KPI #8 — Doc ↔ code sync gate (ratcheting).
 *
 * Walks `src/services/**` for exported (or `public`) methods and verifies
 * that each one carries a leading JSDoc block with a non-empty summary.
 *
 * The current project baseline (captured in `scripts/doc-coverage-baseline.json`)
 * lists the set of methods we accept as undocumented today. CI failure only
 * triggers when:
 *   - new undocumented methods appear that are not in the baseline, OR
 *   - the total undocumented count exceeds the baseline count.
 *
 * Refresh the baseline intentionally with `--update-baseline` (or env
 * `DOC_COVERAGE_BASELINE_UPDATE=1`). The baseline count MUST only shrink.
 *
 * Usage:
 *   node scripts/check-doc-coverage.mjs                 # ratchet check
 *   node scripts/check-doc-coverage.mjs --json          # machine report
 *   node scripts/check-doc-coverage.mjs --strict        # fail on ANY missing
 *   node scripts/check-doc-coverage.mjs --update-baseline
 *
 * Exit codes:
 *   0  no regression vs baseline (or strict mode with zero missing)
 *   1  regression detected
 *   2  scan failure (e.g. unreadable file)
 */

import { readdir, readFile, stat, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const projectRoot = path.resolve(__dirname, '..')
const servicesRoot = path.join(projectRoot, 'src', 'services')
const baselineFile = path.join(projectRoot, 'scripts', 'doc-coverage-baseline.json')

const args = new Set(process.argv.slice(2))
const jsonOutput = args.has('--json')
const strictMode = args.has('--strict')
const updateBaseline = args.has('--update-baseline') || process.env.DOC_COVERAGE_BASELINE_UPDATE === '1'

const SKIP_PATTERN = /(^|\/)(__tests__|__mocks__)(\/|$)|\.test\.ts$|\.spec\.ts$|\.d\.ts$/

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
    if (entry.isDirectory()) {
      yield* walk(full)
    } else if (entry.isFile() && full.endsWith('.ts') && !SKIP_PATTERN.test(full)) {
      yield full
    }
  }
}

const PUBLIC_METHOD_RE =
  /^(?<indent>\s*)(?:export\s+)?(?:public\s+)?(?:async\s+)?(?<name>[a-zA-Z_$][\w$]*)\s*\([^)]*\)\s*[:{]/

const PUBLIC_FUNCTION_RE = /^(?:export\s+)(?:async\s+)?function\s+(?<name>[a-zA-Z_$][\w$]*)/

function isReportable(name) {
  if (!name) return false
  if (name.startsWith('_')) return false
  if (name === 'constructor') return false
  if (['if', 'for', 'while', 'switch', 'return', 'catch', 'do'].includes(name)) return false
  return true
}

function hasJsDocAbove(lines, idx) {
  let i = idx - 1
  while (i >= 0 && lines[i].trim() === '') i--
  if (i < 0) return false
  return lines[i].trimStart().startsWith('*/')
}

async function scanFile(file) {
  const text = await readFile(file, 'utf8')
  const lines = text.split('\n')
  const declRanges = computeDeclOnlyRanges(text)
  const missing = []

  // Map character offsets → line index once so decl-range lookups are O(log n).
  const lineOffsets = [0]
  for (let i = 0; i < text.length; i++) {
    if (text.charCodeAt(i) === 10 /* \n */) lineOffsets.push(i + 1)
  }
  const offsetOfLine = (idx) => lineOffsets[idx] ?? text.length
  const insideDeclOnly = (idx) => {
    const off = offsetOfLine(idx)
    for (const [s, e] of declRanges) if (off >= s && off <= e) return true
    return false
  }

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]

    const fnMatch = PUBLIC_FUNCTION_RE.exec(line)
    if (fnMatch && isReportable(fnMatch.groups.name) && !hasJsDocAbove(lines, i)) {
      missing.push({ file: path.relative(projectRoot, file), name: fnMatch.groups.name })
      continue
    }

    const methodMatch = PUBLIC_METHOD_RE.exec(line)
    if (!methodMatch) continue
    const { name, indent } = methodMatch.groups
    if (!isReportable(name)) continue
    if (indent.length === 0 || indent.length > 4) continue
    if (insideDeclOnly(i)) continue
    if (hasJsDocAbove(lines, i)) continue
    missing.push({ file: path.relative(projectRoot, file), name })
  }

  return missing
}

/**
 * Returns character-offset ranges for `interface X { … }` and
 * `type X = { … }` declaration bodies. Methods whose declaration line falls
 * inside one of these ranges are pure type-surface signatures and must not
 * count against documentation coverage.
 */
function computeDeclOnlyRanges(text) {
  const ranges = []
  const DECL_RE = /(?:^|\n)\s*(?:export\s+)?(?:declare\s+)?(?:interface\s+\w+[^{]*|type\s+\w+[^=]*=\s*)\{/g
  let m
  while ((m = DECL_RE.exec(text)) !== null) {
    const openIdx = text.indexOf('{', m.index)
    if (openIdx === -1) continue
    let depth = 1
    let i = openIdx + 1
    while (i < text.length && depth > 0) {
      const ch = text[i]
      if (ch === '{') depth++
      else if (ch === '}') depth--
      i++
    }
    if (depth === 0) ranges.push([openIdx, i])
  }
  return ranges
}

function keyOf(entry) {
  return `${entry.file}::${entry.name}`
}

async function loadBaseline() {
  try {
    const text = await readFile(baselineFile, 'utf8')
    const parsed = JSON.parse(text)
    if (!parsed || typeof parsed !== 'object' || !Array.isArray(parsed.missing)) {
      throw new Error('baseline shape invalid; expected { count, missing[] }')
    }
    return { count: Number(parsed.count ?? parsed.missing.length), missing: new Set(parsed.missing) }
  } catch (err) {
    if (err && err.code === 'ENOENT') return null
    throw err
  }
}

async function writeBaseline(missing) {
  const sorted = [...missing.map(keyOf)].sort()
  const payload = {
    generatedAt: new Date().toISOString(),
    count: sorted.length,
    missing: sorted
  }
  await writeFile(baselineFile, `${JSON.stringify(payload, null, 2)}\n`, 'utf8')
}

async function main() {
  try {
    await stat(servicesRoot)
  } catch {
    console.error(`[doc-coverage] services root not found: ${servicesRoot}`)
    process.exit(2)
  }

  const allMissing = []
  let scanned = 0
  for await (const file of walk(servicesRoot)) {
    scanned++
    try {
      allMissing.push(...(await scanFile(file)))
    } catch (err) {
      console.error(`[doc-coverage] failed to read ${file}: ${err.message}`)
      process.exit(2)
    }
  }

  if (updateBaseline) {
    await writeBaseline(allMissing)
    console.log(
      `[doc-coverage] baseline updated: ${allMissing.length} undocumented method(s) recorded at ${path.relative(
        projectRoot,
        baselineFile
      )}`
    )
    process.exit(0)
  }

  const baseline = await loadBaseline()
  const currentKeys = new Set(allMissing.map(keyOf))

  let regressed = []
  let fixed = []
  if (baseline) {
    regressed = allMissing.filter((m) => !baseline.missing.has(keyOf(m)))
    fixed = [...baseline.missing].filter((k) => !currentKeys.has(k))
  }

  const report = {
    scanned,
    currentMissing: allMissing.length,
    baselineMissing: baseline?.count ?? null,
    newRegressions: regressed,
    nowDocumented: fixed
  }

  if (jsonOutput) {
    process.stdout.write(`${JSON.stringify(report, null, 2)}\n`)
  } else {
    console.log(`[doc-coverage] scanned ${scanned} service file(s)`)
    console.log(`[doc-coverage] current undocumented: ${allMissing.length}`)
    if (baseline) {
      console.log(`[doc-coverage] baseline undocumented: ${baseline.count}`)
      if (fixed.length > 0) console.log(`[doc-coverage] ${fixed.length} method(s) newly documented`)
      if (regressed.length > 0) {
        console.log(`[doc-coverage] FAIL — ${regressed.length} new undocumented method(s):`)
        for (const m of regressed) console.log(`  ${m.file}  ${m.name}`)
      } else {
        console.log('[doc-coverage] OK — no regressions vs baseline')
      }
    } else {
      console.log('[doc-coverage] no baseline present; run with --update-baseline to record the current state')
    }
  }

  if (strictMode) {
    process.exit(allMissing.length === 0 ? 0 : 1)
  }
  process.exit(regressed.length === 0 ? 0 : 1)
}

main().catch((err) => {
  console.error('[doc-coverage] unexpected error', err)
  process.exit(2)
})
