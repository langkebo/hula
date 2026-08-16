#!/usr/bin/env node

/**
 * Ratchet guard: counts must never grow, only shrink.
 *
 * Counters:
 *  - matrix_prefix_hardcoded: hardcoded `/_matrix` paths in src (non-test).
 *    New requests must use the MatrixHttpClient gateway / relative paths
 *    instead of full-path literals (double-prefix bug source, see G2).
 *  - ts_expect_error: `@ts-expect-error` in src. strict: true is a hard red
 *    line (G1); per-line escapes are allowed but the count must not grow.
 *  - hardcoded_color: literal hex/rgb colors in src (non-test, excluding
 *    SVG `<use href="#...">` refs and comments). New colors should use
 *    `--tjg-*` design tokens instead of raw literals.
 *
 * Usage:
 *   node scripts/check-ratchet.mjs            # verify (CI / pre-merge)
 *   node scripts/check-ratchet.mjs --update   # tighten baseline after cleanup
 */

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const baselinePath = path.join(repoRoot, 'meta', 'ratchet-baseline.json')
const srcRoot = path.join(repoRoot, 'src')

const SOURCE_EXTENSIONS = new Set(['.ts', '.mts', '.cts', '.tsx', '.vue'])

function isTestPath(relPath) {
  return (
    relPath.includes('__tests__') ||
    /\.(test|spec)\.[cm]?tsx?$/.test(relPath) ||
    relPath.endsWith('.stories.ts')
  )
}

function* walk(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name)
    if (entry.isDirectory()) {
      yield* walk(fullPath)
    } else if (entry.isFile() && SOURCE_EXTENSIONS.has(path.extname(entry.name))) {
      yield fullPath
    }
  }
}

function countOccurrences(content, pattern) {
  return (content.match(pattern) ?? []).length
}

/** 去除注释与 SVG 图标引用，避免把 `#add`/`#close` 这类 `<use href="#...">` 误判为硬编码颜色 */
function stripCommentsAndSvgRefs(content) {
  return content
    .replace(/\/\/[^\n]*/g, '') // 行注释
    .replace(/\/\*[\s\S]*?\*\//g, '') // 块注释
    .replace(/href\s*=\s*["']#[^"']*["']/g, '') // SVG use href
}

const counters = {
  matrix_prefix_hardcoded: { pattern: /\/_matrix/g, includeTests: false, total: 0, files: new Map() },
  ts_expect_error: { pattern: /@ts-expect-error/g, includeTests: true, total: 0, files: new Map() },
  hardcoded_color: {
    pattern: /#[0-9a-fA-F]{3,8}\b|rgba?\(\s*[0-9]/g,
    includeTests: false,
    total: 0,
    files: new Map(),
    strip: stripCommentsAndSvgRefs
  }
}

for (const filePath of walk(srcRoot)) {
  const relPath = path.relative(repoRoot, filePath)
  const content = fs.readFileSync(filePath, 'utf8')
  for (const counter of Object.values(counters)) {
    if (!counter.includeTests && isTestPath(relPath)) continue
    const text = counter.strip ? counter.strip(content) : content
    const count = countOccurrences(text, counter.pattern)
    if (count > 0) {
      counter.total += count
      counter.files.set(relPath, count)
    }
  }
}

const current = Object.fromEntries(Object.entries(counters).map(([name, c]) => [name, c.total]))

if (process.argv.includes('--update')) {
  const baseline = {
    comment:
      'Ratchet baseline: counts may only decrease. Regenerate with `node scripts/check-ratchet.mjs --update` after cleanup batches. See design doc G1/G2.',
    updated_at: new Date().toISOString(),
    counters: current
  }
  fs.mkdirSync(path.dirname(baselinePath), { recursive: true })
  fs.writeFileSync(baselinePath, `${JSON.stringify(baseline, null, 2)}\n`)
  console.log(`check-ratchet: baseline written to ${path.relative(repoRoot, baselinePath)}`)
  for (const [name, value] of Object.entries(current)) {
    console.log(`  ${name}: ${value}`)
  }
  process.exit(0)
}

if (!fs.existsSync(baselinePath)) {
  console.error(
    `check-ratchet: missing ${path.relative(repoRoot, baselinePath)}; run \`node scripts/check-ratchet.mjs --update\` once to create it.`
  )
  process.exit(1)
}

const baseline = JSON.parse(fs.readFileSync(baselinePath, 'utf8'))
let failed = false

for (const [name, counter] of Object.entries(counters)) {
  const allowed = baseline.counters?.[name]
  const actual = counter.total
  if (typeof allowed !== 'number') {
    console.error(`check-ratchet: FAIL ${name}: no baseline entry; re-run with --update.`)
    failed = true
    continue
  }
  if (actual > allowed) {
    console.error(`check-ratchet: FAIL ${name}: ${actual} > baseline ${allowed}. New occurrences are not allowed.`)
    const sorted = [...counter.files.entries()].sort((a, b) => b[1] - a[1]).slice(0, 15)
    for (const [file, count] of sorted) {
      console.error(`    ${count}\t${file}`)
    }
    failed = true
  } else if (actual < allowed) {
    console.log(
      `check-ratchet: OK ${name}: ${actual} (baseline ${allowed}) — tighten with \`node scripts/check-ratchet.mjs --update\`.`
    )
  } else {
    console.log(`check-ratchet: OK ${name}: ${actual} (baseline ${allowed})`)
  }
}

process.exit(failed ? 1 : 0)
