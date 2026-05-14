#!/usr/bin/env node
/**
 * §21.1 P0 — SDK tarball release packer.
 *
 * Produces a reproducible `pnpm pack` artifact from the sibling
 * `matrix-js-sdk` checkout and (optionally) swaps the hula `package.json`
 * + `meta/sdk-pin.json` over to tarball mode for release validation.
 *
 * Usage:
 *   node scripts/pack-sdk-tarball.mjs                     # pack only, print SHA
 *   node scripts/pack-sdk-tarball.mjs --apply             # pack + rewrite package.json + refresh pin
 *   node scripts/pack-sdk-tarball.mjs --restore           # swap back to link: mode for dev
 *   node scripts/pack-sdk-tarball.mjs --allow-commit-drift  # skip commit-vs-pin check
 *
 * Exit codes:
 *   0  success
 *   1  drift / pre-condition failure (sibling missing, commit mismatch, …)
 *   2  unexpected runtime error
 */

import { execSync } from 'node:child_process'
import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const packageJsonPath = path.join(repoRoot, 'package.json')
const pinPath = path.join(repoRoot, 'meta', 'sdk-pin.json')
const sdkSiblingRoot = path.resolve(repoRoot, '..', 'matrix-js-sdk')
const synapseSiblingRoot = path.resolve(repoRoot, '..', 'synapse-rust')
const vendorDir = path.join(repoRoot, 'vendor')
const tarballPath = path.join(vendorDir, 'matrix-js-sdk.tgz')
const tarballRelSpec = 'file:vendor/matrix-js-sdk.tgz'

const args = new Set(process.argv.slice(2))
const apply = args.has('--apply')
const restore = args.has('--restore')
const allowCommitDrift = args.has('--allow-commit-drift')

if (apply && restore) {
  fail(1, '--apply and --restore are mutually exclusive')
}

function fail(code, msg) {
  process.stderr.write(`pack-sdk-tarball: ${msg}\n`)
  process.exit(code)
}

function readJson(p) {
  return JSON.parse(fs.readFileSync(p, 'utf8'))
}

function writeJson(p, value) {
  fs.writeFileSync(p, `${JSON.stringify(value, null, 2)}\n`, 'utf8')
}

function gitHead(cwd) {
  if (!fs.existsSync(cwd)) return ''
  try {
    return execSync('git rev-parse HEAD', { cwd, stdio: ['ignore', 'pipe', 'ignore'] })
      .toString()
      .trim()
  } catch {
    return ''
  }
}

function sha256File(p) {
  return `sha256-${crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex')}`
}

function pinnedBy() {
  return (
    process.env.GIT_AUTHOR_NAME ||
    process.env.GITHUB_ACTOR ||
    process.env.USER ||
    process.env.USERNAME ||
    'unknown'
  )
}

function doRestore() {
  const pkg = readJson(packageJsonPath)
  if (pkg.dependencies && 'matrix-js-sdk' in pkg.dependencies) {
    pkg.dependencies['matrix-js-sdk'] = 'link:../matrix-js-sdk'
  } else if (pkg.devDependencies && 'matrix-js-sdk' in pkg.devDependencies) {
    pkg.devDependencies['matrix-js-sdk'] = 'link:../matrix-js-sdk'
  } else {
    fail(1, 'matrix-js-sdk is not a dependency in package.json')
  }
  writeJson(packageJsonPath, pkg)

  const pin = readJson(pinPath)
  pin.sdk_mode = 'link'
  pin.tarball_sha256 = ''
  pin.pinned_at = new Date().toISOString()
  pin.pinned_by = pinnedBy()
  writeJson(pinPath, pin)

  process.stdout.write(
    `pack-sdk-tarball: restored package.json -> link:../matrix-js-sdk and pin -> link mode\n` +
      `pack-sdk-tarball: run \`pnpm install\` to re-link the sibling SDK\n`
  )
}

function ensureSiblingExists() {
  if (!fs.existsSync(path.join(sdkSiblingRoot, 'package.json'))) {
    fail(
      1,
      `sibling matrix-js-sdk not found at ${sdkSiblingRoot}; clone it next to hula/ before packing`
    )
  }
}

