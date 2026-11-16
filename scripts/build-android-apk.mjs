#!/usr/bin/env node
/**
 * 一条命令打出 Android APK，并把「独立 gradle 打包」的三个坑固化在脚本里。
 *
 * ## 为什么不能直接 `./gradlew assembleArm64Debug`
 *
 * `buildSrc/.../BuildTask.kt` 里 gradle 的 `rustBuild*` 任务不是自己调 cargo，而是回调
 * `pnpm tauri android android-studio-script`，该子命令要从**父进程的 WebSocket** 读 CLI 选项。
 * 终端里直接跑 gradle 没有父进程 ⇒
 * `failed to read CLI options: ... failed to build WebSocket client: ConnectionRefused`（exit 134）。
 *
 * ## 两种模式（别混用，产物不兼容）
 *
 * - `--mode dev`（默认）：`cargo build --no-default-features` + `gradlew -x rustBuild*`。
 *   APK 是 **devUrl 壳**：前端从 dev server（5210）取，改前端不用重打，`adb reverse` 后可用 CDP 探针。
 *   这是 `tauri android dev` 之外唯一能产出 dev 壳的办法（CLI 的 build 通道会给包塞 dist）。
 * - `--mode prod`：交给 `pnpm exec tauri android build`（它负责 dist→assets 同步、`custom-protocol`、gradle）。
 *   前端**打进 APK**，可离线运行；这种包无法用 `import('/src/...')` 那套探针。
 *
 * 手动 gradle 时踩到的三个坑（脚本已内建）：
 * 1. `rustBuild*` 会 panic（缺 WebSocket）⇒ 必须 `-x rustBuild*`，Rust 自己编；
 * 2. 必须用 **api26** 的 NDK 包装器（`minSdk = 26`；用 api24 会 `unable to find library -laaudio`）；
 * 3. 必须同时给 `CC_*` 与 `CXX_*`（只给 CC 会 `failed to find tool "...-clang++"`）。
 *
 * ## 用法
 *
 *   node scripts/build-android-apk.mjs                      # dev 壳，arm64，debug
 *   node scripts/build-android-apk.mjs --mode prod          # 出包（嵌 dist）
 *   node scripts/build-android-apk.mjs --release            # release profile
 *   node scripts/build-android-apk.mjs --target armv7 x86_64
 *   node scripts/build-android-apk.mjs --skip-rust          # 只重打包（仅 dev 模式有效）
 *   node scripts/build-android-apk.mjs --skip-verify        # 跳过 16KB/freshness 校验
 */

import { execFileSync } from 'node:child_process'
import { existsSync, readdirSync, readFileSync, statSync, unlinkSync } from 'node:fs'
import { join } from 'node:path'

const ROOT = process.cwd()
const ANDROID = join(ROOT, 'src-tauri/gen/android')
const TAURI_DIR = join(ROOT, 'src-tauri')
const ANDROID_HOME = process.env.ANDROID_HOME ?? join(process.env.HOME ?? '', 'Library/Android/sdk')
const DEFAULT_JAVA = '/opt/homebrew/opt/openjdk@21/libexec/openjdk.jdk/Contents/Home'
const JAVA_HOME = process.env.JAVA_HOME ?? (existsSync(DEFAULT_JAVA) ? DEFAULT_JAVA : '')

/** NDK 与 minSdk 对应：minSdk=26 ⇒ 用 api26 的 clang 包装器 */
const ANDROID_API_LEVEL = 26

/** --target → { cargo 三元组, gradle flavor 名, abi 目录名 } */
const TARGETS = {
  aarch64: { triple: 'aarch64-linux-android', arch: 'Arm64', abi: 'arm64-v8a' },
  armv7: { triple: 'armv7-linux-androideabi', arch: 'Arm', abi: 'armeabi-v7a' },
  x86_64: { triple: 'x86_64-linux-android', arch: 'X86_64', abi: 'x86_64' }
}

const argv = process.argv.slice(2)
const hasFlag = (name) => argv.includes(name)
const readOption = (name, fallback) => {
  const index = argv.indexOf(name)
  if (index === -1) return fallback
  const values = []
  for (let i = index + 1; i < argv.length && !argv[i].startsWith('--'); i += 1) values.push(argv[i])
  return values.length ? values : fallback
}

