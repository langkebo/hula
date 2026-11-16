/**
 * APK 新鲜度判定：设备上装的那个包，是否**晚于全部原生输入**。
 *
 * 为什么需要：debug 包的 `devUrl = http://localhost:5210`，前端资源不打进 APK
 * ⇒ **前端改动不需要重打**；但 `src-tauri/**` 的 Rust / capabilities 改动**必须**重打。
 * 2026-11-14 实测踩到：旧包 20:16，而 `lib.rs`（冷启动回填 `UserInfo`）是 22:19、
 * `im_user_repository.rs` 是次日 12:08 ⇒ 设备上跑的是旧 Rust，探针却全绿，
 * 「D2-R 修好了」这个结论在设备端其实没有被验证。
 *
 * 判据只看**原生输入**（Rust 源码 / 本地插件 / capability / tauri 配置 / Android 壳配置），
 * 不看 `src/**`（那是 dev server 的事）。
 */

import { existsSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'

/** 默认 debug APK 路径（arm64） */
export const DEFAULT_APK = 'src-tauri/gen/android/app/build/outputs/apk/arm64/debug/app-arm64-debug.apk'

/** 需要递归扫描的原生输入目录 */
const INPUT_DIRS = ['src-tauri/src', 'src-tauri/capabilities', 'tauri-plugin-hula/src', 'tauri-plugin-hula/android']

/** 需要单独比对的原生输入文件 */
const INPUT_FILES = [
  'src-tauri/Cargo.toml',
  'src-tauri/Cargo.lock',
  'src-tauri/tauri.conf.json',
  'src-tauri/tauri.dev.conf.json',
  'src-tauri/.cargo/config.toml',
  'src-tauri/gen/android/app/build.gradle.kts',
  'src-tauri/gen/android/build.gradle.kts',
  'src-tauri/gen/android/app/src/main/AndroidManifest.xml',
  'tauri-plugin-hula/Cargo.toml'
]

/** 递归时跳过的目录名（构建产物 / 依赖） */
const SKIP_DIRS = new Set(['node_modules', 'target', 'build', '.git'])

function walk(dir, out, root) {
  let entries
  try {
    entries = readdirSync(dir, { withFileTypes: true })
  } catch {
    return
  }
  for (const entry of entries) {
    const full = join(dir, entry.name)
    if (entry.isDirectory()) {
      if (SKIP_DIRS.has(entry.name)) continue
      walk(full, out, root)
    } else if (entry.isFile()) {
      try {
        out.push({ path: full, rel: full.startsWith(`${root}/`) ? full.slice(root.length + 1) : full, mtime: statSync(full).mtimeMs })
      } catch {
        /* 并发删除等，忽略 */
      }
    }
  }
}

/**
 * 判定 APK 与原生输入的新旧关系。
 *
 * @param {{ cwd?: string, apkPath?: string }} [options]
 * @returns {{ status: 'missing' | 'fresh' | 'stale', apkPath: string, apkMtime: number | null,
 *   newest: { rel: string, mtime: number } | null, staleInputs: Array<{ rel: string, mtime: number }> }}
 */
export function checkApkFreshness(options = {}) {
  const cwd = options.cwd ?? process.cwd()
  const apkRel = options.apkPath ?? DEFAULT_APK
  const apkPath = join(cwd, apkRel)

  const inputs = []
  for (const dir of INPUT_DIRS) {
    const abs = join(cwd, dir)
    if (existsSync(abs)) walk(abs, inputs, cwd)
  }
  for (const file of INPUT_FILES) {
    const abs = join(cwd, file)
    if (!existsSync(abs)) continue
    try {
      inputs.push({ path: abs, rel: file, mtime: statSync(abs).mtimeMs })
    } catch {
      /* 忽略 */
    }
  }

  const newest = inputs.reduce((acc, cur) => (!acc || cur.mtime > acc.mtime ? cur : acc), null)

  if (!existsSync(apkPath)) {
    return { status: 'missing', apkPath: apkRel, apkMtime: null, newest, staleInputs: [] }
  }

  const apkMtime = statSync(apkPath).mtimeMs
  const staleInputs = inputs
    .filter((input) => input.mtime > apkMtime)
    .sort((a, b) => b.mtime - a.mtime)
    .map((input) => ({ rel: input.rel, mtime: input.mtime }))

  return { status: staleInputs.length === 0 ? 'fresh' : 'stale', apkPath: apkRel, apkMtime, newest, staleInputs }
}

/** `mtimeMs` → `MM-DD HH:mm` */
export function formatMtime(mtimeMs) {
  if (!mtimeMs) return '—'
  const d = new Date(mtimeMs)
  const pad = (n) => String(n).padStart(2, '0')
  return `${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`
}
