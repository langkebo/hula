#!/usr/bin/env node
/**
 * SDK augmentation drift check.
 *
 * Compares enums declared inside `declare module 'matrix-js-sdk'` in
 * `src/types/matrix-js-sdk-augmentations.d.ts` against their canonical
 * definitions in the installed matrix-js-sdk package source
 * (`node_modules/matrix-js-sdk/src`, shipped in the vendor tarball;
 * falls back to the sibling `../matrix-js-sdk` checkout when present
 * for local SDK co-development).
 *
 * Motivation: `matrix-js-sdk-augmentations.d.ts` is 1471 LOC of manually
 * maintained type patches. Historically it has drifted from the SDK
 * (e.g. `IPushRule.default` missing, `PendingEventOrdering.PendingFirst`
 * lingering after removal). This script catches the drift in CI.
 *
 * Strategy:
 *   1. Parse the augmentation file with ts-morph, enumerate top-level
 *      `export enum X { ... }` blocks.
 *   2. For each, grep the sibling SDK source tree for a canonical
 *      `export enum X` and extract its member set.
 *   3. Diff member names and values. Report additions (augmentation is
 *      stale — SDK has grown) and removals (augmentation carries dead
 *      entries the SDK has already dropped).
 *
 * Exit code:
 *   0  no drift detected
 *   1  drift detected
 *   2  setup error (SDK not found / parse failed)
 *
 * Usage:
 *   node scripts/check-sdk-augmentations.mjs            human-readable report
 *   node scripts/check-sdk-augmentations.mjs --json     machine-readable output
 */

import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs'
import { resolve, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { Project, SyntaxKind } from 'ts-morph'

const scriptDir = fileURLToPath(new URL('.', import.meta.url))
const repoRoot = resolve(scriptDir, '..')
const augmentationPath = resolve(repoRoot, 'src/types/matrix-js-sdk-augmentations.d.ts')
// SDK 去 link 化（2026-08-09）：优先读已安装 tarball 解包出的 src/（node_modules），
// 本地联合开发时若 sibling 存在则优先用 sibling（内容更新）。
const installedSdkSrc = resolve(repoRoot, 'node_modules/matrix-js-sdk/src')
const siblingSdkSrc = resolve(repoRoot, '../matrix-js-sdk/src')
const sdkRoot = existsSync(siblingSdkSrc) ? siblingSdkSrc : installedSdkSrc
const emitJson = process.argv.includes('--json')

function fail(message, code = 2) {
  console.error(`[check-sdk-augmentations] ${message}`)
  process.exit(code)
}

try {
  statSync(sdkRoot)
} catch {
  fail(
    `SDK source not found at ${installedSdkSrc} (nor sibling ${siblingSdkSrc}). Run pnpm install first.`
  )
}

const project = new Project({
  useInMemoryFileSystem: false,
  compilerOptions: { allowJs: false, skipLibCheck: true }
})

let augSource
try {
  augSource = project.addSourceFileAtPath(augmentationPath)
} catch (err) {
  fail(`Failed to load augmentation file: ${err.message}`)
}

// ----- 1. Collect enums declared inside `declare module 'matrix-js-sdk'` -----

const augmentedEnums = new Map() // name -> Array<{ name, value }>
for (const mod of augSource.getModules()) {
  if (mod.getName() !== "'matrix-js-sdk'" && mod.getName() !== '"matrix-js-sdk"') continue
  for (const decl of mod.getEnums()) {
    const name = decl.getName()
    const members = decl.getMembers().map((m) => ({
      name: m.getName(),
      value: m.getValue()
    }))
    augmentedEnums.set(name, members)
  }
}

if (augmentedEnums.size === 0) {
  // 清单 D 已移除 augmentation 中所有与 SDK 重复的 enum 声明，augmentation 不再包含任何 enum。
  // 这种状态下没有 enum drift 可检测，直接 emit 空报告并退出。
  if (emitJson) {
    console.log(
      JSON.stringify(
        {
          augmentedEnumCount: 0,
          canonicalEnumCount: 0,
          errors: [],
          warnings: [],
          note: 'No enums found inside `declare module "matrix-js-sdk"` — augmentation cleanup (清单 D) removed all duplicate enum declarations.'
        },
        null,
        2
      )
    )
  } else {
    console.log(
      '[check-sdk-augmentations] No enums found inside `declare module "matrix-js-sdk"`. ' +
        'Augmentation no longer duplicates SDK enums (清单 D cleanup). Nothing to check.'
    )
  }
  process.exit(0)
}

// ----- 2. Walk SDK source and index canonical enum declarations by name -----

function walkTs(dir) {
  const out = []
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry)
    const st = statSync(full)
    if (st.isDirectory()) out.push(...walkTs(full))
    else if (full.endsWith('.ts') && !full.endsWith('.d.ts')) out.push(full)
  }
  return out
}