const mode = readOption('--mode', ['dev'])[0]
const release = hasFlag('--release')
const skipRust = hasFlag('--skip-rust')
const skipVerify = hasFlag('--skip-verify')
const targets = readOption('--target', ['aarch64'])
const profile = release ? 'release' : 'debug'
const profileCapitalized = profile.charAt(0).toUpperCase() + profile.slice(1)

const log = (msg) => console.log(msg)
const fail = (msg) => {
  console.error(`\n❌ ${msg}`)
  process.exit(1)
}

if (!['dev', 'prod'].includes(mode)) fail(`--mode 只支持 dev / prod，收到 ${mode}`)
for (const target of targets) if (!TARGETS[target]) fail(`未知 --target：${target}（可选 ${Object.keys(TARGETS).join(' / ')}）`)

/**
 * `gradle.properties` 里的 abiList/archList/targetList 会裁掉部分 ABI flavor。
 * 裁剪后对应的 `assemble<Arch><Profile>` 任务根本不存在，gradle 只会报
 * "Task 'assembleArmDebug' not found"，看不出是属性裁剪导致的 ⇒ 这里提前给出可执行的提示。
 */
const readGradleProperty = (key) => {
  const file = join(ANDROID, 'gradle.properties')
  if (!existsSync(file)) return undefined
  const matched = new RegExp(`^${key}\\s*=\\s*(.+)$`, 'm').exec(readFileSync(file, 'utf8'))
  return matched ? matched[1].trim() : undefined
}
const enabledArches = (readGradleProperty('archList') ?? '').split(',').filter(Boolean)
if (enabledArches.length) {
  const missing = targets.filter((target) => !enabledArches.includes(TARGETS[target].arch.toLowerCase()))
  if (missing.length) {
    fail(
      `gradle.properties 的 archList=${enabledArches.join(',')} 不含 ${missing.join('/')} 的 flavor。\n` +
        `   要么去掉这个 --target，要么把 ${missing.map((t) => TARGETS[t].abi).join('/')} 与 ` +
        `${missing.map((t) => TARGETS[t].arch.toLowerCase()).join('/')} 补进 abiList/archList/targetList（三者按下标一一对应）。`
    )
  }
}

/** 子进程统一环境：清掉宿主注入的 NODE_OPTIONS（沙箱下 vite build 会 EPIPE） */
const run = (cmd, args, { cwd = ROOT, env = {} } = {}) => {
  log(`\n$ ${cmd} ${args.join(' ')}`)
  execFileSync(cmd, args, {
    cwd,
    stdio: 'inherit',
    timeout: 60 * 60 * 1000,
    env: {
      ...process.env,
      NODE_OPTIONS: '',
      CODEBUDDY_BROKERED_FS_HOOK_ENABLED: '0',
      ...(JAVA_HOME ? { JAVA_HOME, PATH: `${JAVA_HOME}/bin:${process.env.PATH ?? ''}` } : {}),
      ANDROID_HOME,
      ANDROID_SDK_ROOT: ANDROID_HOME,
      ...env
    }
  })
}

/** 读 NDK 路径：优先用 build.gradle.kts 里钉住的版本，避免「AGP 悄悄选了 27」 */
const resolveNdk = () => {
  const gradleFile = join(ANDROID, 'app/build.gradle.kts')
  const pinned = existsSync(gradleFile)
    ? /ndkVersion\s*=\s*"([^"]+)"/.exec(readFileSync(gradleFile, 'utf8'))?.[1]
    : undefined
  const ndkRoot = join(ANDROID_HOME, 'ndk')
  if (pinned && existsSync(join(ndkRoot, pinned))) return { version: pinned, path: join(ndkRoot, pinned) }
  const installed = existsSync(ndkRoot) ? readdirSync(ndkRoot).sort() : []
  if (!installed.length) fail(`找不到 NDK：${ndkRoot}`)
  const fallback = installed[installed.length - 1]
  log(`⚠️  build.gradle.kts 未钉 ndkVersion（或本机未安装），回退到 ${fallback}`)
  return { version: fallback, path: join(ndkRoot, fallback) }
}

