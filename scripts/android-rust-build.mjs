#!/usr/bin/env node
/**
 * 只编 Rust 原生库（不碰 gradle、不碰前端），供 gradle 的 `rustBuild*` 任务在
 * 拿不到 Tauri CLI 的 WebSocket 时回退调用。
 *
 * ## 为什么需要这个入口
 *
 * `buildSrc/.../BuildTask.kt` 的 `rustBuild*` 任务本身不调 cargo，而是回调
 * `pnpm tauri android android-studio-script`；该子命令必须从**父进程的 WebSocket** 读 CLI 选项。
 * 在 Android Studio 里点 Run/Build 时没有那个父进程 ⇒
 * `failed to read CLI options: failed to build WebSocket client: ConnectionRefused`（exit 134）
 * ⇒ `BUILD FAILED`（热 daemon 下 2 s 就红）。
 *
 * `BuildTask.kt` 已改成「先试 CLI，失败回退到本脚本」，所以 IDE 里直接构建也能出包。
 *
 * ## 三个必须做对的细节（都是实测踩出来的）
 *
 * 1. **api26 的工具链**：`minSdk = 26`，用 api24 的 clang 会在链接期
 *    `ld.lld: error: unable to find library -laaudio`（`aaudio` 自 API 26 起才有）。
 * 2. **`CC_*` 与 `CXX_*` 都要给**：只给 CC 时 cc-rs 报 `failed to find tool "…-clang++"`。
 * 3. **jniLibs 软链**：gradle 的 `mergeJniLibFolders` 只认 `app/src/main/jniLibs/<abi>/`，
 *    而 cargo 产物在 `src-tauri/target/<triple>/<profile>/`。
 *    这些软链原本由 CLI 的 `android-studio-script` 建；走回退路径时必须自己建，
 *    否则 APK 里没有 `libtjg_app_lib.so`，装上就 `UnsatisfiedLinkError`。
 *
 * ## 用法
 *
 *   node scripts/android-rust-build.mjs --target aarch64            # debug
 *   node scripts/android-rust-build.mjs --target aarch64 --release  # release
 *   node scripts/android-rust-build.mjs --target aarch64 --dry-run   # 只打印将要执行的命令
 *
 * `--target` 收 tauri 的 target 名（aarch64 / armv7 / i686 / x86_64），与 gradle 任务名一致。
 */

import { execFileSync } from 'node:child_process'
import { existsSync, lstatSync, mkdirSync, readFileSync, readdirSync, rmSync, symlinkSync } from 'node:fs'
import { join } from 'node:path'

const ROOT = process.env.TAURI_PROJECT_ROOT ?? process.cwd()
const TAURI_DIR = join(ROOT, 'src-tauri')
const ANDROID = join(TAURI_DIR, 'gen/android')
const ANDROID_HOME = process.env.ANDROID_HOME ?? process.env.ANDROID_SDK_ROOT ?? join(process.env.HOME ?? '', 'Library/Android/sdk')
const HOST_TAG = process.platform === 'darwin' ? 'darwin-x86_64' : 'linux-x86_64'

/** --target → cargo 三元组 / jniLibs 目录 / sysroot 目录 / clang 前缀 */
const TARGETS = {
  aarch64: {
    triple: 'aarch64-linux-android',
    abi: 'arm64-v8a',
    sysrootDir: 'aarch64-linux-android',
    clangPrefix: 'aarch64-linux-android'
  },
  armv7: {
    triple: 'armv7-linux-androideabi',
    abi: 'armeabi-v7a',
    sysrootDir: 'arm-linux-androideabi',
    clangPrefix: 'armv7a-linux-androideabi'
  },
  i686: { triple: 'i686-linux-android', abi: 'x86', sysrootDir: 'i686-linux-android', clangPrefix: 'i686-linux-android' },
  x86_64: { triple: 'x86_64-linux-android', abi: 'x86_64', sysrootDir: 'x86_64-linux-android', clangPrefix: 'x86_64-linux-android' }
}

const argv = process.argv.slice(2)
const hasFlag = (name) => argv.includes(name)
const readValue = (name, fallback) => {
  const index = argv.indexOf(name)
  return index === -1 || !argv[index + 1] ? fallback : argv[index + 1]
}

const target = readValue('--target', 'aarch64')
const release = hasFlag('--release')
const dryRun = hasFlag('--dry-run')
const profile = release ? 'release' : 'debug'

const log = (msg) => console.log(`[android-rust] ${msg}`)
const fail = (msg) => {
  console.error(`\n[android-rust] ❌ ${msg}`)
  process.exit(1)
}

const spec = TARGETS[target]
if (!spec) fail(`未知 --target：${target}（可选 ${Object.keys(TARGETS).join(' / ')}）`)

/** minSdk 从 gradle 读（默认 26）：它决定必须用哪个 api level 的 clang 包装器 */
const readMinSdk = () => {
  const gradleFile = join(ANDROID, 'app/build.gradle.kts')
  if (!existsSync(gradleFile)) return 26
  const matched = /minSdk\s*=\s*(\d+)/.exec(readFileSync(gradleFile, 'utf8'))
  return matched ? Number(matched[1]) : 26
}

