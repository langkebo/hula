#!/usr/bin/env node
import { readFileSync, writeFileSync, existsSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = resolve(__dirname, '..')
const pkgPath = resolve(root, 'package.json')

const pkg = JSON.parse(readFileSync(pkgPath, 'utf8'))

if (!pkg.dependencies?.['matrix-js-sdk']?.startsWith('link:')) {
  console.log('SDK is not in link mode, skipping pack apply.')
  process.exit(0)
}

const tarball = 'vendor/matrix-js-sdk.tgz'
if (!existsSync(resolve(root, tarball))) {
  console.error(`Tarball not found at ${tarball}`)
  process.exit(1)
}

pkg.dependencies['matrix-js-sdk'] = `file:${tarball}`
writeFileSync(pkgPath, JSON.stringify(pkg, null, '\t') + '\n')
console.log(`Swapped matrix-js-sdk from link mode to tarball: ${tarball}`)
