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
import { fingerprintLibDir } from './sdk-lib-fingerprint.mjs'

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

// ── ledger 内容判据 ────────────────────────────────────────────────────────────
//
// 旧判据是 `git log <pin>..HEAD -- tests/unit/fixtures/ledger_export_sdk`：只要该区间
// **有任何提交碰到这个目录**就判红。2026-10-13 实测到假阳性：后端 `ed09854e5` 只往该目录
// **新增了 sidecar `manifest.json`**、三个 profile JSON 一字未改（`synapse-web/src/routes/**`
// 的 `.route(` 增删 0 行），门禁却报「contract mirror is stale」。
//
// 真正的不变量是「pin 时 SDK 摄入的 ledger **内容** == 现在后端 HEAD 的 ledger **内容**」。
// 于是改为内容比较：
//   1. 主判据 = 三个 profile JSON（`all/default/worker.json`）的 sha256 —— 那正是 SDK 摄入的内容；
//      **不**包括 sidecar `manifest.json`（它能在后续提交里被单独新增，本身不代表内容变化）；
//   2. 任一侧连一个 profile JSON 都读不到 ⇒ 判红（拒绝在缺输入时通过），绝不静默放过；
//   3. 后端 sidecar 的 `route_surface_sha256` 仅作为**诊断**附加到差异详情里，不参与判定
//      （理由见 `compareLedgerSnapshots` 的注释：以它为准会放过"只改了易变字段"的重新生成，
//       并与 SDK 侧判据产生口径分裂）。
export const LEDGER_FIXTURE_DIR = 'tests/unit/fixtures/ledger_export_sdk'
export const LEDGER_PROFILE_FILES = ['all', 'default', 'worker']
export const LEDGER_SIDECAR_FILE = `${LEDGER_FIXTURE_DIR}/manifest.json`

/**
 * 读一份 rev 的 ledger 快照标识。
 * @param readFile `(relPath) => string|null`，取不到时返回 null。
 */
export function readLedgerSnapshot(readFile) {
  const fileHashes = {}
  for (const profile of LEDGER_PROFILE_FILES) {
    const text = readFile(`${LEDGER_FIXTURE_DIR}/${profile}.json`)
    fileHashes[profile] = text == null ? null : crypto.createHash('sha256').update(text).digest('hex')
  }

  let sidecarFingerprints = null
  const sidecarText = readFile(LEDGER_SIDECAR_FILE)
  if (sidecarText != null) {
    try {
      const profiles = JSON.parse(sidecarText)?.profiles
      if (profiles && typeof profiles === 'object') {
        sidecarFingerprints = {}
        for (const [profile, info] of Object.entries(profiles)) {
          const sha = info?.route_surface_sha256
          if (typeof sha === 'string' && sha) sidecarFingerprints[profile] = sha
        }
        // 空对象等价于「读不到 sidecar」，避免拿一个比对不出东西的 basis 假装比过了
        if (Object.keys(sidecarFingerprints).length === 0) sidecarFingerprints = null
      }
    } catch {
      sidecarFingerprints = null
    }
  }
  return { fileHashes, sidecarFingerprints }
}

/**
 * 比对两份 ledger 快照。
 *
 * **主判据 = 三个 profile JSON 的 sha256**：那正是 SDK 摄入的内容；后端 sidecar 的
 * `route_surface_sha256` 只作为**诊断**附加在差异详情里，不参与判定。
 *
 * 为什么不用 sidecar 当判据：它会**放过**「只有易变字段（`generated_at` /
 * `synapse_rust_commit`）变化」的重新生成，而那种情况下 SDK 镜像里的对应字段也会变、
 * 同样需要重同步；两仓若一个用 sidecar 一个用文件哈希，就会出现「一边绿一边红」——
 * 那正是本次要收敛掉的口径分裂。sidecar 的用途是**无 sibling 场景**（SDK-only CI、
 * release pin）的内容绑定，不是有 sibling 时的替代判据。
 *
 * @returns `{ same, basis, changedProfiles, detail }`；`basis === 'unresolvable'` 表示
 *          两边都拿不到可比对的输入 —— 调用方**必须**判红。
 */
