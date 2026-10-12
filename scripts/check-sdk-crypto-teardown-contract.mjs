#!/usr/bin/env node
/**
 * Guard — 钉住「Tjg 的 crypto 生命周期代码所依赖的 SDK 语义」。
 *
 * 为什么需要它：`MatrixClientLifecycle.forceReconnect()` 复用同一个 client 重启 sync，
 * 而我们的兜底（`MatrixCryptoStateTracker.releaseStoppedCryptoBinding`）**整套逻辑成立与否
 * 完全取决于 fork SDK 的 4 条具体行为**。SDK 一旦升级/回退改了其中任一条，我们的兜底会
 * 从"必要"变成"有害"或从"有效"变成"无效"，而这**不会**有任何编译错误 —— 只会表现为
 * 系统唤醒后 E2EE 静默失效、或 OlmMachine 泄漏。
 *
 * 实测基准：`matrix-js-sdk@40.2.0-langkebo.6`（Tjg 经 `vendor/matrix-js-sdk.tgz` 消费）。
 * 断言对象是**已安装**的包（`node_modules/matrix-js-sdk/...`），因为门禁要检查的是
 * 真正被构建进去的那份代码；缺依赖 ⇒ EXIT=2（不当作通过）。
 *
 * Usage:
 *   node scripts/check-sdk-crypto-teardown-contract.mjs
 *   node scripts/check-sdk-crypto-teardown-contract.mjs --json
 *
 * Exit codes:
 *   0  契约成立
 *   1  契约被打破（任一断言不成立）
 *   2  环境异常（node_modules/matrix-js-sdk 未安装 / 读不到文件）
 */

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const projectRoot = path.resolve(__dirname, '..')

export const SDK_DIR = path.join(projectRoot, 'node_modules', 'matrix-js-sdk')

/**
 * 每条断言 = 一次「契约」：SDK 的行为必须仍是这样，我们的兜底才成立。
 * `pattern` 命中 ⇒ 成立；`forbidden` **未**命中 ⇒ 成立。
 */
export const CONTRACT_REQUIREMENTS = [
  {
    id: 'stopClient-stops-crypto',
    file: 'lib/client-lifecycle-stop.js',
    pattern: /cryptoBackend\.stop\(\)/,
    why: 'client.stopClient() 必须仍会停止 crypto（否则"停即释放"的前提不成立）'
  },
  {
    id: 'rust-crypto-stop-closes-olm-machine',
    file: 'lib/rust-crypto/rust-crypto.js',
    pattern: /stop\(\)\s*\{[\s\S]{0,900}?olmMachine\.close\(\)/,
    why: 'RustCrypto.stop() 必须关闭 OlmMachine（IndexedDB 连接随之关闭，交接/释放靠它）'
  },
  {
    id: 'rust-crypto-has-stopped-flag',
    file: 'lib/rust-crypto/rust-crypto.js',
    pattern: /"stopped",\s*false/,
    why: '需要可判定的 stopped 标志：releaseStoppedCryptoBinding 据此确认"确已停止"才解绑'
  },
  {
    id: 'initRustCrypto-refuses-reinit',
    file: 'lib/client.js',
    pattern: /cryptoBackend[^;]{0,80}?Attempt to re-initialise e2e encryption/,
    why: 'initRustCrypto() 见 cryptoBackend 非空即 warn+return —— 这就是必须先解绑的原因'
  },
  {
    id: 'getCrypto-returns-backend-only',
    file: 'lib/client.js',
    pattern: /getCrypto\(\)\s*\{[\s\S]{0,160}?return this\.cryptoBackend/,
    why: 'getCrypto() 只返回 cryptoBackend ⇒ 停止后仍真值，ensureCrypto 会误判"已可用"而早退'
  },
  {
    id: 'lifecycle-start-does-not-init-crypto',
    file: 'lib/client-lifecycle-start.js',
    forbidden: /initRustCrypto/,
    why: 'start 侧不会替调用方恢复 crypto ⇒ 重启路径必须自己 ensureCrypto（不能指望 SDK）'
  }
]

/**
 * 纯函数判据 —— 无 I/O。
 *
 * @param {Record<string, string>} sources 相对 SDK 根的文件路径 → 全文
 * @returns {{ ok: boolean, violations: Array<object>, checked: number }}
 */
export function evaluateSdkCryptoTeardownContract(sources = {}) {
  const violations = []
  let checked = 0

  for (const requirement of CONTRACT_REQUIREMENTS) {
    const content = sources[requirement.file]
    if (typeof content !== 'string') {
      violations.push({ id: requirement.id, file: requirement.file, reason: 'missing-file', why: requirement.why })
      continue
    }
    checked++

    if (requirement.forbidden) {
      if (requirement.forbidden.test(content)) {
        violations.push({ id: requirement.id, file: requirement.file, reason: 'forbidden-pattern-present', why: requirement.why })
      }
      continue
    }

    if (!requirement.pattern.test(content)) {
      violations.push({ id: requirement.id, file: requirement.file, reason: 'pattern-not-found', why: requirement.why })
    }
  }

  return { ok: violations.length === 0, violations, checked }
}

function loadSources() {
  const sources = {}
  for (const requirement of CONTRACT_REQUIREMENTS) {
    const full = path.join(SDK_DIR, requirement.file)
    sources[requirement.file] = fs.existsSync(full) ? fs.readFileSync(full, 'utf8') : undefined
  }
  return sources
}

async function main() {
  const jsonOutput = process.argv.includes('--json')

  if (!fs.existsSync(SDK_DIR)) {
    console.error(`[sdk-crypto-teardown] scan failed: 未安装 matrix-js-sdk（${SDK_DIR}）—— 请先 pnpm install`)
    process.exit(2)
  }

  let version = 'unknown'
  try {
    version = JSON.parse(fs.readFileSync(path.join(SDK_DIR, 'package.json'), 'utf8')).version
  } catch {
    console.error('[sdk-crypto-teardown] scan failed: 读不到 matrix-js-sdk/package.json')
    process.exit(2)
  }

  const result = { ...evaluateSdkCryptoTeardownContract(loadSources()), version }

  if (jsonOutput) {
    process.stdout.write(`${JSON.stringify(result, null, 2)}\n`)
  } else if (result.ok) {
    console.log(
      `[sdk-crypto-teardown] OK — ${result.checked}/${CONTRACT_REQUIREMENTS.length} 条契约成立（matrix-js-sdk@${version}）`
    )
  } else {
    console.error(`[sdk-crypto-teardown] FAIL — SDK crypto 生命周期契约被打破（matrix-js-sdk@${version}）:`)
    for (const v of result.violations) {
      console.error(`  ${v.id}  ${v.file}  (${v.reason})`)
      console.error(`    为什么重要：${v.why}`)
    }
    console.error('  修法：核对 SDK 新版行为后，同步调整 Tjg 的 crypto 生命周期代码与本案断言（不要只改断言）。')
  }

  process.exit(result.ok ? 0 : 1)
}

const isDirectRun = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)

if (isDirectRun) {
  main().catch((err) => {
    console.error('[sdk-crypto-teardown] unexpected error', err)
    process.exit(2)
  })
}
