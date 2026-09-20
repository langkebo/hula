import { describe, expect, it, vi } from 'vitest'

const logSpy = vi.hoisted(() => ({
  info: vi.fn(),
  error: vi.fn(),
  warn: vi.fn(),
  debug: vi.fn(),
  trace: vi.fn(),
  child: vi.fn(() => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn() }))
}))

vi.mock('@/utils/Logger', () => ({
  createLogger: () => logSpy
}))

import { buildSsssAccountData } from '../ssssKeyDescription'

/**
 * 规范回归：新建的 SSSS 密钥描述必须来自 SDK 生成结果，而不是手写。
 *
 * 历史缺陷（F-07）：uploadSsssKeyDirectly 丢弃 SDK 给出的 `keyInfo`，
 * 自己手写 algorithm/IV/MAC——algorithm 写成 `m.vodozemac.v1`、IV 用 12 字节、
 * MAC 直接对 IV 签名。SDK 的 addKey/checkKey 对未知 algorithm 抛
 * `Unknown algorithm`，本端创建的 SSSS 密钥无法被任何客户端校验。
 */

/** 模拟 SDK createRecoveryKeyFromPassphrase 的返回（keyInfo 由 SDK 计算） */
function makeGeneratedKey() {
  return {
    keyInfo: {
      algorithm: 'm.secret_storage.v1.aes-hmac-sha2',
      iv: 'AAAAAAAAAAAAAAAAAAAAAA',
      mac: 'BBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB'
    },
    encodedPrivateKey: 'EsT...recovery-key',
    privateKey: crypto.getRandomValues(new Uint8Array(32))
  }
}

describe('buildSsssAccountData', () => {
  it('原样采用 SDK 生成的 keyInfo（不重新计算 algorithm/iv/mac）', () => {
    const generated = makeGeneratedKey()

    const accountData = buildSsssAccountData(generated)

    expect(accountData.keyDescription.algorithm).toBe('m.secret_storage.v1.aes-hmac-sha2')
    expect(accountData.keyDescription.iv).toBe(generated.keyInfo.iv)
    expect(accountData.keyDescription.mac).toBe(generated.keyInfo.mac)
  })

  it('不再产生 m.vodozemac.v1 这种非规范算法名', () => {
    const accountData = buildSsssAccountData(makeGeneratedKey())

    expect(accountData.keyDescription.algorithm).not.toContain('vodozemac')
  })

  it('携带 SDK 的编码私钥用于展示给用户', () => {
    const generated = makeGeneratedKey()

    const accountData = buildSsssAccountData(generated)

    expect(accountData.encodedPrivateKey).toBe(generated.encodedPrivateKey)
  })
})
