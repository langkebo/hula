#!/usr/bin/env node
import { execSync } from 'node:child_process'
import { readFileSync, writeFileSync, existsSync, createHash } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = resolve(__dirname, '..')
const pinPath = resolve(root, 'meta/sdk-pin.json')
const sdkPath = resolve(root, '..', 'matrix-js-sdk')
const sdkPkgPath = resolve(sdkPath, 'package.json')
const tarballPath = resolve(root, 'vendor/matrix-js-sdk.tgz')

const pin = JSON.parse(readFileSync(pinPath, 'utf8'))

if (existsSync(sdkPkgPath)) {
  const sdkPkg = JSON.parse(readFileSync(sdkPkgPath, 'utf8'))
  pin.sdk_version = sdkPkg.version
  try {
    pin.sdk_commit = execSync('git rev-parse HEAD', { cwd: sdkPath }).toString().trim()
  } catch { /* keep existing */ }
}

const pkg = JSON.parse(readFileSync(resolve(root, 'package.json'), 'utf8'))
const sdkSpec = pkg.dependencies?.['matrix-js-sdk'] ?? ''
pin.sdk_mode = sdkSpec.startsWith('link:') ? 'link' : sdkSpec.startsWith('file:') ? 'tarball' : 'registry'

if (existsSync(tarballPath)) {
  pin.tarball_sha256 = 'sha256-' + createHash('sha256').update(readFileSync(tarballPath)).digest('hex')
}

pin.pinned_at = new Date().toISOString()
pin.pinned_by = process.env.GIT_AUTHOR_NAME || process.env.USER || 'unknown'

writeFileSync(pinPath, JSON.stringify(pin, null, '\t') + '\n')
console.log(`sdk-pin.json refreshed: ${pin.sdk_mode} mode, ${pin.sdk_version}, commit ${pin.sdk_commit?.slice(0, 8)}`)
