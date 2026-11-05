#!/usr/bin/env node
/**
 * 安装后校验：`node_modules/matrix-js-sdk/lib` 必须等于 pin 的 `sdk_lib_fingerprint`。
 *
 * ## 为什么要在 install 阶段再查一次（2026-11-05 实测）
 *
 * 换掉 `vendor/matrix-js-sdk.tgz` 并改好 lockfile 的 `resolution.integrity` 后，
 * `pnpm install` **1.3s 就 Done**，`pnpm install --force`（53s）同样装回**旧内容**
 * —— 而且它还把 lockfile 里的 integrity 改回旧值。判断"装上了没有"不能看 install
 * 是否报错，也不能看耗时，只能看**产物内容**。
 *
 * `verify:sdk-pin` 里已有 `pin.sdk_lib_fingerprint ↔ 已安装 lib` 的判据，但它不在
 * `pnpm install` 流程中，所以"装完就走"的人（以及 CI 的 `--frozen-lockfile` 分支）
 * 拿到的是陈旧 SDK，之后所有"本地编译通过"都建立在错误前提上。
 *
 * 本脚本把该判据前移到 `postinstall`，fail-closed：
 * - 非 tarball 模式（dev 用 link:）或无 pin 指纹 → 跳过（打印原因，不算通过）；
 * - 指纹一致 → 静默通过（打印一行）；
 * - 不一致 → 退出码 1，并给出可直接执行的修复命令。
 *
 * 逃生阀：`TJG_SKIP_SDK_LIB_CHECK=1`（仅用于"明知 pin 陈旧、正在重钉"的场景）。
 */

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { fingerprintLibDir } from './sdk-lib-fingerprint.mjs'

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const pinPath = path.join(repoRoot, 'meta', 'sdk-pin.json')
const installedPkgPath = path.join(repoRoot, 'node_modules', 'matrix-js-sdk', 'package.json')

function readJson(p) {
  return JSON.parse(fs.readFileSync(p, 'utf8'))
}

function note(msg) {
  process.stdout.write(`check-installed-sdk-lib: ${msg}\n`)
}

async function main() {
  if (process.env.TJG_SKIP_SDK_LIB_CHECK === '1') {
    note('SKIP — TJG_SKIP_SDK_LIB_CHECK=1（不是通过，只是被显式跳过）')
    return 0
  }
  if (!fs.existsSync(pinPath)) {
    note('SKIP — meta/sdk-pin.json 不存在（非 release 场景）')
    return 0
  }

  const pin = readJson(pinPath)
  const expected = pin.sdk_lib_fingerprint
  if (!expected) {
    note('SKIP — pin 未记录 sdk_lib_fingerprint（dev 分支的空 pin）')
    return 0
  }

  // 依赖尚未安装（例如只跑了 `pnpm install --ignore-scripts` 之外的部分）时不做判断
  if (!fs.existsSync(installedPkgPath)) {
    note('SKIP — node_modules/matrix-js-sdk 未安装')
    return 0
  }

  const installedPkg = readJson(installedPkgPath)
  if (pin.sdk_version && installedPkg.version !== pin.sdk_version) {
    // 版本不一致时 fingerprint 必然不一致，但这条信息更有指向性
    process.stderr.write(
      `check-installed-sdk-lib: FAIL — 已安装 SDK 版本 ${installedPkg.version} ≠ pin ${pin.sdk_version}\n` +
        `  修法：pnpm install（必要时 pnpm install --force），然后重跑本检查\n`
    )
    return 1
  }

  const libDir = path.join(path.dirname(installedPkgPath), 'lib')
  const actual = await fingerprintLibDir(libDir)
  if (!actual) {
    process.stderr.write(`check-installed-sdk-lib: FAIL — 无法计算 ${libDir} 指纹（目录缺失或为空）\n`)
    return 1
  }
  if (actual === expected) {
    note(`OK — 已安装 lib 指纹与 pin 一致（${expected.slice(0, 24)}…）`)
    return 0
  }

  process.stderr.write(
    `check-installed-sdk-lib: FAIL — 已安装的 SDK 产物 ≠ pin 记录的 tarball 内容（N-05）\n` +
      `  pin       = ${expected}\n` +
      `  installed = ${actual}\n` +
      `  dir       = ${libDir}\n` +
      `\n` +
      `  已知坑（2026-11-05 实测）：换掉 vendor/*.tgz 后 pnpm 可能直接从缓存装回旧内容，\n` +
      `  install/--force 都不报错。判据只能是产物内容。修复方式任选其一：\n` +
      `  1) 解包覆盖（确定有效）：\n` +
      `     rm -rf /tmp/sdk-x && mkdir -p /tmp/sdk-x && tar -xzf vendor/matrix-js-sdk.tgz -C /tmp/sdk-x\n` +
      `     rm -rf node_modules/.pnpm/@langkebo+matrix-js-sdk@*/node_modules/@langkebo/matrix-js-sdk\n` +
      `     cp -R /tmp/sdk-x/package node_modules/.pnpm/@langkebo+matrix-js-sdk@file+vendor+matrix-js-sdk.tgz/node_modules/@langkebo/matrix-js-sdk\n` +
      `  2) 若是 pin 陈旧（并非安装问题）：重打包重钉\n` +
      `     TJG_SDK_DIR=<sdk worktree> node scripts/pack-sdk-tarball.mjs --apply --allow-commit-drift\n`
  )
  return 1
}

main()
  .then((code) => process.exit(code))
  .catch((err) => {
    process.stderr.write(`check-installed-sdk-lib: 未预期错误 — ${err && err.message ? err.message : err}\n`)
    process.exit(2)
  })
