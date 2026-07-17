#!/usr/bin/env node
/**
 * clean-runtime-state — safe cleanup (plan §4.4).
 *
 * Removes build outputs and dev caches but preserves lockfiles, source code,
 * and user app data. Use this before `pnpm install` when the repo is
 * misbehaving, or as part of a clean rebuild.
 *
 * Hard mode (`--hard`) additionally deletes Rust target, pnpm store fragments,
 * and emits guidance for browser/Tauri state that must be wiped manually
 * (we don't touch the user's ~/Library or Application Support without
 * explicit confirmation).
 *
 * Flags:
 *   --safe   (default) delete build outputs, dist, coverage, .vite, reports
 *   --hard   --safe + src-tauri/target + pnpm store prune + emit manual hints
 *   --dry    print what would be deleted without deleting
 *   --help   show usage
 */

import { execSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')

const SAFE_TARGETS = [
  'node_modules',
  'dist',
  'coverage',
  'playwright-report',
  'test-results',
  '.vite',
  'docs/generated/transport-inventory.json',
]

const HARD_EXTRA_TARGETS = ['src-tauri/target']

const MANUAL_HINTS = [
  'Browser state (run in DevTools on the HuLa origin):',
  '  for (const k of Object.keys(localStorage)) {',
  '    if (k.startsWith("hula-") || k.startsWith("draft_") || ["TOKEN","REFRESH_TOKEN","chat","group","contacts","cached","sessionUnread","proxySettings"].includes(k)) localStorage.removeItem(k);',
  '  }',
  '  sessionStorage.clear();',
  '  indexedDB.deleteDatabase("hula-matrix-sync");',
  '  indexedDB.deleteDatabase("hula-rageshake");',
  '  indexedDB.deleteDatabase("hula-offline-queue");',
  '  if ("caches" in window) caches.keys().then(n => n.forEach(x => caches.delete(x)));',
  '',
  'Tauri app state (only after confirming no debug session needs it):',
  '  macOS:   rm -rf "$HOME/Library/Application Support/com.hula.pc" "$HOME/Library/Caches/com.hula.pc"',
  '  Linux:   rm -rf "$HOME/.local/share/com.hula.pc" "$HOME/.cache/com.hula.pc"',
  '  Windows: Remove-Item -Recurse -Force "$env:APPDATA\\com.hula.pc"',
]

function parseArgs(argv) {
  const out = { mode: 'safe', dry: false, help: false }
  for (const arg of argv.slice(2)) {
    if (arg === '--safe') out.mode = 'safe'
    else if (arg === '--hard') out.mode = 'hard'
    else if (arg === '--dry') out.dry = true
    else if (arg === '--help' || arg === '-h') out.help = true
    else {
      process.stderr.write(`clean-runtime-state: unknown flag '${arg}'\n`)
      process.exit(1)
    }
  }
  return out
}

function help() {
  process.stdout.write(
    [
      'clean-runtime-state — HuLa dev/build state reset',
      '',
      'Usage:',
      '  node scripts/clean-runtime-state.mjs [--safe|--hard] [--dry]',
      '',
      'Flags:',
      '  --safe   default; remove node_modules, dist, caches, reports',
      '  --hard   also remove src-tauri/target; run `pnpm store prune`; print manual hints',
      '  --dry    preview without deleting',
      '  --help   this message',
      '',
    ].join('\n'),
  )
}

function rmrf(target, dry) {
  if (!fs.existsSync(target)) {
    process.stdout.write(`  skip  ${path.relative(repoRoot, target)} (missing)\n`)
    return
  }
  if (dry) {
    process.stdout.write(`  would rm  ${path.relative(repoRoot, target)}\n`)
    return
  }
  fs.rmSync(target, { recursive: true, force: true, maxRetries: 3 })
  process.stdout.write(`  rm    ${path.relative(repoRoot, target)}\n`)
}

function main() {
  const args = parseArgs(process.argv)
  if (args.help) return help()

  process.stdout.write(
    `clean-runtime-state: mode=${args.mode}${args.dry ? ' (dry-run)' : ''} root=${repoRoot}\n`,
  )

  const targets = args.mode === 'hard' ? [...SAFE_TARGETS, ...HARD_EXTRA_TARGETS] : SAFE_TARGETS

  for (const rel of targets) {
    rmrf(path.join(repoRoot, rel), args.dry)
  }

  if (args.mode === 'hard' && !args.dry) {
    try {
      process.stdout.write('  exec  pnpm store prune\n')
      execSync('pnpm store prune', { cwd: repoRoot, stdio: 'inherit' })
    } catch (err) {
      process.stderr.write(`  warn  pnpm store prune failed: ${err.message}\n`)
    }
  }

  if (args.mode === 'hard') {
    process.stdout.write(
      `\nHard-reset manual steps (NOT automated):\n${MANUAL_HINTS.map((l) => `  ${l}`).join('\n')}\n`,
    )
  }

  process.stdout.write('clean-runtime-state: done\n')
}

main()