function ensureCommitMatchesPin(pin) {
  const head = gitHead(sdkSiblingRoot)
  if (!pin.sdk_commit) return head
  if (allowCommitDrift) {
    if (head && !head.startsWith(pin.sdk_commit)) {
      process.stderr.write(
        `pack-sdk-tarball: WARNING — sibling HEAD ${head} drifts from pin ${pin.sdk_commit} (--allow-commit-drift)\n`
      )
    }
    return head
  }
  if (!head) {
    fail(
      1,
      `cannot resolve git HEAD in ${sdkSiblingRoot}; pass --allow-commit-drift to bypass`
    )
  }
  if (!head.startsWith(pin.sdk_commit)) {
    fail(
      1,
      `sibling matrix-js-sdk HEAD ${head} does not match pin sdk_commit ${pin.sdk_commit}; check out the pinned commit or pass --allow-commit-drift`
    )
  }
  return head
}

function runPnpmPack() {
  fs.mkdirSync(vendorDir, { recursive: true })
  for (const stale of fs.readdirSync(vendorDir)) {
    if (stale.startsWith('matrix-js-sdk') && stale.endsWith('.tgz')) {
      fs.rmSync(path.join(vendorDir, stale))
    }
  }
  // pnpm pack writes the file into --pack-destination with a deterministic
  // name `matrix-js-sdk-<version>.tgz`; we rename to the stable spec name.
  execSync(`pnpm pack --pack-destination "${vendorDir}"`, {
    cwd: sdkSiblingRoot,
    stdio: 'inherit'
  })
  const candidates = fs
    .readdirSync(vendorDir)
    .filter((n) => n.startsWith('matrix-js-sdk') && n.endsWith('.tgz'))
  if (candidates.length !== 1) {
    fail(2, `expected exactly one packed tarball in ${vendorDir}, found ${candidates.length}`)
  }
  const produced = path.join(vendorDir, candidates[0])
  if (produced !== tarballPath) {
    fs.renameSync(produced, tarballPath)
  }
  return tarballPath
}

function applyTarballMode(pin, sdkHead) {
  const pkg = readJson(packageJsonPath)
  if (pkg.dependencies && 'matrix-js-sdk' in pkg.dependencies) {
    pkg.dependencies['matrix-js-sdk'] = tarballRelSpec
  } else if (pkg.devDependencies && 'matrix-js-sdk' in pkg.devDependencies) {
    pkg.devDependencies['matrix-js-sdk'] = tarballRelSpec
  } else {
    fail(1, 'matrix-js-sdk is not a dependency in package.json')
  }
  writeJson(packageJsonPath, pkg)

  const sdkPkg = readJson(path.join(sdkSiblingRoot, 'package.json'))
  const synapseHead = gitHead(synapseSiblingRoot)

  const nextPin = {
    ...pin,
    sdk_version: sdkPkg.version || pin.sdk_version,
    sdk_commit: sdkHead || pin.sdk_commit,
    sdk_mode: 'tarball',
    synapse_rust_commit: synapseHead || pin.synapse_rust_commit,
    tarball_sha256: sha256File(tarballPath),
    pinned_at: new Date().toISOString(),
    pinned_by: pinnedBy()
  }
  writeJson(pinPath, nextPin)
  return nextPin
}

function doPack() {
  ensureSiblingExists()
  const pin = readJson(pinPath)
  const sdkHead = ensureCommitMatchesPin(pin)
  const tarball = runPnpmPack()
  const sha = sha256File(tarball)
  const sizeKb = (fs.statSync(tarball).size / 1024).toFixed(1)

  if (apply) {
    const next = applyTarballMode(pin, sdkHead)
    process.stdout.write(
      `pack-sdk-tarball: applied tarball mode\n` +
        `  tarball: ${path.relative(repoRoot, tarball)} (${sizeKb} KB)\n` +
        `  sha:     ${next.tarball_sha256}\n` +
        `  sdk:     ${next.sdk_version} @ ${next.sdk_commit || '(unknown)'}\n` +
        `  next:    pnpm install --frozen-lockfile && pnpm verify:sdk-pin\n`
    )
  } else {
    process.stdout.write(
      `pack-sdk-tarball: produced ${path.relative(repoRoot, tarball)} (${sizeKb} KB)\n` +
        `  sha:    ${sha}\n` +
        `  commit: ${sdkHead || '(unknown)'}\n` +
        `  hint:   re-run with --apply to swap package.json + refresh pin\n`
    )
  }
}

try {
  if (restore) doRestore()
  else doPack()
} catch (err) {
  if (err && typeof err.status === 'number') process.exit(err.status)
  process.stderr.write(`pack-sdk-tarball: unexpected error — ${err?.message || err}\n`)
  process.exit(2)
}
