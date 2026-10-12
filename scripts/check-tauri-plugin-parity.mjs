#!/usr/bin/env node
/**
 * Guard — Tauri **Rust crate 与 JS 包**的版本一致性。
 *
 * 为什么需要它：Tauri 插件是「JS 包 + Rust crate」成对的，JS 侧发命令、Rust 侧实现命令；
 * 版本漂移会让前端调用到后端不存在（或签名不同）的命令，症状常常是运行期
 * `plugin:xxx|yyy not found` 之类的**静默失败**，而不是编译错误。
 *
 * 官方判据（tauri.app/develop/updating-dependencies + CLI 报错文案）：
 * - **core**：`tauri` crate 与 `@tauri-apps/api` 必须**同 major.minor**
 *   （CLI 原文：`Found version mismatched Tauri packages. Make sure the NPM package and
 *   Rust crate versions are on the same major/minor releases`）；
 * - **插件**：CLI 按 **major.minor** 报错；文档进一步建议 npm 包与 crate **版本完全一致**
 *   （"we might introduce this type of changes in patch releases, so ... keep the exact
 *   versions synced"）。因此本守卫把 **major.minor 不一致判为错误**，把
 *   「同 major.minor 但 patch 不同」作为 INFO 列出（不过度收紧到比工具链更严）。
 *
 * 实测（2026-10-13）：`tauri-plugin-notification`(Cargo.lock) = 2.3.3 而
 * `@tauri-apps/plugin-notification`(package.json) = 2.4.0 —— JS 侧先行升级、crate 未跟，
 * 正是本守卫要拦住的形态。
 *
 * Usage:
 *   node scripts/check-tauri-plugin-parity.mjs          # 人类可读
 *   node scripts/check-tauri-plugin-parity.mjs --json    # 机器可读
 *
 * Exit codes:
 *   0  无 major.minor 漂移
 *   1  存在 major.minor 漂移
 *   2  环境/自检异常（Cargo.lock 或 package.json 读不到、解析到 0 个包 —— 基数断言，
 *      避免「什么都没读到」被误判为「通过」）
 */

import { readFileSync, existsSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const projectRoot = path.resolve(__dirname, '..')
const cargoLockFile = path.join(projectRoot, 'src-tauri', 'Cargo.lock')
const packageJsonFile = path.join(projectRoot, 'package.json')

/** core 对：Rust crate ↔ JS 包 */
export const CORE_PAIR = { rust: 'tauri', js: '@tauri-apps/api' }

/** 插件命名映射：`tauri-plugin-<x>` ↔ `@tauri-apps/plugin-<x>` */
export const PLUGIN_PREFIX = 'tauri-plugin-'
export const JS_PLUGIN_PREFIX = '@tauri-apps/plugin-'

/** 取 major.minor（判据单位） */
export function majorMinor(version) {
  const match = /^(\d+)\.(\d+)/.exec(String(version ?? '').trim())
  return match ? `${match[1]}.${match[2]}` : null
}

/**
 * 解析 `Cargo.lock` 的 `[[package]]` 段，得到 name → version。
 *
 * @param {string} lockText Cargo.lock 全文
 * @returns {Map<string, string>}
 */
export function parseCargoLock(lockText) {
  const versions = new Map()
  const blocks = String(lockText ?? '').split('[[package]]')
  for (const block of blocks) {
    const name = /^\s*name\s*=\s*"([^"]+)"/m.exec(block)
    const version = /^\s*version\s*=\s*"([^"]+)"/m.exec(block)
    if (name && version) versions.set(name[1], version[1])
  }
  return versions
}

/**
 * 取出需要比对的对（core + 两侧都存在的插件）。
 *
 * @param {{ lockVersions: Map<string,string>, pkg: { dependencies?: Record<string,string>, devDependencies?: Record<string,string> } }} input
 */