/** 校验 .so 的 LOAD 段按 16 KB 对齐（16 KB 页设备安装的硬条件） */
const verifyPageAlignment = (soPath, toolchainBin) => {
  if (!existsSync(soPath)) return { ok: false, detail: `.so 不存在：${soPath}` }
  const readelf = join(toolchainBin, 'llvm-readelf')
  if (!existsSync(readelf)) return { ok: false, detail: `找不到 llvm-readelf：${readelf}` }
  const out = execFileSync(readelf, ['-l', soPath], { encoding: 'utf8' })
  const aligns = out
    .split('\n')
    .filter((line) => line.trim().startsWith('LOAD'))
    .map((line) => (line.trim().split(/\s+/).pop() ?? '').toLowerCase())
  if (!aligns.length) return { ok: false, detail: '未解析到 LOAD 段' }
  const bad = aligns.filter((align) => Number.parseInt(align, 16) < 0x4000)
  return bad.length
    ? { ok: false, detail: `LOAD 对齐不足 16 KB：${[...new Set(bad)].join(', ')}（期望 0x4000）` }
    : { ok: true, detail: `LOAD 段全部 0x4000（${aligns.length} 段）` }
}

const reportApks = (entries, toolchain) => {
  const problems = []
  for (const { target, apkPath } of entries) {
    const { triple, abi } = TARGETS[target]
    if (!skipVerify) {
      const align = verifyPageAlignment(join(TAURI_DIR, `target/${triple}/${profile}/libtjg_app_lib.so`), toolchain)
      log(`${align.ok ? '✅' : '❌'} 16 KB 对齐（${abi}）：${align.detail}`)
      if (!align.ok) problems.push(`${abi} 页对齐不合格：${align.detail}`)
    }
    if (!existsSync(apkPath)) {
      problems.push(`APK 未生成：${apkPath}`)
      continue
    }
    const size = (statSync(apkPath).size / 1024 / 1024).toFixed(1)
    log(`✅ APK：${apkPath}（${size} MB，${statSync(apkPath).mtime.toLocaleString('zh-CN')}）`)
  }

  if (!skipVerify) {
    // 「APK 是否领先于全部原生输入」——避免拿着旧 Rust 的包去跑真机取证
    try {
      execFileSync('node', [join(ROOT, 'scripts/check-apk-freshness.mjs')], { stdio: 'inherit', env: process.env })
    } catch {
      problems.push('APK 落后于原生输入（见上方 apk-freshness 输出）')
    }
  }

  if (problems.length) {
    console.error('\n❌ 打包存在未通过项：')
    for (const item of problems) console.error(`  - ${item}`)
    process.exit(1)
  }
  log('\n✅ 打包完成')
}

const checkEnv = () => {
  if (!JAVA_HOME || !existsSync(JAVA_HOME)) fail('找不到 JDK：请设置 JAVA_HOME（本机推荐 openjdk@21）')
  if (!existsSync(join(ANDROID, 'gradlew'))) fail(`找不到 gradle wrapper：${ANDROID}/gradlew`)
  const ndk = resolveNdk()
  const toolchain = join(ndk.path, 'toolchains/llvm/prebuilt/darwin-x86_64/bin')
  const clang = join(toolchain, `aarch64-linux-android${ANDROID_API_LEVEL}-clang`)
  if (!existsSync(clang)) fail(`NDK ${ndk.version} 没有 api${ANDROID_API_LEVEL} 的 clang：${clang}`)
  log(`模式=${mode}  profile=${profile}  target=${targets.join(',')}  NDK=${ndk.version}`)
  return { ndk, toolchain }
}

