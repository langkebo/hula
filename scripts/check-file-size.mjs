#!/usr/bin/env node

/**
 * File size guard: prevents megastone files from growing.
 *
 * Rules:
 *  - New files (not in baseline): hard limit 400 lines (error)
 *  - Existing files in baseline >400 lines: warning, must not grow beyond baseline
 *  - Files >800 lines (red line): hard error, must be refactored before merge
 *  - Files >1000 lines: critical error
 *
 * Baseline exemptions: files already >400 lines when this guard was introduced
 * are tracked in meta/file-size-baseline.json. The count of oversized files
 * must never grow—only shrink. This is a ratchet on file count, not line count.
 *
 * Usage:
 *   node scripts/check-file-size.mjs            # verify (CI / pre-merge)
 *   node scripts/check-file-size.mjs --update   # regenerate baseline after cleanup
 *   node scripts/check-file-size.mjs --json     # output JSON for tooling
 */

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const baselinePath = path.join(repoRoot, 'meta', 'file-size-baseline.json')
const srcRoot = path.join(repoRoot, 'src')

const SOURCE_EXTENSIONS = new Set(['.ts', '.mts', '.cts', '.tsx', '.vue'])
const NEW_FILE_LIMIT = 400
const WARN_LIMIT = 500
const RED_LINE = 800
const CRITICAL_LIMIT = 1000

// Files exempt from critical error (documented megastone with active refactoring plan)
// Add entries here ONLY with an issue link and a deadline
const CRITICAL_EXEMPTIONS = new Set([
  // Example: 'src/services/matrix/admin/AdminFacadeService.ts' // facade pattern, 172/233 delegate methods
])

function isTestPath(relPath) {
  return (
    relPath.includes('__tests__') ||
    /\.(test|spec)\.[cm]?tsx?$/.test(relPath) ||
    relPath.endsWith('.stories.ts')
  )
}

