#!/usr/bin/env node

import { execSync } from 'node:child_process'
import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const packageJsonPath = path.join(repoRoot, 'package.json')
const pinPath = path.join(repoRoot, 'meta', 'sdk-pin.json')
const sdkSiblingRoot = path.join(repoRoot, '..', 'matrix-js-sdk')
const synapseSiblingRoot = path.join(repoRoot, '..', 'synapse-rust')
const installedSdkPkgPath = path.join(repoRoot, 'node_modules', 'matrix-js-sdk', 'package.json')

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'))
}

function gitCommit(cwd) {
  if (!fs.existsSync(cwd)) return ''
  try {
    return execSync('git rev-parse HEAD', { cwd, stdio: ['ignore', 'pipe', 'ignore'] })
      .toString()
      .trim()
  } catch {
    return ''
  }
}

function sha256File(filePath) {
  return `sha256-${crypto.createHash('sha256').update(fs.readFileSync(filePath)).digest('hex')}`
}

function resolveSdkSpec(pkg) {
  return pkg.dependencies?.['matrix-js-sdk'] ?? pkg.devDependencies?.['matrix-js-sdk'] ?? ''
}

function resolveSdkMode(spec) {
  if (spec.startsWith('link:')) return 'link'
  if (spec.startsWith('file:')) return 'tarball'
  return 'registry'
}

function resolveSdkVersion() {
  if (fs.existsSync(installedSdkPkgPath)) {
    return readJson(installedSdkPkgPath).version || ''
  }
  const siblingPkg = path.join(sdkSiblingRoot, 'package.json')
  if (fs.existsSync(siblingPkg)) {
    return readJson(siblingPkg).version || ''
  }
  return ''
}

function resolveTarballSha(spec) {
  if (!spec.startsWith('file:')) return ''
  const tarballPath = path.resolve(repoRoot, spec.slice('file:'.length))
  return fs.existsSync(tarballPath) ? sha256File(tarballPath) : ''
}

function main() {
  const pkg = readJson(packageJsonPath)
  const pin = readJson(pinPath)
  const sdkSpec = resolveSdkSpec(pkg)

  if (!sdkSpec) {
    throw new Error('matrix-js-sdk dependency is missing from package.json')
  }

  const nextPin = {
    ...pin,
    sdk_version: resolveSdkVersion(),
    sdk_commit: gitCommit(sdkSiblingRoot),
    sdk_mode: resolveSdkMode(sdkSpec),
    synapse_rust_commit: gitCommit(synapseSiblingRoot),
    tarball_sha256: resolveTarballSha(sdkSpec),
    pinned_at: new Date().toISOString(),
    pinned_by:
      process.env.GIT_AUTHOR_NAME ||
      process.env.GITHUB_ACTOR ||
      process.env.USER ||
      process.env.USERNAME ||
      'unknown',
  }

  fs.writeFileSync(pinPath, `${JSON.stringify(nextPin, null, 2)}\n`, 'utf8')

  process.stdout.write(
    `refresh-sdk-pin: wrote ${path.relative(repoRoot, pinPath)} mode=${nextPin.sdk_mode} sdk_version=${nextPin.sdk_version || '(unknown)'} sdk_commit=${nextPin.sdk_commit || '(missing)'} synapse_rust=${nextPin.synapse_rust_commit || '(missing)'}\n`,
  )
}

main()