/** prod：交给 tauri CLI（它负责 dist→assets、custom-protocol、gradle，缺一不可） */
const buildProd = (toolchain) => {
  if (skipRust) log('⚠️  prod 模式忽略 --skip-rust：CLI 自己编 Rust，dist→assets 的同步也在这一步')
  log('\n── 1/2 tauri android build（前端打进 APK）')
  const args = ['exec', 'tauri', 'android', 'build', '--apk', '--target', ...targets]
  if (!release) args.push('--debug')
  run('pnpm', args)

  log('\n── 2/2 校验')
  // CLI 产出的是 universal flavor：apk/universal/<profile>/app-universal-<profile>.apk
  reportApks(
    targets.map((target) => ({
      target,
      apkPath: join(ANDROID, `app/build/outputs/apk/universal/${profile}/app-universal-${profile}.apk`)
    })),
    toolchain
  )
}

/** dev：手动编 Rust（--no-default-features）+ gradle -x rustBuild*，产出 devUrl 壳 */
const buildDev = (toolchain) => {
  log('\n── 1/3 前端：跳过（dev 壳从 devUrl 取，改前端只需重启 dev server）')

  if (skipRust) {
    log('\n── 2/3 Rust：跳过（--skip-rust）')
  } else {
    log('\n── 2/3 编译 Rust 原生库（--no-default-features ⇒ 不内嵌 dist）')
    for (const target of targets) {
      const { triple } = TARGETS[target]
      const apiClang = join(toolchain, `${triple.replace('armv7-linux-androideabi', 'armv7a-linux-androideabi')}${ANDROID_API_LEVEL}-clang`)
      const cc = existsSync(apiClang) ? apiClang : join(toolchain, `${triple}${ANDROID_API_LEVEL}-clang`)
      const envKey = (prefix) => `${prefix}_${triple.replace(/-/g, '_')}`
      const linkerKey = `CARGO_TARGET_${triple.replace(/-/g, '_').toUpperCase()}_LINKER`
      const args = ['build', '--target', triple, '--lib', '--no-default-features']
      if (release) args.push('--release')
      run('cargo', args, {
        cwd: TAURI_DIR,
        env: {
          [envKey('CC')]: cc,
          [envKey('CXX')]: `${cc}++`,
          [envKey('AR')]: join(toolchain, 'llvm-ar'),
          [linkerKey]: cc,
          PATH: `${join(process.env.HOME ?? '', '.cargo/bin')}:${process.env.PATH ?? ''}`
        }
      })
    }
  }

  log('\n── 3/3 gradle 打包（-x rustBuild*：Rust 已在上一步编好）')
  for (const target of targets) {
    const { arch } = TARGETS[target]
    const apkDir = arch.toLowerCase()
    const apkPath = join(ANDROID, `app/build/outputs/apk/${apkDir}/${profile}/app-${apkDir}-${profile}.apk`)
    // gradle 的增量判定不会因「只改构建脚本注释」重打包，但 apk-freshness 会判 APK 陈旧。
    // 产物比构建脚本旧时先删掉，让 assemble 真的重跑一次，避免脚本自己卡在自检上。
    const gradleFile = join(ANDROID, 'app/build.gradle.kts')
    if (existsSync(apkPath) && existsSync(gradleFile) && statSync(gradleFile).mtimeMs > statSync(apkPath).mtimeMs) {
      unlinkSync(apkPath)
      log(`ℹ️  删除旧 APK 以强制重打包（构建脚本比产物新）：${apkPath}`)
    }
    run(
      join(ANDROID, 'gradlew'),
      ['-p', ANDROID, `:app:assemble${arch}${profileCapitalized}`, '-x', `rustBuild${arch}${profileCapitalized}`, '--console=plain'],
      { cwd: ANDROID }
    )
  }

  log('\n── 校验')
  reportApks(
    targets.map((target) => ({
      target,
      // gradle 的 flavor 名是 Arm64，产物目录却是全小写 arm64
      apkPath: join(
        ANDROID,
        `app/build/outputs/apk/${TARGETS[target].arch.toLowerCase()}/${profile}/app-${TARGETS[target].arch.toLowerCase()}-${profile}.apk`
      )
    })),
    toolchain
  )
  log('   联调前置：adb reverse tcp:5210 tcp:5210 && adb shell am start -n com.tjg.app/com.tjg.app.MainActivity')
}

const { toolchain } = checkEnv()
if (mode === 'prod') buildProd(toolchain)
else buildDev(toolchain)