export function compareLedgerSnapshots(before, after) {
  const readable = (snapshot) => Object.values(snapshot.fileHashes ?? {}).some((hash) => hash != null)
  if (!readable(before) || !readable(after)) {
    return {
      same: false,
      basis: 'unresolvable',
      changedProfiles: [],
      detail: '    没有读到任何 profile JSON（缺输入 ⇒ 判红，不当通过）'
    }
  }

  const changedProfiles = LEDGER_PROFILE_FILES.filter(
    (profile) => before.fileHashes[profile] !== after.fileHashes[profile]
  )
  const bothSidecars = before.sidecarFingerprints != null && after.sidecarFingerprints != null

  return {
    same: changedProfiles.length === 0,
    basis: bothSidecars ? 'files+sidecar' : 'files',
    changedProfiles,
    detail: changedProfiles
      .map((profile) => {
        const beforeFingerprint = before.sidecarFingerprints?.[profile]
        const afterFingerprint = after.sidecarFingerprints?.[profile]
        const fingerprintNote =
          beforeFingerprint || afterFingerprint
            ? `  [route_surface: ${beforeFingerprint ?? '(absent)'} → ${afterFingerprint ?? '(absent)'}]`
            : ''
        return `    ${profile}: ${before.fileHashes[profile] ?? '(absent)'} → ${after.fileHashes[profile] ?? '(absent)'}${fingerprintNote}`
      })
      .join('\n')
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

async function main() {
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

    // 🔴 N-05（2026-10-10）：**已安装产物 ↔ tarball 内容**的一致性。
    //
    // 上面只比了「tarball 文件 sha256」与「installedSdkPkg.version **字符串**」——
    // 而 release 线改代码**不改版本号**（仍是 40.2.0-langkebo.5）⇒
    // 「node_modules 里装的是哪个 commit 打的包」在这两条判据下**完全不可见**。
    // 实证：重钉前 Tjg 的 `vue-tsc` 一直是绿的；换掉 tarball 并**真正** `pnpm install`
    // 之后立刻暴露 `AdminManager.listBackups` 已不存在（W-07，方案文档 §9.14.9）。
    //
    // 判据 = `pin.sdk_lib_fingerprint`（打进该 tarball 的 lib 指纹，由 pack 时产出
    // worktree 的 `lib/` 算出；`pnpm pack` 不改写 lib 内容）必须等于**当前已安装包**
    // 的 lib 指纹 ⇒ 传递出「node_modules 里的 lib == tarball 里的 lib」。
    // **fail-closed**：pin 缺字段、或 node_modules 的 lib 取不到 ⇒ 一律失败。
    if (!pin.sdk_lib_fingerprint) {
      die(
        1,
        'pin is missing `sdk_lib_fingerprint`, so the installed artifact cannot be tied to the tarball content.\n' +
          '  Re-pin: TJG_SDK_DIR=<sdk worktree> node scripts/pack-sdk-tarball.mjs --apply --allow-commit-drift'
      )
    }
    const installedLibDir = path.join(path.dirname(installedSdkPkgPath), 'lib')
    const installedFingerprint = await fingerprintLibDir(installedLibDir)
    if (!installedFingerprint) {
      die(
        1,
        `cannot fingerprint ${installedLibDir} (missing or empty); refusing to pass the installed-vs-tarball binding.`
      )
    }
    if (installedFingerprint !== pin.sdk_lib_fingerprint) {
      die(
        1,
        'installed SDK lib does not match the pinned tarball content (N-05):\n' +
          `  pin       = ${pin.sdk_lib_fingerprint}\n` +
          `  installed = ${installedFingerprint}\n` +
          `  dir       = ${installedLibDir}\n` +
          'node_modules/matrix-js-sdk is stale or built from a different commit. ' +
          'Run `pnpm install --update-checksums` (or a clean install) and re-verify.'
      )
    }
    // `sdk_commit` 新鲜度（治理方案 §13.30）：tarball 模式此前**只**比对 tarball hash 与
    // 契约镜像/后端，从不比对 `pin.sdk_commit` 与 SDK worktree HEAD ⇒ 「release 提交了修复、
    // 但 tarball 还是旧 commit 打的包」会**静默通过**（实测：release 删掉 `getSamlRedirect`
    // 之后 pin 仍指向旧 commit，tarball 里还带着被删的方法，门禁报 ok）。
    // 需要 `TJG_SDK_DIR` 才能定位 worktree；未指定时显式 SKIP（打印 banner，不静默通过）。
    if (!sdkDirEnv) {
      process.stdout.write(
        `verify-sdk-pin: SKIP sdk_commit freshness — TJG_SDK_DIR is not set, so the SDK worktree that produced the tarball is unidentified (not a pass; set TJG_SDK_DIR=<sdk worktree> to enable).\n`
      )
    } else {
      const sdkHead = gitCommit(path.resolve(sdkDirEnv))
      if (!sdkHead) {
        die(1, `cannot resolve git HEAD in ${sdkDirEnv}; refusing to pass the sdk_commit freshness binding.`)
      }
      if (pin.sdk_commit && !sdkHead.startsWith(pin.sdk_commit)) {
        // 只有**进 tarball 的路径**变了才算「tarball 陈旧」。tarball 实际只含
        // `package/{src,lib,package.json,LICENSE,README.md,CHANGELOG.md}`（`lib` 由 `src` 编译），
        // 因此纯 `spec/**`、`docs/**`、`scripts/**` 提交不该逼人重打包（否则测试/文档提交
        // 会让 pin 每次都变红 —— 2026-10-10 实测：N-02 的 test-only 提交即触发）。
        let shippedChanges = ''
        try {
          shippedChanges = execSync(`git diff --name-only ${pin.sdk_commit}..${sdkHead} -- src package.json`, {
            cwd: path.resolve(sdkDirEnv)
          })
            .toString()
            .trim()
        } catch {
          die(1, `cannot diff ${pin.sdk_commit}..${sdkHead} in ${sdkDirEnv}; refusing to pass on a missing input.`)
        }
        if (shippedChanges) {
          die(
            1,
            `sdk_commit is behind the SDK worktree HEAD and the **shipped surface** changed (the tarball is stale):\n  pin=${pin.sdk_commit}\n  SDK HEAD=${sdkHead}\n  changed:\n` +
              shippedChanges
                .split('\n')
                .map((l) => `    ${l}`)
                .join('\n') +
              `\nRebuild + repack: TJG_SDK_DIR=<sdk worktree> node scripts/pack-sdk-tarball.mjs --allow-commit-drift --apply, then pnpm add ./vendor/matrix-js-sdk.tgz --ignore-scripts and re-verify.`
          )
        }
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
  //   B. **路由面新鲜度**（后端兄弟仓在场时始终执行）：`pin.synapse_rust_commit` 必须是后端
  //      HEAD 的祖先；且**该 commit 与 HEAD 的 ledger 快照内容必须一致**
  //      （比对 `tests/unit/fixtures/ledger_export_sdk/` 的 profile JSON 内容；后端 sidecar
  //      的 `route_surface_sha256` 只作诊断）。内容一致 ⇒ 无需重钉，哪怕期间有提交碰过该目录。
  //
  // 为什么不再直接比「后端 HEAD」：任何一次纯文档提交都会移动 HEAD，pin 便永远追不上
  // （实测：记录 §13.23 的 docs 提交 `d0eb8306e` 让门禁第二次变红）。真正的不变量是
  // 「pin ↔ 契约快照一致」且「快照未落后于路由面」，而不是「等于 HEAD」。
  //
  // 为什么也不再比「区间内有没有提交碰过该目录」：那是**位置**判据，会把「只加了 sidecar
  // `manifest.json`」这类内容无变化的提交报成落后（2026-10-13 实测假阳性，见
  // `compareLedgerSnapshots` 的注释）。
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
      // 判据 = **内容**，不是「有没有提交碰过那个目录」（详见文件头的 compareLedgerSnapshots）。
      // 变异自证用逃生阀：`SYNAPSE_PIN_RANGE=<A>..<B>` 可把比对区间钉成任意历史区间
      // （默认 `<pin>..HEAD`），用来证明「内容真的变了 ⇒ 红」这一段仍然有效。
      const range = process.env.SYNAPSE_PIN_RANGE || `${pin.synapse_rust_commit}..${backendHead}`
      const [rangeFrom, rangeTo] = range.split('..')
      if (!rangeFrom || !rangeTo) {
        die(1, `SYNAPSE_PIN_RANGE='${range}' is not a '<from>..<to>' pair; refusing to pass on a malformed input.`)
      }
      // 用 `git show <rev>:<path>` 取**已提交**内容：既对两端对称，也不受后端脏工作区影响。
      const readAt = (rev) => (relPath) => {
        try {
          return execSync(`git show ${rev}:${relPath}`, {
            cwd: backendSibling,
            stdio: ['ignore', 'pipe', 'ignore']
          }).toString()
        } catch {
          return null
        }
      }
      const verdict = compareLedgerSnapshots(readLedgerSnapshot(readAt(rangeFrom)), readLedgerSnapshot(readAt(rangeTo)))
      if (!verdict.same) {
        const lead =
          verdict.basis === 'unresolvable'
            ? `cannot establish the ledger content identity in ${backendSibling} (${range}); refusing to pass on a missing input`
            : `SDK contract mirror is stale — backend ledger content changed in ${range} (basis: ${verdict.basis}` +
              `${verdict.changedProfiles.length > 0 ? `; changed: ${verdict.changedProfiles.join(', ')}` : ''})`
        die(
          1,
          `${lead}:\n${verdict.detail ? `${verdict.detail}\n` : ''}` +
            `Run \`pnpm contract:sync && pnpm contract:codegen\` in matrix-js-sdk, commit, then repack + refresh the pin.`
        )
      }
      process.stdout.write(
        `verify-sdk-pin: ledger content identity unchanged over ${range} (basis=${verdict.basis}) — no re-pin needed.\n`
      )
    }
  }
  process.stdout.write(
    `verify-sdk-pin: branch='${branch}' mode=${actualMode} sdk_version=${pin.sdk_version || '(dev)'} sdk_commit=${pin.sdk_commit || '(dev)'} synapse_rust=${pin.synapse_rust_commit || '(dev)'} — ok\n`
  )
}

// 入口守卫：被 tests/lint/ 导入时不得执行门禁本体（否则 import 即跑、测试没法跑）。
// 判据取「进程入口就是这个文件」，两侧都用 realpath 解析：经符号链接调用时若只比字符串，
// 会误判成「非直接执行」而**静默不跑**——那正是本仓最忌讳的 SKIP 形态。
// 解析失败时回落到「当作直接执行」（fail-loud，宁可跑错也不静默放过）。
function isDirectRun() {
  const entry = process.argv[1]
  if (!entry) return true
  try {
    return fs.realpathSync.native(entry) === fs.realpathSync.native(fileURLToPath(import.meta.url))
  } catch {
    return true
  }
}

if (isDirectRun()) {
  await main()
}