const canonicalEnums = new Map() // name -> { file, members }
const sdkFiles = walkTs(sdkRoot)
for (const file of sdkFiles) {
  let src
  try {
    src = project.addSourceFileAtPath(file)
  } catch {
    continue
  }
  for (const decl of src.getEnums()) {
    if (!decl.isExported()) continue
    const name = decl.getName()
    if (canonicalEnums.has(name)) continue // first-wins; duplicates are re-exports
    canonicalEnums.set(name, {
      file: file.replace(sdkRoot, 'matrix-js-sdk/src'),
      members: decl.getMembers().map((m) => ({ name: m.getName(), value: m.getValue() }))
    })
  }
}

// ----- 3. Diff -----

const drifts = []
for (const [name, augMembers] of augmentedEnums.entries()) {
  const canonical = canonicalEnums.get(name)
  if (!canonical) {
    drifts.push({
      type: 'missing-canonical',
      enum: name,
      detail: `Augmentation declares enum \`${name}\` but no canonical \`export enum ${name}\` was found in the SDK. Candidate: the canonical lives in @types or re-export location and this script does not yet cover it.`
    })
    continue
  }

  const augIndex = new Map(augMembers.map((m) => [m.name, m.value]))
  const canIndex = new Map(canonical.members.map((m) => [m.name, m.value]))

  for (const [memberName, canValue] of canIndex.entries()) {
    if (!augIndex.has(memberName)) {
      drifts.push({
        type: 'missing-in-augmentation',
        enum: name,
        member: memberName,
        canonicalValue: canValue,
        canonicalFile: canonical.file,
        detail: `SDK has \`${name}.${memberName}\` (value ${JSON.stringify(canValue)}) but augmentation is missing it.`
      })
    } else if (augIndex.get(memberName) !== canValue) {
      drifts.push({
        type: 'value-mismatch',
        enum: name,
        member: memberName,
        augmentationValue: augIndex.get(memberName),
        canonicalValue: canValue,
        canonicalFile: canonical.file,
        detail: `Value mismatch for \`${name}.${memberName}\`: augmentation has ${JSON.stringify(
          augIndex.get(memberName)
        )}, SDK has ${JSON.stringify(canValue)}.`
      })
    }
  }

  for (const [memberName, augValue] of augIndex.entries()) {
    if (!canIndex.has(memberName)) {
      drifts.push({
        type: 'extra-in-augmentation',
        enum: name,
        member: memberName,
        augmentationValue: augValue,
        canonicalFile: canonical.file,
        detail: `Augmentation has \`${name}.${memberName}\` (value ${JSON.stringify(
          augValue
        )}) but SDK does not. Likely a dead entry to remove.`
      })
    }
  }
}

// ----- 4. Classify: errors are always bad (dead entries / value mismatches).
//        warnings are often intentional subset omissions.

const errorDrifts = drifts.filter(
  (d) => d.type === 'extra-in-augmentation' || d.type === 'value-mismatch' || d.type === 'missing-canonical'
)
const warningDrifts = drifts.filter((d) => d.type === 'missing-in-augmentation')

// ----- 5. Report -----

if (emitJson) {
  console.log(
    JSON.stringify(
      {
        augmentedEnumCount: augmentedEnums.size,
        canonicalEnumCount: canonicalEnums.size,
        errors: errorDrifts,
        warnings: warningDrifts
      },
      null,
      2
    )
  )
} else {
  console.log(`Augmentation enums: ${augmentedEnums.size}`)
  console.log(`Canonical SDK enums (exported, top-level): ${canonicalEnums.size}`)
  console.log('')
  if (errorDrifts.length === 0 && warningDrifts.length === 0) {
    console.log('No drift detected.')
  } else {
    if (errorDrifts.length > 0) {
      console.log(`ERRORS (${errorDrifts.length}) — augmentation has dead / wrong entries:`)
      for (const d of errorDrifts) console.log(`  - [${d.type}] ${d.detail}`)
      console.log('')
    }
    if (warningDrifts.length > 0) {
      console.log(`WARNINGS (${warningDrifts.length}) — SDK has members the augmentation omits.`)
      console.log('Often intentional (the augmentation is a subset). Inspect and extend if needed.')
      console.log('Re-run with --verbose to list them.')
      if (process.argv.includes('--verbose')) {
        console.log('')
        for (const d of warningDrifts) console.log(`  - [${d.type}] ${d.detail}`)
      }
    }
  }
}

process.exit(errorDrifts.length === 0 ? 0 : 1)

export { augmentationPath, sdkRoot }
