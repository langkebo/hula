#!/usr/bin/env node
/**
 * verify-sdk-pin — release-branch gate.
 *
 * Checks that meta/sdk-pin.json is consistent with the matrix-js-sdk artifact
 * currently resolved by the lockfile. Referenced in
 * docs/HULA_SDK_REINTEGRATION_OPTIMIZATION_PLAN_2026-05-03.md §16.1.3.
 *
 * Exit codes:
 *   0 — pin matches installed SDK (or branch is dev and pin is empty)
 *   1 — drift detected, fields missing, or schema violation
 *   2 — pin is in `link:` mode on a `release/*` branch (explicitly banned)
 *
 * Modes of drift detected:
 *   - pin declares a commit/version/tarball hash that disagrees with disk
 *   - pin is empty but current branch matches ^release/
 *   - sdk-pin.schema.json validation fails (minimal handwritten validator)
 */

import { execSync } from 'node:child_process'
import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const pinPath = path.join(repoRoot, 'meta', 'sdk-pin.json')
const schemaPath = path.join(repoRoot, 'meta', 'sdk-pin.schema.json')
const pkgPath = path.join(repoRoot, 'package.json')
const sdkPkgPath = path.join(repoRoot, '..', 'matrix-js-sdk', 'package.json')
const installedSdkPkgPath = path.join(repoRoot, 'node_modules', 'matrix-js-sdk', 'package.json')

function die(code, msg) {
  process.stderr.write(`verify-sdk-pin: ${msg}\n`)
  process.exit(code)
}

function readJson(p) {
  try {
    return JSON.parse(fs.readFileSync(p, 'utf8'))
  } catch (err) {
    die(1, `cannot read ${p}: ${err.message}`)
  }
}

function currentBranch() {
  try {
    return execSync('git rev-parse --abbrev-ref HEAD', { cwd: repoRoot }).toString().trim()
  } catch {
    return process.env.GITHUB_REF_NAME || process.env.CI_COMMIT_BRANCH || 'unknown'
  }
}

function gitCommit(repoPath) {
  try {
    return execSync('git rev-parse HEAD', { cwd: repoPath }).toString().trim()
  } catch {
    return ''
  }
}

function validateAgainstSchema(pin, schema) {
  const errors = []
  for (const key of schema.required || []) {
    if (!(key in pin)) errors.push(`missing required field: ${key}`)
  }
  for (const [key, value] of Object.entries(pin)) {
    const rule = schema.properties?.[key]
    if (!rule) {
      if (schema.additionalProperties === false) {
        errors.push(`unknown field: ${key}`)
      }
      continue
    }
    if (rule.const !== undefined && value !== rule.const) {
      errors.push(`${key}: expected const '${rule.const}', got '${value}'`)
    }
    if (rule.enum && !rule.enum.includes(value)) {
      errors.push(`${key}: expected one of ${rule.enum.join(', ')}, got '${value}'`)
    }
    if (rule.type === 'string' && typeof value !== 'string') {
      errors.push(`${key}: expected string, got ${typeof value}`)
    }
    if (rule.pattern && typeof value === 'string' && !new RegExp(rule.pattern).test(value)) {
      errors.push(`${key}: value '${value}' does not match /${rule.pattern}/`)
    }
  }
  return errors
}

function sha256File(p) {
  const buf = fs.readFileSync(p)
  return `sha256-${crypto.createHash('sha256').update(buf).digest('hex')}`
}

