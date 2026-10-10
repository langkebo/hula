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

  // Ledger schema three-way binding: pin.ledger_schema must match the SDK's
  // LEDGER_SCHEMA_VERSION (scripts/contract-sync.mjs). This closes the blind
  // spot where backend schema 1->2->3->4 left the pin frozen at "1" while the
  // commit/hash bindings above stayed green.
  const sdkContractSync = path.join(repoRoot, '..', 'matrix-js-sdk', 'scripts', 'contract-sync.mjs')
  if (fs.existsSync(sdkContractSync)) {
    const m = /LEDGER_SCHEMA_VERSION\s*=\s*["']([^"']+)["']/.exec(fs.readFileSync(sdkContractSync, 'utf8'))
    if (m && m[1] !== pin.ledger_schema) {
      die(
        1,
        `ledger_schema mismatch: pin='${pin.ledger_schema}' but SDK LEDGER_SCHEMA_VERSION='${m[1]}' (${sdkContractSync}). ` +
          `Run \`pnpm contract:sync\` in matrix-js-sdk, commit the regenerated files, then set meta/sdk-pin.json ledger_schema to '${m[1]}'.`
      )
    }
  }

  const sdkSpec = pkg.dependencies?.['matrix-js-sdk'] ?? pkg.devDependencies?.['matrix-js-sdk']
  if (!sdkSpec) die(1, 'matrix-js-sdk is not a dependency of hula')

  const actualMode = sdkSpec.startsWith('link:') ? 'link' : sdkSpec.startsWith('file:') ? 'tarball' : 'registry'

  if (isReleaseBranch && actualMode === 'link') {
    die(2, `release branch '${branch}' cannot use 'link:' SDK mode; pack a tarball and pin it.`)
  }

  if (pin.sdk_mode !== actualMode) {
    die(1, `sdk_mode mismatch: pin='${pin.sdk_mode}' but package.json implies '${actualMode}' (spec: ${sdkSpec})`)
  }

  // On dev branches with an empty pin, stop here with a warning only.
  const pinIsEmpty = !pin.sdk_commit && !pin.sdk_version && !pin.pinned_at
  if (pinIsEmpty && !isReleaseBranch) {
    process.stdout.write(`verify-sdk-pin: dev branch '${branch}', pin is empty, mode=${actualMode}; ok.\n`)
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
      `installed sdk_version mismatch: pin='${pin.sdk_version}' but node_modules/matrix-js-sdk version is '${installedSdkPkg.version}'`
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
          `sdk_version mismatch: pin='${pin.sdk_version}' but ../matrix-js-sdk/package.json version is '${sdkPkg.version}'`
        )
      }
      actualSdkCommit = gitCommit(sdkRoot)
      if (pin.sdk_commit && actualSdkCommit && !actualSdkCommit.startsWith(pin.sdk_commit)) {
        die(1, `sdk_commit mismatch: pin='${pin.sdk_commit}' but ../matrix-js-sdk HEAD is '${actualSdkCommit}'`)
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
              `Run \`pnpm contract:sync\` in matrix-js-sdk, commit the regenerated files, then update meta/sdk-pin.json.`
          )
        }
      }
    }
  }

  // 产出 tarball 的 SDK worktree（与 pack-sdk-tarball.mjs 同源）。同时服务下面两段判据：
  // tarball 段的 `sdk_commit` 新鲜度、以及跨仓绑定段的契约镜像绑定。
  const sdkDirEnv = process.env.TJG_SDK_DIR

  if (actualMode === 'tarball') {
    const match = /^file:(.+\.tgz)$/.exec(sdkSpec)
    if (!match) die(1, `tarball mode but spec is not a file:*.tgz: ${sdkSpec}`)
    const tarballPath = path.resolve(repoRoot, match[1])
    if (!fs.existsSync(tarballPath)) die(1, `tarball not found on disk: ${tarballPath}`)
    const actualHash = sha256File(tarballPath)
    if (pin.tarball_sha256 && actualHash !== pin.tarball_sha256) {
      die(1, `tarball_sha256 mismatch:\n  pin=${pin.tarball_sha256}\n  disk=${actualHash}\n  path=${tarballPath}`)
    }
    if (!installedSdkPkg) {
      die(1, 'tarball mode requires node_modules/matrix-js-sdk/package.json after install')
    }
    // `sdk_commit` 新鲜度（治理方案 §13.30）：tarball 模式此前**只**比对 tarball hash 与
    // 契约镜像/后端，从不比对 `pin.sdk_commit` 与 SDK worktree HEAD ⇒ 「release 提交了修复、
    // 但 tarball 还是旧 commit 打的包」会**静默通过**（实测：release 删掉 `getSamlRedirect`
    // 之后 pin 仍指向旧 commit，tarball 里还带着被删的方法，门禁报 ok）。
    // 需要 `TJG_SDK_DIR` 才能定位 worktree；未指定时显式 SKIP（打印 banner，不静默通过）。
    if (!sdkDirEnv) {
      process.stdout.write(
        `verify-sdk-pin: SKIP sdk_commit freshness — TJG_SDK_DIR is not set, so the SDK worktree that produced the tarball is unidentified (not a pass; set TJG_SDK_DIR=<sdk worktree> to enable).\n`,
      )
    } else {
      const sdkHead = gitCommit(path.resolve(sdkDirEnv))
      if (!sdkHead) {
        die(1, `cannot resolve git HEAD in ${sdkDirEnv}; refusing to pass the sdk_commit freshness binding.`)
      }
      if (pin.sdk_commit && !sdkHead.startsWith(pin.sdk_commit)) {
        die(
          1,
          `sdk_commit is behind the SDK worktree HEAD (the tarball is stale):\n  pin=${pin.sdk_commit}\n  SDK HEAD=${sdkHead}\n` +
            `Rebuild + repack: TJG_SDK_DIR=<sdk worktree> node scripts/pack-sdk-tarball.mjs --allow-commit-drift --apply, then pnpm add ./vendor/matrix-js-sdk.tgz --ignore-scripts and re-verify.`,
        )
      }
    }
  }

  // Cross-repo binding (治理方案 §13.21.3 偏差 4 / §13.21.6 第 6 项 / §13.23.7):
  //
  // 两段判据：
  //   A. **契约镜像绑定**（仅在显式给出 `TJG_SDK_DIR` 时启用，与
  //      `scripts/pack-sdk-tarball.mjs` 同源）：pin.synapse_rust_commit 必须等于该
  //      worktree 的 `docs/api-contract/generated/index.json` 里的 `synapse_rust_commit`。
  //      本仓同时存在 `matrix-js-sdk/`(develop) 与 `.wt-sdk-clean/`(release) 两个
  //      worktree，默认取 `../matrix-js-sdk` 会把 develop 的镜像误当成 pin 的来源，
  //      故未显式指定时**显式 SKIP**（打印 banner，不静默通过）。
  //   B. **路由面新鲜度**（后端兄弟仓在场时始终执行）：自 `pin.synapse_rust_commit`
  //      起，后端不得再有触碰 `synapse-web/src/routes/**` 或
  //      `tests/unit/fixtures/ledger_export_sdk/**` 的提交；且该 commit 必须是后端
  //      HEAD 的祖先。
  //
  // 为什么不再直接比「后端 HEAD」：任何一次纯文档提交都会移动 HEAD，pin 便永远追不上
  // （实测：记录 §13.23 的 docs 提交 `d0eb8306e` 让门禁第二次变红）。真正的不变量是
  // 「pin ↔ 契约快照一致」且「快照未落后于路由面」，而不是「等于 HEAD」。
  if (pin.synapse_rust_commit) {
    if (!sdkDirEnv) {
      process.stdout.write(
        `verify-sdk-pin: SKIP contract-mirror binding — TJG_SDK_DIR is not set, so the SDK worktree that produced the tarball is unidentified (not a pass; set TJG_SDK_DIR=<sdk worktree> to enable).\n`
      )
    } else {
      const mirrorIndex = path.join(path.resolve(sdkDirEnv), 'docs', 'api-contract', 'generated', 'index.json')
      if (!fs.existsSync(mirrorIndex)) {
        die(1, `TJG_SDK_DIR=${sdkDirEnv} but ${mirrorIndex} does not exist; refusing to pass on a missing input.`)
      }
      const mirrorCommit = readJson(mirrorIndex).synapse_rust_commit || ''
      if (!mirrorCommit) {
        die(1, `cannot read synapse_rust_commit from ${mirrorIndex}; refusing to pass on a missing input.`)
      }
      if (mirrorCommit !== pin.synapse_rust_commit) {
        die(
          1,
          `synapse_rust_commit mismatch with the SDK contract mirror:\n  pin=${pin.synapse_rust_commit}\n  mirror=${mirrorCommit} (${mirrorIndex})\n` +
            `Run \`pnpm contract:sync\` in that worktree, commit the regenerated files, then refresh the pin.`
        )
      }
    }

    const backendSibling = path.resolve(repoRoot, '..', 'synapse-rust')
    if (!fs.existsSync(backendSibling)) {
      process.stdout.write(
        `verify-sdk-pin: SKIP route-freshness binding — ${backendSibling} is not checked out (Tjg-only CI, not a pass).\n`
      )
    } else {
      const backendHead = gitCommit(backendSibling)
      if (!backendHead) {
        die(1, `cannot resolve git HEAD in ${backendSibling}; refusing to pass the route-freshness binding.`)
      }
      try {
        execSync(`git merge-base --is-ancestor ${pin.synapse_rust_commit} ${backendHead}`, {
          cwd: backendSibling,
          stdio: 'ignore'
        })
      } catch {
        die(
          1,
          `pin.synapse_rust_commit is not an ancestor of the backend HEAD:\n  pin=${pin.synapse_rust_commit}\n  backend HEAD=${backendHead}\n` +
            `Re-pin against a commit that exists in the backend history.`
        )
      }
      // 变异自证用逃生阀：允许把比对区间钉成任意 `A..B`（默认 `<pin>..HEAD`），
      // 以便用**已存在的历史区间**证明「路由面落后 ⇒ 红」这一段真的能判红。
      //
      // 判据锚点是 **SDK 车道的 ledger 快照**（`tests/unit/fixtures/ledger_export_sdk/`），
      // 不是 `synapse-web/src/routes/**`：后者会被「删一个未使用的 import」这类
      // **非路由改动**推进而误报（实测 2026-10-09：`e2c8969ae` 仅删一行 import 就让门禁变红）。
      // 后端自身的守卫要求「路由面变化 ⇒ 必须重生成 fixture」，所以 fixture 变动才是
      // 「契约面真的变了」的可靠代理。
      const range = process.env.SYNAPSE_PIN_RANGE || `${pin.synapse_rust_commit}..${backendHead}`
      const contractPaths = ['tests/unit/fixtures/ledger_export_sdk']
      let changed = ''
      try {
        changed = execSync(`git log --oneline ${range} -- ${contractPaths.join(' ')}`, {
          cwd: backendSibling
        })
          .toString()
          .trim()
      } catch {
        die(1, `cannot resolve git range ${range} in ${backendSibling}; refusing to pass on a missing input.`)
      }
      if (changed) {
        die(
          1,
          `SDK contract mirror is stale — backend has route/ledger commits after ${pin.synapse_rust_commit}:\n` +
            changed
              .split('\n')
              .map((l) => `  ${l}`)
              .join('\n') +
            `\nRun \`pnpm contract:sync && pnpm contract:codegen\` in matrix-js-sdk, commit, then repack + refresh the pin.`
        )
      }
    }
  }
  process.stdout.write(
    `verify-sdk-pin: branch='${branch}' mode=${actualMode} sdk_version=${pin.sdk_version || '(dev)'} sdk_commit=${pin.sdk_commit || '(dev)'} synapse_rust=${pin.synapse_rust_commit || '(dev)'} — ok\n`
  )
}

main()
