#!/usr/bin/env node
/**
 * Guard — 前端**实际调用**的 Tauri 能力，必须在 capabilities 里有对应授权。
 *
 * 背景（2026-10-13 实测 `pnpm td` 日志）：
 * `[ErrorTracker] 未捕获 Promise错误: window.destroy not allowed.
 *  Permissions associated with this command: core:window:allow-destroy`
 *
 * 根因不是"没人用 destroy"，而是**调用是间接的**：
 * `@tauri-apps/api/window.js` 的 `onCloseRequested(handler)` 在 handler 返回后
 * 若未被 `preventDefault()` 就 `await this.destroy()`。而
 * `docs/TJG-安全纵深专项方案-2026-10-12.md` 的 SC05-P3-3 以"无窗口级 `.destroy()`"
 * 为据删除了 `core:window:allow-destroy` —— 该取证只搜了字面 `.destroy(`，
 * 漏掉了框架内部的间接调用，于是删除变成了运行时故障。
 *
 * 本守卫把"取证"变成可执行的：注册「前端 API → 所需权限」规则，
 * 一旦源码里出现该 API 的调用点而 capabilities 里没有对应权限，就判红。
 *
 * 方向性是刻意的（**单向**）：只检查「用了 ⇒ 必须授权」，
 * **不**检查「授权了 ⇒ 必须有人用」——后者需要精确到窗口/平台的调用点归属，
 * 恰恰是 SC05-P3-3 出错的环节（用粗糙的 grep 反推"无人用"）。
 *
 * Usage:
 *   node scripts/check-tauri-permission-usage.mjs          # 人类可读
 *   node scripts/check-tauri-permission-usage.mjs --json   # 机器可读
 *
 * Exit codes:
 *   0  全部已授权
 *   1  存在"用了但未授权"的权限
 *   2  环境/自检异常（扫描到 0 个源文件、capabilities 全读不到 —— 基数断言，
 *      避免"什么都没扫到"被误判为"通过"）
 */