export function collectVersionPairs({ lockVersions, pkg } = {}) {
  const jsDeps = { ...(pkg?.dependencies ?? {}), ...(pkg?.devDependencies ?? {}) }
  const pairs = []
  const info = []

  const coreRust = lockVersions?.get(CORE_PAIR.rust)
  const coreJs = jsDeps[CORE_PAIR.js]
  if (coreRust || coreJs) {
    pairs.push({ kind: 'core', rust: CORE_PAIR.rust, js: CORE_PAIR.js, rustVersion: coreRust ?? null, jsVersion: coreJs ?? null })
  }

  for (const [rustName, rustVersion] of [...(lockVersions ?? new Map()).entries()].sort()) {
    if (!rustName.startsWith(PLUGIN_PREFIX)) continue
    const jsName = `${JS_PLUGIN_PREFIX}${rustName.slice(PLUGIN_PREFIX.length)}`
    const jsVersion = jsDeps[jsName]
    if (jsVersion === undefined) {
      info.push(`Rust 侧独有（JS 未使用）：${rustName}@${rustVersion}`)
      continue
    }
    pairs.push({ kind: 'plugin', rust: rustName, js: jsName, rustVersion, jsVersion })
  }

  for (const jsName of Object.keys(jsDeps).sort()) {
    if (!jsName.startsWith(JS_PLUGIN_PREFIX)) continue
    const rustName = `${PLUGIN_PREFIX}${jsName.slice(JS_PLUGIN_PREFIX.length)}`
    if (!lockVersions?.has(rustName)) {
      info.push(`JS 侧独有（无同名 crate，可能是第三方/自建包）：${jsName}@${jsDeps[jsName]}`)
    }
  }

  return { pairs, info }
}

/**
 * 纯函数判据 —— 无 I/O，便于单测。
 *
 * @param {{ lockVersions: Map<string,string>, pkg: object }} input
 * @returns {{ ok: boolean, errors: Array<object>, info: string[], checked: number }}
 */
export function evaluateTauriPluginParity({ lockVersions, pkg } = {}) {
  const { pairs, info } = collectVersionPairs({ lockVersions, pkg })
  const errors = []

  for (const pair of pairs) {
    if (!pair.rustVersion || !pair.jsVersion) {
      errors.push({ ...pair, reason: 'missing-version' })
      continue
    }
    const rustMM = majorMinor(pair.rustVersion)
    const jsMM = majorMinor(pair.jsVersion)
    if (rustMM !== jsMM) {
      errors.push({ ...pair, rustMM, jsMM, reason: 'major-minor-drift' })
      continue
    }
    if (pair.rustVersion !== pair.jsVersion) {
      info.push(`同 major.minor、patch 不同（建议对齐）：${pair.rust}@${pair.rustVersion} ↔ ${pair.js}@${pair.jsVersion}`)
    }
  }

  return { ok: errors.length === 0, errors, info, checked: pairs.length }
}

function loadInputs() {
  if (!existsSync(cargoLockFile)) throw new Error(`Cargo.lock not found: ${cargoLockFile}`)
  if (!existsSync(packageJsonFile)) throw new Error(`package.json not found: ${packageJsonFile}`)
  return {
    lockVersions: parseCargoLock(readFileSync(cargoLockFile, 'utf8')),
    pkg: JSON.parse(readFileSync(packageJsonFile, 'utf8'))
  }
}

async function main() {
  const jsonOutput = process.argv.includes('--json')

  let inputs
  try {
    inputs = loadInputs()
  } catch (err) {
    console.error(`[tauri-plugin-parity] scan failed: ${err.message}`)
    process.exit(2)
  }

  // 基数断言：两侧都必须真的读到东西
  if (inputs.lockVersions.size === 0) {
    console.error('[tauri-plugin-parity] scan failed: Cargo.lock 未解析到任何 package（基数断言）')
    process.exit(2)
  }
  const result = evaluateTauriPluginParity(inputs)
  if (result.checked === 0) {
    console.error('[tauri-plugin-parity] scan failed: 未找到任何可比对的 (crate, npm 包) 对（基数断言）')
    process.exit(2)
  }

  if (jsonOutput) {
    process.stdout.write(`${JSON.stringify(result, null, 2)}\n`)
  } else if (result.ok) {
    console.log(`[tauri-plugin-parity] OK — ${result.checked} 对（core + 插件）major.minor 一致`)
    for (const line of result.info) console.log(`  INFO ${line}`)
  } else {
    console.error('[tauri-plugin-parity] FAIL — Tauri 前后端版本漂移（major.minor 不一致）:')
    for (const error of result.errors) {
      if (error.reason === 'missing-version') {
        console.error(`  ${error.rust} ↔ ${error.js}：一侧缺版本号（rust=${error.rustVersion}, js=${error.jsVersion}）`)
      } else {
        console.error(`  ${error.rust}@${error.rustVersion} (${error.rustMM}) ↔ ${error.js}@${error.jsVersion} (${error.jsMM})`)
      }
    }
    console.error('  修法：同步两侧到同一 major.minor（插件建议版本完全一致）')
    for (const line of result.info) console.error(`  INFO ${line}`)
  }

  process.exit(result.ok ? 0 : 1)
}

const isDirectRun = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)

if (isDirectRun) {
  main().catch((err) => {
    console.error('[tauri-plugin-parity] unexpected error', err)
    process.exit(2)
  })
}
