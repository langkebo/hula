import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  CONTRACT_REQUIREMENTS,
  evaluateSdkCryptoTeardownContract,
  SDK_DIR
} from '../../scripts/check-sdk-crypto-teardown-contract.mjs'

/**
 * 门禁单测：SDK crypto 生命周期契约哨兵。
 *
 * 重要性：`MatrixClientLifecycle.forceReconnect` 复用 client 重启这条路，
 * 其正确性完全依赖 6 条 SDK 具体行为；SDK 变了不会有编译错误，只会静默毁掉 E2EE。
 */

/** 依据真实 SDK 片段构造一份"契约成立"的合成源码 */
function conformingSources(): Record<string, string> {
  return {
    'lib/client-lifecycle-stop.js': [
      'export function stopClientLifecycleServices(client) {',
      '  client.cryptoBackend?.stop();',
      '  client.syncApi?.stop();',
      '}'
    ].join('\n'),
    'lib/rust-crypto/rust-crypto.js': [
      'class RustCrypto {',
      '  constructor() { _defineProperty(this, "stopped", false); }',
      '  stop() {',
      '    if (this.stopped) { return; }',
      '    this.stopped = true;',
      '    this.olmMachine.close();',
      '  }',
      '}'
    ].join('\n'),
    'lib/client.js': [
      'class MatrixClient {',
      '  async initRustCrypto() {',
      '    if (this.cryptoBackend) {',
      '      this.logger.warn("Attempt to re-initialise e2e encryption on MatrixClient");',
      '      return;',
      '    }',
      '  }',
      '  getCrypto() {',
      '    return this.cryptoBackend;',
      '  }',
      '}'
    ].join('\n'),
    'lib/client-lifecycle-start.js': 'export function startClientLifecycleServices(client) { client.startClient(); }'
  }
}

describe('check-sdk-crypto-teardown-contract: evaluateSdkCryptoTeardownContract', () => {
  it('全部契约成立 ⇒ ok', () => {
    const result = evaluateSdkCryptoTeardownContract(conformingSources())

    expect(result.ok).toBe(true)
    expect(result.violations).toEqual([])
    expect(result.checked).toBe(CONTRACT_REQUIREMENTS.length)
  })

  it('stopClient 不再停 crypto ⇒ 判红（我们的"停即释放"前提失效）', () => {
    const sources = conformingSources()
    sources['lib/client-lifecycle-stop.js'] =
      'export function stopClientLifecycleServices(client) { client.syncApi?.stop(); }'

    const result = evaluateSdkCryptoTeardownContract(sources)

    expect(result.ok).toBe(false)
    expect(result.violations.map((v) => v.id)).toContain('stopClient-stops-crypto')
  })

  it('RustCrypto.stop() 不再关闭 OlmMachine ⇒ 判红（IndexedDB 连接不会释放）', () => {
    const sources = conformingSources()
    sources['lib/rust-crypto/rust-crypto.js'] = 'class RustCrypto { stop() { this.stopped = true; } }'

    const result = evaluateSdkCryptoTeardownContract(sources)

    expect(result.ok).toBe(false)
    expect(result.violations.map((v) => v.id)).toContain('rust-crypto-stop-closes-olm-machine')
  })

  it('取消 initRustCrypto 的重复初始化守卫 ⇒ 判红（解绑兜底的必要性变了）', () => {
    const sources = conformingSources()
    sources['lib/client.js'] = [
      'async initRustCrypto() { this.cryptoBackend = await RustCrypto.initRustCrypto({}); }',
      'getCrypto() { return this.cryptoBackend; }'
    ].join('\n')

    const result = evaluateSdkCryptoTeardownContract(sources)

    expect(result.ok).toBe(false)
    expect(result.violations.map((v) => v.id)).toContain('initRustCrypto-refuses-reinit')
  })

  it('start 侧开始自行初始化 crypto ⇒ 判红（我们的重启路径假设变了）', () => {
    const sources = conformingSources()
    sources['lib/client-lifecycle-start.js'] =
      'export function startClientLifecycleServices(client) { client.initRustCrypto(); }'

    const result = evaluateSdkCryptoTeardownContract(sources)

    expect(result.ok).toBe(false)
    expect(result.violations.map((v) => v.id)).toContain('lifecycle-start-does-not-init-crypto')
  })

  it('文件缺失 ⇒ 判红且标为 missing-file（不得静默通过）', () => {
    const sources = conformingSources()
    delete sources['lib/client.js']

    const result = evaluateSdkCryptoTeardownContract(sources)

    expect(result.ok).toBe(false)
    expect(result.violations[0]).toMatchObject({ file: 'lib/client.js', reason: 'missing-file' })
  })

  it('空输入 ⇒ 全部判 missing-file（调用方据此做基数断言）', () => {
    const result = evaluateSdkCryptoTeardownContract({})
    expect(result.ok).toBe(false)
    expect(result.checked).toBe(0)
    expect(result.violations).toHaveLength(CONTRACT_REQUIREMENTS.length)
  })
})

describe('check-sdk-crypto-teardown-contract: 真实依赖自洽', () => {
  it('已安装的 matrix-js-sdk 满足全部契约（fork 40.2.0-langkebo.x）', () => {
    if (!existsSync(SDK_DIR)) {
      // 依赖未安装时不做断言（门禁脚本自身会以 EXIT=2 报"环境异常"）
      expect(existsSync(SDK_DIR)).toBe(false)
      return
    }

    const sources: Record<string, string> = {}
    for (const requirement of CONTRACT_REQUIREMENTS) {
      sources[requirement.file] = readFileSync(join(SDK_DIR, requirement.file), 'utf8')
    }

    const result = evaluateSdkCryptoTeardownContract(sources)

    expect(result.violations).toEqual([])
    expect(result.ok).toBe(true)
    expect(result.checked).toBe(CONTRACT_REQUIREMENTS.length)
  })
})