import { readdirSync, readFileSync, statSync, existsSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const projectRoot = path.resolve(__dirname, '..')
const scanRoot = path.join(projectRoot, 'src')
const capabilitiesDir = path.join(projectRoot, 'src-tauri', 'capabilities')

const SKIP_DIRS = new Set(['node_modules', 'dist', 'coverage', '__tests__', '.worktrees'])
const SCAN_EXT = /\.(ts|tsx|vue|mts)$/
const TEST_FILE = /\.(test|spec)\.(ts|tsx|mts)$/

/**
 * 「前端 API → 所需 Tauri 权限」注册表。
 *
 * 每条都要有**可复现的取证理由**；新增条目请附理由，否则宁可不加
 * （误报会让守卫被绕过，比缺失更糟）。
 */
export const PERMISSION_RULES = [
  {
    permission: 'core:window:allow-destroy',
    pattern: /\bonCloseRequested\s*\(/,
    rationale:
      '@tauri-apps/api 的 onCloseRequested() 在 handler 未 preventDefault 时自动调用 window.destroy()（间接调用，字面搜 `.destroy(` 找不到）'
  },
  {
    permission: 'core:window:allow-hide',
    pattern: /\.hide\s*\(\s*\)/,
    rationale: '窗口/通知窗 hide()（Notify.vue、Tray.vue 的隐藏流程）'
  },
  {
    permission: 'core:window:allow-show',
    pattern: /\.show\s*\(\s*\)/,
    rationale: '窗口 show()（显式唤起被隐藏的主窗口/通知窗）'
  },
  {
    permission: 'core:window:allow-set-always-on-top',
    pattern: /\.setAlwaysOnTop\s*\(/,
    rationale: '窗口置顶切换（通知窗与来电窗需要压住主窗口）'
  },
  {
    permission: 'core:window:allow-set-resizable',
    pattern: /\.setResizable\s*\(/,
    rationale: '窗口尺寸锁定切换（登录/通话等固定尺寸窗口）'
  }
]

function walkSources(dir, out = []) {
  for (const entry of readdirSync(dir)) {
    const full = path.join(dir, entry)
    const stat = statSync(full)
    if (stat.isDirectory()) {
      if (SKIP_DIRS.has(entry)) continue
      walkSources(full, out)
    } else if (SCAN_EXT.test(entry) && !TEST_FILE.test(entry)) {
      out.push(full)
    }
  }
  return out
}

/** 读取全部 capability 文件的权限标识集合（含嵌套对象项的 `identifier`） */
export function collectGrantedPermissions(capabilities) {
  const granted = new Set()
  for (const capability of Object.values(capabilities ?? {})) {
    for (const permission of capability?.permissions ?? []) {
      if (typeof permission === 'string') {
        granted.add(permission)
      } else if (permission && typeof permission === 'object' && typeof permission.identifier === 'string') {
        granted.add(permission.identifier)
      }
    }
  }
  return granted
}

/**
 * 纯函数判据：注册表里每个规则在源码中出现时，其权限必须在 capabilities 里已授权。
 *
 * @param {{ sources: Record<string, string>, capabilities: Record<string, unknown>, rules?: typeof PERMISSION_RULES }} input
 * @returns {{ ok: boolean, violations: Array<{ permission: string, rationale: string, hits: string[] }>, checked: string[] }}
 */
export function evaluatePermissionUsage({ sources = {}, capabilities = {}, rules = PERMISSION_RULES } = {}) {
  const granted = collectGrantedPermissions(capabilities)
  const violations = []
  const checked = []

  for (const rule of rules) {
    const hits = []
    for (const [file, text] of Object.entries(sources)) {
      if (rule.pattern.test(text)) hits.push(file)
    }
    if (hits.length === 0) continue
    checked.push(rule.permission)
    if (!granted.has(rule.permission)) {
      violations.push({ permission: rule.permission, rationale: rule.rationale, hits: hits.sort() })
    }
  }

  return { ok: violations.length === 0, violations, checked }
}

function loadSources() {
  const sources = {}
  for (const file of walkSources(scanRoot)) {
    sources[path.relative(projectRoot, file)] = readFileSync(file, 'utf8')
  }
  return sources
}

function loadCapabilities() {
  if (!existsSync(capabilitiesDir)) return {}
  const capabilities = {}
  for (const entry of readdirSync(capabilitiesDir)) {
    if (!entry.endsWith('.json')) continue
    const file = path.join(capabilitiesDir, entry)
    capabilities[entry] = JSON.parse(readFileSync(file, 'utf8'))
  }
  return capabilities
}

async function main() {
  const jsonOutput = process.argv.includes('--json')

  let sources
  let capabilities
  try {
    sources = loadSources()
    capabilities = loadCapabilities()
  } catch (err) {
    console.error(`[tauri-permission-usage] scan failed: ${err.message}`)
    process.exit(2)
  }

  // 基数断言：两侧都必须真的读到东西
  if (Object.keys(sources).length === 0) {
    console.error('[tauri-permission-usage] scan failed: src/ 下未扫描到任何源文件（基数断言）')
    process.exit(2)
  }
  if (Object.keys(capabilities).length === 0) {
    console.error('[tauri-permission-usage] scan failed: 未读到任何 capability 文件（基数断言）')
    process.exit(2)
  }

  const result = evaluatePermissionUsage({ sources, capabilities })

  if (jsonOutput) {
    process.stdout.write(
      `${JSON.stringify({ ...result, scannedFiles: Object.keys(sources).length, capabilities: Object.keys(capabilities) }, null, 2)}\n`
    )
  } else if (result.ok) {
    console.log(
      `[tauri-permission-usage] OK — ${result.checked.length} 条"用了 ⇒ 必须授权"判据全部满足（扫描 ${Object.keys(sources).length} 文件）`
    )
  } else {
    console.error('[tauri-permission-usage] FAIL — 前端用到了未授权的 Tauri 能力:')
    for (const violation of result.violations) {
      console.error(`  - ${violation.permission}  ← ${violation.rationale}`)
      console.error(`      调用点：${violation.hits.join(', ')}`)
    }
    console.error('  修法：把该权限加入 src-tauri/capabilities/ 下适用的 capability 文件')
  }

  process.exit(result.ok ? 0 : 1)
}

const isDirectRun = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)

if (isDirectRun) {
  main().catch((err) => {
    console.error('[tauri-permission-usage] unexpected error', err)
    process.exit(2)
  })
}