function main() {
  const pin = readJson(pinPath)
  const schema = readJson(schemaPath)
  const pkg = readJson(pkgPath)
  const branch = currentBranch()
  const isReleaseBranch = /^release\//.test(branch)

  const schemaErrors = validateAgainstSchema(pin, schema)
  if (schemaErrors.length) {
    die(1, `meta/sdk-pin.json schema violations:\n  - ${schemaErrors.join('\n  - ')}`)
  }

  const sdkSpec = pkg.dependencies?.['matrix-js-sdk'] ?? pkg.devDependencies?.['matrix-js-sdk']
  if (!sdkSpec) die(1, 'matrix-js-sdk is not a dependency of hula')

  const actualMode = sdkSpec.startsWith('link:')
    ? 'link'
    : sdkSpec.startsWith('file:')
      ? 'tarball'
      : 'registry'

  if (isReleaseBranch && actualMode === 'link') {
    die(2, `release branch '${branch}' cannot use 'link:' SDK mode; pack a tarball and pin it.`)
  }

  if (pin.sdk_mode !== actualMode) {
    die(
      1,
      `sdk_mode mismatch: pin='${pin.sdk_mode}' but package.json implies '${actualMode}' (spec: ${sdkSpec})`,
    )
  }

  // On dev branches with an empty pin, stop here with a warning only.
  const pinIsEmpty = !pin.sdk_commit && !pin.sdk_version && !pin.pinned_at
  if (pinIsEmpty && !isReleaseBranch) {
    process.stdout.write(
      `verify-sdk-pin: dev branch '${branch}', pin is empty, mode=${actualMode}; ok.\n`,
    )
    return
  }
  if (pinIsEmpty && isReleaseBranch) {
    die(1, `release branch '${branch}' has empty meta/sdk-pin.json; populate it before tagging.`)
  }

  // From here on, the pin must agree with the artifact on disk.
  const installedSdkPkg = fs.existsSync(installedSdkPkgPath) ? readJson(installedSdkPkgPath) : null

  if (installedSdkPkg && pin.sdk_version && installedSdkPkg.version !== pin.sdk_version) {
    die(
      1,
      `installed sdk_version mismatch: pin='${pin.sdk_version}' but node_modules/matrix-js-sdk version is '${installedSdkPkg.version}'`,
    )
  }

  if (actualMode === 'link' || actualMode === 'registry' /* optional commit check */) {
    let actualSdkCommit = ''
    if (fs.existsSync(sdkPkgPath)) {
      const sdkPkg = readJson(sdkPkgPath)
      const sdkRoot = path.dirname(sdkPkgPath)
      if (pin.sdk_version && sdkPkg.version !== pin.sdk_version) {
        die(
          1,
          `sdk_version mismatch: pin='${pin.sdk_version}' but ../matrix-js-sdk/package.json version is '${sdkPkg.version}'`,
        )
      }
      actualSdkCommit = gitCommit(sdkRoot)
      if (pin.sdk_commit && actualSdkCommit && !actualSdkCommit.startsWith(pin.sdk_commit)) {
        die(
          1,
          `sdk_commit mismatch: pin='${pin.sdk_commit}' but ../matrix-js-sdk HEAD is '${actualSdkCommit}'`,
        )
      }

      // Verify contract chain: pin's synapse_rust_commit MUST match the
      // backend commit that the SDK's contract artifacts were generated from.
      // This catches the case where contract:sync ran but the regenerated
      // files were never committed before the pin was set.
      const sdkContractIndex = path.join(sdkRoot, 'docs', 'api-contract', 'generated', 'index.json')
      if (pin.synapse_rust_commit && fs.existsSync(sdkContractIndex)) {
        const contract = readJson(sdkContractIndex)
        if (contract.synapse_rust_commit && contract.synapse_rust_commit !== pin.synapse_rust_commit) {
          die(
            1,
            `synapse_rust_commit mismatch: pin='${pin.synapse_rust_commit}' but SDK contract was generated from '${contract.synapse_rust_commit}'. ` +
              `Run \`pnpm contract:sync\` in matrix-js-sdk, commit the regenerated files, then update meta/sdk-pin.json.`,
          )
        }
      }
    }
  }

  if (actualMode === 'tarball') {
    const match = /^file:(.+\.tgz)$/.exec(sdkSpec)
    if (!match) die(1, `tarball mode but spec is not a file:*.tgz: ${sdkSpec}`)
    const tarballPath = path.resolve(repoRoot, match[1])
    if (!fs.existsSync(tarballPath)) die(1, `tarball not found on disk: ${tarballPath}`)
    const actualHash = sha256File(tarballPath)
    if (pin.tarball_sha256 && actualHash !== pin.tarball_sha256) {
      die(
        1,
        `tarball_sha256 mismatch:\n  pin=${pin.tarball_sha256}\n  disk=${actualHash}\n  path=${tarballPath}`,
      )
    }
    if (!installedSdkPkg) {
      die(1, 'tarball mode requires node_modules/matrix-js-sdk/package.json after install')
    }
  }

  process.stdout.write(
    `verify-sdk-pin: branch='${branch}' mode=${actualMode} sdk_version=${pin.sdk_version || '(dev)'} sdk_commit=${pin.sdk_commit || '(dev)'} synapse_rust=${pin.synapse_rust_commit || '(dev)'} — ok\n`,
  )
}

main()