function isGenerated(relPath) {
  // Auto-generated files: i18n types, sdk augmentations
  return (
    relPath.endsWith('i18n.d.ts') ||
    relPath.includes('matrix-js-sdk-augmentations.d.ts')
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

function countLines(filePath) {
  const content = fs.readFileSync(filePath, 'utf8')
  return content.split('\n').length
}

const violations = []
const oversizedFiles = [] // files > NEW_FILE_LIMIT, tracked in baseline
const newOversizedFiles = [] // files > NEW_FILE_LIMIT not in baseline
let totalFiles = 0

for (const filePath of walk(srcRoot)) {
  const relPath = path.relative(repoRoot, filePath)
  if (isTestPath(relPath) || isGenerated(relPath)) continue

  totalFiles++
  const lineCount = countLines(filePath)

  if (lineCount > RED_LINE) {
    violations.push({
      file: relPath,
      lines: lineCount,
      severity: lineCount > CRITICAL_LIMIT ? 'critical' : 'red-line',
      message:
        lineCount > CRITICAL_LIMIT
          ? `CRITICAL: ${relPath} is ${lineCount} lines (>${CRITICAL_LIMIT}). Must refactor before merge.`
          : `RED LINE: ${relPath} is ${lineCount} lines (>${RED_LINE}). Must refactor before merge.`
    })
  }

  if (lineCount > NEW_FILE_LIMIT) {
    oversizedFiles.push({ file: relPath, lines: lineCount })
  }
}

// Load baseline
let baseline = null
if (fs.existsSync(baselinePath)) {
  baseline = JSON.parse(fs.readFileSync(baselinePath, 'utf8'))
}

// Update mode: regenerate baseline
if (process.argv.includes('--update')) {
  const oversizedSorted = oversizedFiles.sort((a, b) => b.lines - a.lines)
  const newBaseline = {
    comment:
      'File size baseline: files >400 lines tracked here. Count must never grow, only shrink. Regenerate with `node scripts/check-file-size.mjs --update` after refactor batches.',
    updated_at: new Date().toISOString(),
    new_file_limit: NEW_FILE_LIMIT,
    warn_limit: WARN_LIMIT,
    red_line: RED_LINE,
    critical_limit: CRITICAL_LIMIT,
    total_oversized_files: oversizedSorted.length,
    files: oversizedSorted
  }
  fs.mkdirSync(path.dirname(baselinePath), { recursive: true })
  fs.writeFileSync(baselinePath, `${JSON.stringify(newBaseline, null, 2)}\n`)
  console.log(`check-file-size: baseline written to ${path.relative(repoRoot, baselinePath)}`)
  console.log(`  Total source files: ${totalFiles}`)
  console.log(`  Files >${NEW_FILE_LIMIT} lines: ${oversizedSorted.length}`)
  console.log(`  Files >${RED_LINE} lines (red line): ${oversizedSorted.filter(f => f.lines > RED_LINE).length}`)
  console.log(`  Files >${CRITICAL_LIMIT} lines (critical): ${oversizedSorted.filter(f => f.lines > CRITICAL_LIMIT).length}`)
  process.exit(0)
}

// JSON output mode
if (process.argv.includes('--json')) {
  const baselineFiles = new Set((baseline?.files ?? []).map(f => f.file))
  const newOversized = oversizedFiles.filter(f => !baselineFiles.has(f.file))
  console.log(
    JSON.stringify(
      {
        totalFiles,
        oversizedCount: oversizedFiles.length,
        newOversizedCount: newOversized.length,
        redLineCount: oversizedFiles.filter(f => f.lines > RED_LINE).length,
        criticalCount: oversizedFiles.filter(f => f.lines > CRITICAL_LIMIT).length,
        violations,
        newOversizedFiles: newOversized
      },
      null,
      2
    )
  )
  process.exit(0)
}

// Verify mode
if (!baseline) {
  console.error(
    `check-file-size: missing ${path.relative(repoRoot, baselinePath)}; run \`node scripts/check-file-size.mjs --update\` once to create it.`
  )
  process.exit(1)
}

let failed = false
const baselineFiles = new Map((baseline.files ?? []).map(f => [f.file, f.lines]))

// 1. Check red line / critical violations — only for files NOT in baseline
//    (baseline files are pre-existing megastones being actively refactored)
const baselineFileSet = new Set(baselineFiles.keys())
const newRedLineViolations = violations.filter(
  v => !CRITICAL_EXEMPTIONS.has(v.file) && !baselineFileSet.has(v.file)
)
if (newRedLineViolations.length > 0) {
  console.error(
    `check-file-size: FAIL — ${newRedLineViolations.length} NEW file(s) exceed red line (${RED_LINE} lines):`
  )
  for (const v of newRedLineViolations.sort((a, b) => b.lines - a.lines)) {
    console.error(`  ${v.message}`)
  }
  failed = true
}

// Report (not fail) existing red line files from baseline — these are tracked for refactoring
const existingRedLine = violations.filter(v => baselineFileSet.has(v.file))
if (existingRedLine.length > 0) {
  console.log(
    `check-file-size: INFO — ${existingRedLine.length} baseline file(s) exceed red line (tracked for refactoring, see P0-1/P0-2):`
  )
  for (const v of existingRedLine.sort((a, b) => b.lines - a.lines)) {
    console.log(`  ${v.message}`)
  }
}

// 2. Check new oversized files (not in baseline)
for (const f of oversizedFiles) {
  if (!baselineFileSet.has(f.file)) {
    newOversizedFiles.push(f)
  }
}

if (newOversizedFiles.length > 0) {
  console.error(
    `check-file-size: FAIL — ${newOversizedFiles.length} new file(s) exceed ${NEW_FILE_LIMIT} lines (not in baseline):`
  )
  for (const f of newOversizedFiles.sort((a, b) => b.lines - a.lines)) {
    console.error(`  ${f.file}: ${f.lines} lines (limit: ${NEW_FILE_LIMIT})`)
  }
  console.error('')
  console.error('  New files must be under 400 lines. Either:')
  console.error('  1. Refactor the file to be under 400 lines, or')
  console.error('  2. If intentional, update baseline with `node scripts/check-file-size.mjs --update`')
  failed = true
}

// 3. Check existing oversized files didn't grow
const grownFiles = []
for (const f of oversizedFiles) {
  const baselineLines = baselineFiles.get(f.file)
  if (baselineLines !== undefined && f.lines > baselineLines) {
    grownFiles.push({ ...f, baselineLines })
  }
}

if (grownFiles.length > 0) {
  console.error(
    `check-file-size: FAIL — ${grownFiles.length} baseline file(s) grew beyond their baseline:`
  )
  for (const f of grownFiles.sort((a, b) => b.lines - a.lines)) {
    console.error(`  ${f.file}: ${f.lines} lines (baseline: ${f.baselineLines}, grew by ${f.lines - f.baselineLines})`)
  }
  console.error('')
  console.error('  Oversized files must not grow. Either refactor or update baseline with --update.')
  failed = true
}

// 4. Report progress on shrinking oversized files
const currentOversizedCount = oversizedFiles.length
const baselineOversizedCount = baseline.total_oversized_files ?? baseline.files?.length ?? 0

if (currentOversizedCount < baselineOversizedCount) {
  console.log(
    `check-file-size: OK — oversized file count ${currentOversizedCount} < baseline ${baselineOversizedCount} (improved by ${baselineOversizedCount - currentOversizedCount}). Tighten with \`node scripts/check-file-size.mjs --update\`.`
  )
} else if (currentOversizedCount === baselineOversizedCount) {
  console.log(`check-file-size: OK — oversized file count ${currentOversizedCount} (baseline ${baselineOversizedCount})`)
}

if (!failed && newOversizedFiles.length === 0 && grownFiles.length === 0 && newRedLineViolations.length === 0) {
  console.log(`check-file-size: OK — all ${totalFiles} source files within size constraints.`)
}

process.exit(failed ? 1 : 0)
