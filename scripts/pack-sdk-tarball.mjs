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
import { fingerprintLibDir } from './sdk-lib-fingerprint.mjs'

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const packageJsonPath = path.join(repoRoot, 'package.json')
const pinPath = path.join(repoRoot, 'meta', 'sdk-pin.json')
// Which SDK checkout to pack. Defaults to the sibling `../matrix-js-sdk`, but the
// documented way to work on the SDK without disturbing another writer's in-flight
// state is a `git worktree` (see the workspace CLAUDE.md), so allow pointing the
// packer at it explicitly:
//   TJG_SDK_DIR=/path/to/sdk-worktree node scripts/pack-sdk-tarball.mjs --apply
const sdkSiblingRoot = process.env.TJG_SDK_DIR
  ? path.resolve(process.env.TJG_SDK_DIR)
  : path.resolve(repoRoot, '..', 'matrix-js-sdk')
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
    process.env.GIT_AUTHOR_NAME || process.env.GITHUB_ACTOR || process.env.USER || process.env.USERNAME || 'unknown'
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
  // link 模式下 verify 不走 tarball 段，但把上一轮的指纹清掉，避免它看起来仍然生效。
  pin.sdk_lib_fingerprint = ''
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
    fail(1, `sibling matrix-js-sdk not found at ${sdkSiblingRoot}; clone it next to hula/ before packing`)
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
    fail(1, `cannot resolve git HEAD in ${sdkSiblingRoot}; pass --allow-commit-drift to bypass`)
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
  // `pnpm pack` derives the file name from the package name. Since the fork was
  // renamed to the scoped `@langkebo/matrix-js-sdk`, the artefact is
  // `langkebo-matrix-js-sdk-<version>.tgz` — NOT `matrix-js-sdk-<version>.tgz`.
  // Derive the stem from package.json so both the stale cleanup and the
  // candidate scan keep working across (un)scoped renames, and keep matching the
  // stable `matrix-js-sdk*.tgz` spec name referenced by package.json.
  const sdkPkgName = readJson(path.join(sdkSiblingRoot, 'package.json')).name || ''
  const packStem = sdkPkgName.replace(/^@/, '').replace(/\//g, '-')
  const isPackTarball = (name) =>
    name.endsWith('.tgz') && (name.startsWith(packStem) || name.startsWith('matrix-js-sdk'))
  for (const stale of fs.readdirSync(vendorDir)) {
    if (isPackTarball(stale)) {
      fs.rmSync(path.join(vendorDir, stale))
    }
  }
  // pnpm pack writes the file into --pack-destination with the package-derived
  // name; we rename it to the stable spec name `matrix-js-sdk.tgz`.
  execSync(`pnpm pack --pack-destination "${vendorDir}"`, {
    cwd: sdkSiblingRoot,
    stdio: 'inherit'
  })
  const candidates = fs.readdirSync(vendorDir).filter(isPackTarball)
  if (candidates.length !== 1) {
    fail(2, `expected exactly one packed tarball in ${vendorDir}, found ${candidates.length}`)
  }
  const produced = path.join(vendorDir, candidates[0])
  if (produced !== tarballPath) {
    fs.renameSync(produced, tarballPath)
  }
  return tarballPath
}

async function applyTarballMode(pin, sdkHead) {
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
  // N-05：把**打进该 tarball 的 lib 指纹**记进 pin，让 verify 能把「已安装产物」与
  // 「tarball 内容」绑起来（只比 tarball 文件 sha256 + 版本字符串在"同版本不同内容"
  // 下一次也拦不住 —— 见 §9.14.9 W-07/N-05）。取不到 ⇒ 直接失败，绝不写空值：
  // 空指纹会让 verify 的 fail-closed 判据每次都红，或（若判据写松）变成永久假绿。
  const sdkLibFingerprint = await fingerprintLibDir(path.join(sdkSiblingRoot, 'lib'))
  if (!sdkLibFingerprint) {
    fail(
      1,
      `cannot fingerprint ${path.join(sdkSiblingRoot, 'lib')} — build the SDK first ` +
        '(pnpm build:compile && pnpm build:types) so the pin can bind the installed artifact to the tarball content.'
    )
  }
  const synapseHead = gitHead(synapseSiblingRoot)
  // `synapse_rust_commit` 必须绑定「本 SDK 契约镜像生成时所用的后端 commit」，而不是后端当前
  // HEAD：后者会被任何一次纯文档/非路由提交推进，导致 pin 永远追不上，并在 verify-sdk-pin 的
  // 契约镜像段判红（治理方案 §13.27）。优先读镜像的 `index.json`，读不到再退回后端 HEAD。
  const mirrorIndexPath = path.join(sdkSiblingRoot, 'docs', 'api-contract', 'generated', 'index.json')
  const mirrorCommit = fs.existsSync(mirrorIndexPath) ? readJson(mirrorIndexPath).synapse_rust_commit || '' : ''

  const nextPin = {
    ...pin,
    sdk_version: sdkPkg.version || pin.sdk_version,
    sdk_commit: sdkHead || pin.sdk_commit,
    sdk_mode: 'tarball',
    synapse_rust_commit: mirrorCommit || synapseHead || pin.synapse_rust_commit,
    tarball_sha256: sha256File(tarballPath),
    sdk_lib_fingerprint: sdkLibFingerprint,
    pinned_at: new Date().toISOString(),
    pinned_by: pinnedBy()
  }
  writeJson(pinPath, nextPin)
  return nextPin
}

async function doPack() {
  ensureSiblingExists()
  const pin = readJson(pinPath)
  const sdkHead = ensureCommitMatchesPin(pin)
  const tarball = runPnpmPack()
  const sha = sha256File(tarball)
  const sizeKb = (fs.statSync(tarball).size / 1024).toFixed(1)

  if (apply) {
    const next = await applyTarballMode(pin, sdkHead)
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
  else await doPack()
} catch (err) {
  if (err && typeof err.status === 'number') process.exit(err.status)
  process.stderr.write(`pack-sdk-tarball: unexpected error — ${err?.message || err}\n`)
  process.exit(2)
}
