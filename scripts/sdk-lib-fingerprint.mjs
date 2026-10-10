#!/usr/bin/env node
/**
 * SDK 包内 `lib/` 的**内容指纹** —— N-05 判据的共用底座。
 *
 * ## 为什么需要它（2026-10-10 实测）
 *
 * release 线改代码**不改版本号**，而 `verify-sdk-pin.mjs` 的 tarball 段此前只比
 * 「tarball 文件 sha256」与「`node_modules` 里 package.json 的 `version` 字符串」
 * ⇒ **"`node_modules` 里装的是哪个 commit 打的包"，门禁看不出来**。
 *
 * 后果真实发生过：Tjg 的 `vue-tsc` 在重钉前一直是绿的；换掉 `vendor/*.tgz`
 * 并**真正** `pnpm install` 之后，立刻暴露 `AdminManager.listBackups` 已不存在
 * （W-07，见方案文档 §9.14.9）。也就是说，所有"本地编译通过"的结论都可能
 * 建立在一份**陈旧 SDK 产物**上。
 *
 * ## 判据形状（三角闭合）
 *
 * ```
 * pin.tarball_sha256       ↔ vendor/*.tgz 的 sha256             （原有）
 * pin.sdk_lib_fingerprint  ↔ node_modules 里的 lib 指纹          （本模块 · verify 时算）
 * pin.sdk_lib_fingerprint  == 打进该 tarball 的 lib 指纹          （本模块 · pack 时算）
 * ⇒ node_modules 的 lib == tarball 内的 lib
 * ```
 *
 * 第三个等号成立的前提：`pnpm pack` 按 `files` 收集文件时**不改写 `lib/` 的内容**
 * （它只处理 package.json 的 publishConfig / 文件清单）。故 pack 侧指纹取自
 * **产出该 tarball 的 worktree 的 `lib/`**，无需解包 tarball。
 *
 * ## 为什么只看 `lib/` 而不看整包
 *
 * · `pnpm pack` 会**改写** `package.json`（它不等于 worktree 的 package.json）⇒ 纳入会假红；
 * · `src/` 虽也进包，但消费方只 import `lib/`，而 `lib/` 正是由 `src/` 编译出来的产物；
 * · `lib/` 是唯一能同时从「worktree」与「node_modules」两侧稳定重算、且不受
 *   pack 改写影响的子树。
 *
 * ## 为什么是异步 + 并发（性能实测，2026-10-10）
 *
 * `lib/` 有 2478 个文件。在本机 CLI 的 fs shim 下实测：
 * `readdir` 遍历 26ms、全量 `stat` 24ms、**全量同步 `readFileSync`+sha256 27322ms**
 * —— 瓶颈 100% 在逐文件读。改并发 `fs.promises.readFile`（16 路）后降到 **~5.4s**
 * （16/64/256 三档均为 5.4–5.7s，说明已到该 shim 的吞吐上限）。
 * 真实 CI（GitHub Actions，无此 shim）会明显更快。
 */

import crypto from 'node:crypto'
import fs from 'node:fs'
import fsp from 'node:fs/promises'
import path from 'node:path'

/** 并发读的默认路数。实测 16 已到 shim 吞吐上限，再高无收益。 */
const DEFAULT_CONCURRENCY = 16

/**
 * 对一棵 `lib/` 目录算稳定内容指纹。
 *
 * 稳定性来自三点：文件清单全局排序、`\0` 分隔「相对路径」与「内容摘要」、
 * 摘要本身是 sha256。因此**改名 / 增删 / 改内容**三种情况都会改变指纹。
 *
 * 只收 `isFile()`（`Dirent` 语义，符号链接不算）—— 包内 `lib/` 不应有链接，
 * 若真出现则视为"不可知"而不是静默忽略。
 *
 * @param {string} libDir 形如 `<pkg>/lib` 的目录。
 * @param {{ concurrency?: number }} [options]
 * @returns {Promise<string | null>} `sha256-<hex>`；目录不存在、不是目录、或没有文件时
 *   返回 `null`（**由调用方 fail-closed**；"没有文件"与"读不到"不在这里糊成同一个结果）。
 *   读到某个文件失败时**抛异常**：那是"不可知"，绝不允许被当成"一致"。
 */
export async function fingerprintLibDir(libDir, options = {}) {
  const concurrency = options.concurrency ?? DEFAULT_CONCURRENCY

  let stat
  try {
    stat = await fsp.stat(libDir)
  } catch {
    return null
  }
  if (!stat.isDirectory()) return null

  const files = []
  collect(libDir, '', files)
  if (files.length === 0) return null

  // 全量内容指纹，读文件并发化（见文件头「为什么是异步 + 并发」）。
  const rows = new Array(files.length)
  let cursor = 0
  const worker = async () => {
    for (;;) {
      const i = cursor++
      if (i >= files.length) return
      const [rel, abs] = files[i]
      let buf
      try {
        buf = await fsp.readFile(abs)
      } catch (err) {
        throw new Error(`cannot read ${abs} while fingerprinting SDK lib: ${err?.message || err}`)
      }
      rows[i] = `${rel}\0${crypto.createHash('sha256').update(buf).digest('hex')}`
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, files.length) }, worker))

  // 全局排序在 join 之前做一次：`readdirSync` 的顺序依文件系统而异
  // （APFS 与 ext4 不同），不排序会让同一个包在两台机器上算出不同指纹
  // —— 那是最难排查的一类假红。
  rows.sort()

  return `sha256-${crypto.createHash('sha256').update(rows.join('\n')).digest('hex')}`
}

/**
 * 递归收集 `[相对路径, 绝对路径]`（排序由调用方统一做）。
 *
 * @param {string} dir 当前目录的绝对路径。
 * @param {string} rel 当前目录相对 `lib/` 的前缀（顶层为空串）。
 * @param {Array<[string, string]>} out 输出累积器。
 */
function collect(dir, rel, out) {
  const entries = fs.readdirSync(dir, { withFileTypes: true })

  for (const entry of entries) {
    const abs = path.join(dir, entry.name)
    const childRel = rel ? `${rel}/${entry.name}` : entry.name
    if (entry.isDirectory()) {
      collect(abs, childRel, out)
    } else if (entry.isFile()) {
      out.push([childRel, abs])
    }
    // `isDirectory()/isFile()` 都为假 ⇒ 符号链接 / FIFO / socket：
    // 不纳入指纹，也不报错（否则 `lib/` 里一个无关链接就能让门禁恒红）。
  }
}