const resolveNdk = () => {
  const gradleFile = join(ANDROID, 'app/build.gradle.kts')
  const pinned = existsSync(gradleFile)
    ? /ndkVersion\s*=\s*"([^"]+)"/.exec(readFileSync(gradleFile, 'utf8'))?.[1]
    : undefined
  const ndkRoot = join(ANDROID_HOME, 'ndk')
  if (pinned && existsSync(join(ndkRoot, pinned))) return join(ndkRoot, pinned)
  const installed = existsSync(ndkRoot) ? readdirSync(ndkRoot).sort() : []
  if (!installed.length) fail(`找不到 NDK：${ndkRoot}`)
  log(`⚠️  build.gradle.kts 未钉 ndkVersion，回退到 ${installed[installed.length - 1]}`)
  return join(ndkRoot, installed[installed.length - 1])
}

/**
 * 保证 jniLibs/<abi>/ 下的两个软链存在且指向正确位置。
 *
 * `libc++_shared.so` 是 Tauri 运行时必需的 C++ 运行库；`libtjg_app_lib.so` 是 cargo 产物。
 * 已存在但指向旧路径时重建（换 NDK / 换 profile 都会让旧链失效）。
 */
const ensureJniLibs = (toolchainBin, ndkPath) => {
  const abiDir = join(ANDROID, 'app/src/main/jniLibs', spec.abi)
  mkdirSync(abiDir, { recursive: true })

  const links = [
    {
      name: 'libtjg_app_lib.so',
      source: join(TAURI_DIR, `target/${spec.triple}/${profile}/libtjg_app_lib.so`)
    },
    {
      name: 'libc++_shared.so',
      source: join(ndkPath, `toolchains/llvm/prebuilt/${HOST_TAG}/sysroot/usr/lib/${spec.sysrootDir}/libc++_shared.so`)
    }
  ]

  for (const { name, source } of links) {
    const linkPath = join(abiDir, name)
    if (!existsSync(source)) fail(`软链目标不存在：${source}`)
    if (existsSync(linkPath) || isSymlink(linkPath)) {
      const current = readLinkSafe(linkPath)
      if (current === source) continue
      rmSync(linkPath, { force: true })
    }
    symlinkSync(source, linkPath)
    log(`🔗 jniLibs/${spec.abi}/${name} → ${source}`)
  }
}

const isSymlink = (path) => {
  try {
    return lstatSync(path).isSymbolicLink()
  } catch {
    return false
  }
}

const readLinkSafe = (path) => {
  try {
    return execFileSync('readlink', [path], { encoding: 'utf8' }).trim()
  } catch {
    return ''
  }
}

const main = () => {
  const apiLevel = readMinSdk()
  const ndkPath = resolveNdk()
  const toolchainBin = join(ndkPath, `toolchains/llvm/prebuilt/${HOST_TAG}/bin`)
  const clang = join(toolchainBin, `${spec.clangPrefix}${apiLevel}-clang`)
  if (!existsSync(clang)) fail(`NDK 没有 api${apiLevel} 的 clang：${clang}`)

  const cargo = existsSync(join(process.env.HOME ?? '', '.cargo/bin/cargo'))
    ? join(process.env.HOME ?? '', '.cargo/bin/cargo')
    : 'cargo'

  const env = {
    ...process.env,
    // dev 壳（debug）不能带 default features，否则会把 dist 嵌进包，CDP 探针与热更都会失效
    [envKey('CC')]: clang,
    [envKey('CXX')]: `${clang}++`,
    [envKey('AR')]: join(toolchainBin, 'llvm-ar'),
    [`CARGO_TARGET_${spec.triple.replace(/-/g, '_').toUpperCase()}_LINKER`]: clang,
    PATH: `${join(process.env.HOME ?? '', '.cargo/bin')}:${toolchainBin}:${process.env.PATH ?? ''}`
  }

  const args = ['build', '--target', spec.triple, '--lib']
  if (!release) args.push('--no-default-features')
  if (release) args.push('--release')

  log(`target=${target} (${spec.triple})  profile=${profile}  api=${apiLevel}  ndk=${ndkPath.split('/').pop()}`)
  if (dryRun) {
    log(`$ ${cargo} ${args.join(' ')}`)
    for (const key of Object.keys(env)) if (key.startsWith('CC_') || key.startsWith('CXX_') || key.startsWith('AR_') || key.includes('_LINKER')) log(`  ${key}=${env[key]}`)
    return
  }

  execFileSync(cargo, args, { cwd: TAURI_DIR, stdio: 'inherit', env, timeout: 60 * 60 * 1000 })
  ensureJniLibs(toolchainBin, ndkPath)
  log(`✅ ${join(TAURI_DIR, `target/${spec.triple}/${profile}/libtjg_app_lib.so`)}`)
}

const envKey = (prefix) => `${prefix}_${spec.triple.replace(/-/g, '_')}`

main()
