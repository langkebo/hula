#!/usr/bin/env node
/**
 * 联调环境基线四元组 —— 让「联调结论」绑定到它所属的环境。
 *
 * 背景：核验报告 §八 自己写下过教训——「后端问题清单必须绑定镜像 tag / 容器启动时间」。
 * 但此前该约束只存在于文档叙述里，没有可执行的校验，于是同一份结论会被拿去套不同镜像。
 *
 * 四个值都必须采：
 *   backend_image       镜像全名（tag 可能被同名重建覆盖）
 *   backend_started_at  容器启动时刻（区分「同 tag 重启」）
 *   sdk_pin             commit + tarball sha256 + 版本（防止跑在旧 tarball 上）
 *   apk_mtime           APK 构建时刻（防止在旧 Rust 上取证，等价于 check:apk-freshness）
 *
 * 设计原则：
 *   - **不 crash**：没有 docker / 没有 APK 时返回 null，由调用方按 requireApk 决定是否致命；
 *   - **不猜**：缺失就是 null，绝不用「当前时间」之类的默认值填充；
 *   - **退出码语义**：调用方用 2 表示「环境不匹配」，与 1（断言失败）区分。
 *
 * Usage（供 scripts/live/*、探针与 run-live 复用）：
 *   import { captureBaseline, assertBaseline, formatBaseline } from './live-env.mjs'
 *
 * 也可以直接跑：node scripts/lib/live-env.mjs
 */

import { execFileSync } from 'node:child_process'
import { readFileSync, statSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const projectRoot = path.resolve(__dirname, '..', '..')

/** 后端容器名（与 docker/docker-compose.yml 一致）。 */
const DEFAULT_CONTAINER = 'synapse-app'

/** APK 产物路径（arm64 debug，联调用）。 */
const APK_PATH = 'src-tauri/gen/android/app/build/outputs/apk/arm64/debug/app-arm64-debug.apk'

/** 执行一条 shell 命令，失败返回 null（不抛）。 */
function tryExec(cmd) {
  try {
    return execFileSync('sh', ['-c', cmd], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim()
  } catch {
    return null
  }
}

/** 读取文件 stat，失败返回 null。 */
function tryStat(relPath) {
  try {
    return statSync(path.join(projectRoot, relPath))
  } catch {
    return null
  }
}

/**
 * 采集当前环境的四元组。
 *
 * @param {{container?: string}} [options]
 * @returns {{backend_image: string|null, backend_started_at: string|null, sdk_pin: {commit: string|null, tarball: string|null, version: string|null}, apk_mtime: string|null}}
 */
export function captureBaseline(options = {}) {
  const container = options.container ?? process.env.SYNAPSE_CONTAINER ?? DEFAULT_CONTAINER
  const inspect = (fmt) => tryExec(`docker inspect ${container} --format '${fmt}'`)

  let sdkPin = { commit: null, tarball: null, version: null }
  try {
    const pin = JSON.parse(readFileSync(path.join(projectRoot, 'meta', 'sdk-pin.json'), 'utf8'))
    sdkPin = {
      commit: typeof pin.sdk_commit === 'string' ? pin.sdk_commit : null,
      tarball: typeof pin.tarball_sha256 === 'string' ? pin.tarball_sha256 : null,
      version: typeof pin.sdk_version === 'string' ? pin.sdk_version : null
    }
  } catch {
    // pin 文件缺失或不可解析：保持全 null，由调用方判定
  }

  const apk = tryStat(APK_PATH)

  return {
    backend_image: inspect('{{.Config.Image}}'),
    backend_started_at: inspect('{{.State.StartedAt}}'),
    sdk_pin: sdkPin,
    apk_mtime: apk ? apk.mtime.toISOString() : null
  }
}

/**
 * 校验当前环境是否与期望基线一致。
 *
 * 只有「期望里给了值」的字段才参与比较——没给的字段视为「不约束」，
 * 这样本地首次跑不需要预先填满 baseline。
 *
 * @param {ReturnType<typeof captureBaseline>} actual
 * @param {{expected?: object, requireApk?: boolean, allowDrift?: boolean, label?: string}} [options]
 * @returns {{drift: string[], exempted: boolean}}
 */
export function assertBaseline(actual, options = {}) {
  const { expected = {}, requireApk = false, allowDrift = false, label = 'live-env' } = options
  const drift = []

  const wantImage = expected.backend_image
  if (wantImage && actual.backend_image !== wantImage) {
    drift.push(`backend_image: 期望 ${wantImage}，实际 ${actual.backend_image ?? '(未采集到)'}`)
  }

  const wantStarted = expected.backend_started_at
  if (wantStarted && actual.backend_started_at !== wantStarted) {
    drift.push(`backend_started_at: 期望 ${wantStarted}，实际 ${actual.backend_started_at ?? '(未采集到)'}`)
  }

  const wantCommit = expected.sdk_pin?.commit
  if (wantCommit && actual.sdk_pin.commit !== wantCommit) {
    drift.push(`sdk_pin.commit: 期望 ${wantCommit}，实际 ${actual.sdk_pin.commit ?? '(未采集到)'}`)
  }

  if (requireApk && !actual.apk_mtime) {
    drift.push(`apk_mtime: 缺失（${APK_PATH} 不存在，原生层判据不得在无 APK 时取证）`)
  }

  if (!drift.length) return { drift, exempted: false }

  if (allowDrift) {
    console.warn(`[${label}] ⚠️ 显式豁免环境漂移（报告须记 drift_reason）：`)
    for (const d of drift) console.warn(`  - ${d}`)
    return { drift, exempted: true }
  }

  console.error(`[${label}] ❌ 环境漂移 ${drift.length} 项：`)
  for (const d of drift) console.error(`  - ${d}`)
  console.error(`[${label}] 请先对齐基线；确需放行请显式传 --allow-drift 并记录 drift_reason。`)
  return { drift, exempted: false }
}

/** 人类可读的一行摘要（用于报告头）。 */
export function formatBaseline(baseline) {
  const parts = [
    `image=${baseline.backend_image ?? 'n/a'}`,
    `started=${baseline.backend_started_at ?? 'n/a'}`,
    `sdk=${baseline.sdk_pin.commit ?? 'n/a'}`,
    `apk=${baseline.apk_mtime ?? 'n/a'}`
  ]
  return parts.join(' | ')
}

/** 直接运行时打印当前基线（`node scripts/lib/live-env.mjs`）。 */
const invokedDirectly =
  process.argv[1] && path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url))
if (invokedDirectly) {
  const baseline = captureBaseline()
  console.log(formatBaseline(baseline))
  console.log(JSON.stringify(baseline, null, 2))
}
