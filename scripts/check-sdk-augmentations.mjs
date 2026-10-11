#!/usr/bin/env node
/**
 * SDK augmentation drift check.
 *
 * 本脚本守护 `src/types/matrix-js-sdk-augmentations.d.ts` 与已安装 matrix-js-sdk
 * 的一致性，含**两道**判据：
 *
 *   (1) enum 漂移（原有）——augmentation 里 `declare module 'matrix-js-sdk'` 内声明的
 *       enum 与 SDK 的规范定义逐成员比对，报「缺失/多余/取值不符」。
 *
 *   (2) 幻影成员（2026-10-11 新增）——augmentation 里对 **SDK 主入口已经导出的**
 *       接口/类做 declaration merging 时，它声明的每个成员必须真的存在于 SDK 侧。
 *       若声明了一个 SDK 不存在的成员，TypeScript 会因为 augmentation 而放行，
 *       于是**编译通过、运行时 TypeError**（或静默 undefined）。这类缺陷原门禁
 *       结构上查不出来（脚本自述 "Nothing to check"），是 P0 级缺陷的藏身处。
 *
 * 判据边界（重要，避免误读为「全覆盖」）：
 *   - 只检查「SDK 主入口（lib/index.d.ts）也导出的同名接口」。augmentation 里
 *     新增的非 SDK 导出类型（如 tjg 自己的 `IPublicRoomsOpts`、`SearchParams`）
 *     属于**加类型声明**，不参与本判据。
 *   - 不检查成员签名（参数类型/返回值），只查成员是否存在。签名漂移由 `vue-tsc` 覆盖。
 *
 * 已知「幻影」分两类，都必须登记在 `scripts/sdk-augmentations-baseline.json`：
 *   - `exemptions` —— 有意为之的扩展（augmentation 确实要凭空添加成员）。
 *   - `debt`      —— 上游 API 的陈旧副本 / 死声明，需要烧掉。
 *   两者都要求写明理由；未登记的幻影一律报错。
 *
 * 棘轮语义（与 `scripts/check-bare-matrix-paths.mjs`、体积棘轮一致）：
 *   - 新增未登记幻影 ⇒ 红。
 *   - 基线里已不存在的条目（修好了 / 声明被删了）⇒ 红（stale），必须用 `--update` 剪掉。
 *   - `--update` **只允许剪枝，不允许新增**（新增必须手工登记并写理由），因此基线只能变紧。
 *
 * Exit code:
 *   0 无漂移
 *   1 有漂移 / 有未登记幻影 / 基线 stale
 *   2 环境或自检失败（SDK 未安装、解析失败、**提取器自检未过**）
 *
 * Usage:
 *   node scripts/check-sdk-augmentations.mjs            人类可读报告
 *   node scripts/check-sdk-augmentations.mjs --json     机器可读
 *   node scripts/check-sdk-augmentations.mjs --verbose  列出 warning 明细
 *   node scripts/check-sdk-augmentations.mjs --update   剪掉基线里的 stale 条目（不新增）
 */

import { existsSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs'
import { resolve, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { Project, ts } from 'ts-morph'

const scriptDir = fileURLToPath(new URL('.', import.meta.url))
const repoRoot = resolve(scriptDir, '..')
const augmentationPath = resolve(repoRoot, 'src/types/matrix-js-sdk-augmentations.d.ts')
const baselinePath = resolve(repoRoot, 'scripts/sdk-augmentations-baseline.json')
// SDK 去 link 化（2026-08-09）：优先读已安装 tarball 解包出的 src/（node_modules），
// 本地联合开发时若 sibling 存在则优先用 sibling（内容更新）。
const installedSdkSrc = resolve(repoRoot, 'node_modules/matrix-js-sdk/src')
const installedSdkTypes = resolve(repoRoot, 'node_modules/matrix-js-sdk/lib/index.d.ts')
const siblingSdkSrc = resolve(repoRoot, '../matrix-js-sdk/src')
const sdkRoot = existsSync(siblingSdkSrc) ? siblingSdkSrc : installedSdkSrc
const emitJson = process.argv.includes('--json')
const doUpdate = process.argv.includes('--update')

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
if (!existsSync(installedSdkTypes)) {
  fail(`SDK type entry not found at ${installedSdkTypes}. Run pnpm install first.`)
}

// ===========================================================================
// Part 1 — enum drift
// ===========================================================================

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

const augmentedEnums = new Map() // name -> Array<{ name, value }>
const augmentedMembers = new Map() // interfaceName -> Set<memberName>
for (const mod of augSource.getModules()) {
  if (mod.getName() !== "'matrix-js-sdk'" && mod.getName() !== '"matrix-js-sdk"') continue
  for (const decl of mod.getEnums()) {
    augmentedEnums.set(
      decl.getName(),
      decl.getMembers().map((m) => ({ name: m.getName(), value: m.getValue() }))
    )
  }
  for (const iface of mod.getInterfaces()) {
    const names = new Set()
    for (const member of iface.getMembers()) {
      const kind = member.getKindName()
      if (
        kind === 'MethodSignature' ||
        kind === 'PropertySignature' ||
        kind === 'GetAccessor' ||
        kind === 'SetAccessor'
      ) {
        names.add(member.getName?.() ?? '<unnamed>')
      }
    }
    // 同名接口可能分多处声明，合并成员集
    const prev = augmentedMembers.get(iface.getName()) ?? new Set()
    for (const n of names) prev.add(n)
    augmentedMembers.set(iface.getName(), prev)
  }
}

// ----- SDK 源码目录：索引规范 enum 声明 -----

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
const augProject = new Project({
  useInMemoryFileSystem: false,
  compilerOptions: { allowJs: false, skipLibCheck: true }
})
for (const file of walkTs(sdkRoot)) {
  let src
  try {
    src = augProject.addSourceFileAtPath(file)
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

const drifts = []
for (const [name, augEnumMembers] of augmentedEnums.entries()) {
  const canonical = canonicalEnums.get(name)
  if (!canonical) {
    drifts.push({
      type: 'missing-canonical',
      enum: name,
      detail: `Augmentation declares enum \`${name}\` but no canonical \`export enum ${name}\` was found in the SDK. Candidate: the canonical lives in @types or re-export location and this script does not yet cover it.`
    })
    continue
  }

  const augIndex = new Map(augEnumMembers.map((m) => [m.name, m.value]))
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

const errorDrifts = drifts.filter(
  (d) => d.type === 'extra-in-augmentation' || d.type === 'value-mismatch' || d.type === 'missing-canonical'
)
const warningDrifts = drifts.filter((d) => d.type === 'missing-in-augmentation')

// ===========================================================================
// Part 2 — phantom members（augmentation 声明了 SDK 不存在的成员）
// ===========================================================================

const phantomSetup = new Project({
  useInMemoryFileSystem: false,
  compilerOptions: {
    allowJs: false,
    skipLibCheck: true,
    target: ts.ScriptTarget.ES2022,
    module: ts.ModuleKind.ESNext,
    moduleResolution: ts.ModuleResolutionKind.Bundler
  }
})

const sdkTypeSource = phantomSetup.addSourceFileAtPath(installedSdkTypes)
const checker = phantomSetup.getTypeChecker()
const exportedMembers = new Map() // interfaceName -> Set<memberName>
for (const [name, decls] of sdkTypeSource.getExportedDeclarations().entries()) {
  const names = new Set()
  for (const decl of decls) {
    const symbol = decl.getSymbol()
    if (!symbol) continue
    let type
    try {
      type = checker.getDeclaredTypeOfSymbol(symbol)
    } catch {
      continue
    }
    for (const prop of type?.getProperties?.() ?? []) names.add(prop.getName())
  }
  if (names.size > 0) exportedMembers.set(name, names)
}

// ----- 提取器自检（基数断言）-----
// 若 SDK 成员索引静默变空/变小，本脚本会把「没查到」当成「不存在」从而大量误报。
// 因此显式断言：索引规模 + 若干**确定存在**的成员必须被查到，否则以 EXIT=2 退出。
const SELF_TEST = [
  ['MatrixClient', exportedMembers.get('MatrixClient'), 400, [
    'setPowerLevel',
    'sendEvent',
    'redactEvent',
    'sendEmoteMessage',
    'getProfileManager',
    'getPresenceManager',
    'getRoomManager'
  ]],
  ['Room', exportedMembers.get('Room'), 100, ['getMember', 'getMembers', 'currentState']],
  ['RoomMember', exportedMembers.get('RoomMember'), 20, ['getAvatarUrl', 'roomId', 'userId', 'powerLevel']]
]
const selfTestFailures = []
if (exportedMembers.size < 200) {
  selfTestFailures.push(`SDK 主入口导出符号仅 ${exportedMembers.size} 个（期望 > 200）`)
}
for (const [name, members, minCount, mustHave] of SELF_TEST) {
  if (!members) {
    selfTestFailures.push(`${name} 未在 SDK 主入口找到`)
    continue
  }
  if (members.size < minCount) {
    selfTestFailures.push(`${name} 成员仅 ${members.size} 个（期望 >= ${minCount}）`)
  }
  for (const m of mustHave) {
    if (!members.has(m)) selfTestFailures.push(`${name}.${m} 被判定为不存在，但它是已知存在的成员`)
  }
}
if (selfTestFailures.length > 0) {
  fail(
    `SDK 成员提取器自检失败（拒绝以「无幻影」收场）：\n  - ${selfTestFailures.join('\n  - ')}`
  )
}

// ----- 逐接口比对 -----
const phantomFindings = [] // { iface, member, key }
const skippedInterfaces = []
for (const [ifaceName, declaredMembers] of augmentedMembers.entries()) {
  const sdkMembers = exportedMembers.get(ifaceName)
  if (!sdkMembers) {
    skippedInterfaces.push(ifaceName)
    continue
  }
  for (const member of declaredMembers) {
    if (!sdkMembers.has(member)) {
      phantomFindings.push({ iface: ifaceName, member, key: `${ifaceName}.${member}` })
    }
  }
}
phantomFindings.sort((a, b) => a.key.localeCompare(b.key))

// ----- 基线（棘轮）-----
let baseline = { exemptions: {}, debt: {} }
if (existsSync(baselinePath)) {
  try {
    const raw = JSON.parse(readFileSync(baselinePath, 'utf8'))
    baseline = {
      exemptions: raw.exemptions ?? {},
      debt: raw.debt ?? {}
    }
  } catch (err) {
    fail(`基线文件无法解析: ${baselinePath}: ${err.message}`)
  }
}
const registered = new Map()
for (const [k, reason] of Object.entries(baseline.exemptions)) registered.set(k, { kind: 'exempt', reason })
for (const [k, reason] of Object.entries(baseline.debt)) registered.set(k, { kind: 'debt', reason })

const unregistered = phantomFindings.filter((f) => !registered.has(f.key))
const staleBaseline = [...registered.keys()]
  .filter((k) => !phantomFindings.some((f) => f.key === k))
  .sort()
const missingReason = [...registered.entries()]
  .filter(([, v]) => typeof v.reason !== 'string' || v.reason.trim() === '')
  .map(([k]) => k)

if (doUpdate) {
  if (unregistered.length > 0) {
    console.error(
      `[check-sdk-augmentations] --update 拒绝执行：存在 ${unregistered.length} 个未登记幻影。\n` +
        '  请先修好它们，或**手工**写进 scripts/sdk-augmentations-baseline.json（exemptions/debt 并附理由）。\n' +
        '  自动新增会变成「注水豁免」，因此本脚本刻意不支持。'
    )
    for (const f of unregistered) console.error(`    - ${f.key}`)
    process.exit(2)
  }
  const next = {
    generatedAt: new Date().toISOString(),
    note: 'SDK augmentation 幻影成员登记表。exemptions = 有意扩展；debt = 待烧掉的陈旧声明。两项都必须写理由。',
    exemptions: {},
    debt: {}
  }
  for (const key of Object.keys(baseline.exemptions).filter((k) => !staleBaseline.includes(k)).sort()) {
    next.exemptions[key] = baseline.exemptions[key]
  }
  for (const key of Object.keys(baseline.debt).filter((k) => !staleBaseline.includes(k)).sort()) {
    next.debt[key] = baseline.debt[key]
  }
  writeFileSync(baselinePath, `${JSON.stringify(next, null, 2)}\n`, 'utf8')
  console.log(
    `[check-sdk-augmentations] 基线已剪枝 ${staleBaseline.length} 条 stale 条目（不新增）: ${baselinePath}`
  )
  if (staleBaseline.length > 0) for (const k of staleBaseline) console.log(`  - ${k}`)
  process.exit(0)
}

// ===========================================================================
// Report
// ===========================================================================

const debtCount = Object.keys(baseline.debt).length
const exemptCount = Object.keys(baseline.exemptions).length

if (emitJson) {
  console.log(
    JSON.stringify(
      {
        augmentedEnumCount: augmentedEnums.size,
        canonicalEnumCount: canonicalEnums.size,
        errors: errorDrifts,
        warnings: warningDrifts,
        phantom: {
          findings: phantomFindings,
          unregistered,
          staleBaseline,
          missingReason,
          exemptions: exemptCount,
          debt: debtCount,
          skippedInterfaces
        }
      },
      null,
      2
    )
  )
} else {
  console.log(`Augmentation enums: ${augmentedEnums.size}`)
  console.log(`Canonical SDK enums (exported, top-level): ${canonicalEnums.size}`)
  console.log(
    `Augmented interfaces merged with SDK main entry: ${
      augmentedMembers.size - skippedInterfaces.length
    }（另有 ${skippedInterfaces.length} 个非 SDK 导出类型，属加类型声明，不参与判据）`
  )
  console.log('')

  if (errorDrifts.length === 0 && warningDrifts.length === 0) {
    console.log('enum drift: none')
  } else {
    if (errorDrifts.length > 0) {
      console.log(`ENUM ERRORS (${errorDrifts.length}) — augmentation has dead / wrong entries:`)
      for (const d of errorDrifts) console.log(`  - [${d.type}] ${d.detail}`)
      console.log('')
    }
    if (warningDrifts.length > 0) {
      console.log(`ENUM WARNINGS (${warningDrifts.length}) — SDK has members the augmentation omits.`)
      console.log('Often intentional (the augmentation is a subset). Inspect and extend if needed.')
      console.log('Re-run with --verbose to list them.')
      if (process.argv.includes('--verbose')) {
        console.log('')
        for (const d of warningDrifts) console.log(`  - [${d.type}] ${d.detail}`)
      }
    }
  }

  console.log('')
  console.log(
    `phantom members: 命中 ${phantomFindings.length}（登记 exempt ${exemptCount} / debt ${debtCount}）`
  )
  if (unregistered.length > 0) {
    console.log(`\nPHANTOM ERRORS (${unregistered.length}) — 声明了 SDK 不存在的成员，且未登记:`)
    for (const f of unregistered) {
      console.log(`  - ${f.key}`)
      console.log(
        `      → 要么删除该声明 / 改用 SDK 真实 API，要么在 scripts/sdk-augmentations-baseline.json 中登记并写理由`
      )
    }
  }
  if (staleBaseline.length > 0) {
    console.log(`\nBASELINE STALE (${staleBaseline.length}) — 基线条目已不再命中，必须剪掉:`)
    for (const k of staleBaseline) console.log(`  - ${k}`)
    console.log('  运行 `node scripts/check-sdk-augmentations.mjs --update` 剪枝（棘轮只允许变紧）')
  }
  if (missingReason.length > 0) {
    console.log(`\nBASELINE MISSING REASON (${missingReason.length}) — 每条登记都必须写理由:`)
    for (const k of missingReason) console.log(`  - ${k}`)
  }
  if (
    unregistered.length === 0 &&
    staleBaseline.length === 0 &&
    missingReason.length === 0 &&
    errorDrifts.length === 0
  ) {
    console.log('无漂移、无未登记幻影、基线无 stale。')
  }
}

const failed =
  errorDrifts.length > 0 ||
  unregistered.length > 0 ||
  staleBaseline.length > 0 ||
  missingReason.length > 0
process.exit(failed ? 1 : 0)

export { augmentationPath, sdkRoot, baselinePath }
