import { describe, expect, it, vi } from 'vitest'

vi.mock('@/utils/Logger', () => ({
  createLogger: () => ({ error: vi.fn(), warn: vi.fn(), info: vi.fn(), debug: vi.fn() })
}))

import { buildSsssKeyDescription } from '../ssssKeyDescription'

/**
 * 规范回归：SSSS 密钥描述必须按 m.secret_storage.v1.aes-hmac-sha2 规范计算。
 *
 * 历史缺陷（两轮）：
 *  1. 手写 `m.vodozemac.v1` + 12 字节 IV + HMAC(iv)，SDK addKey/checkKey 抛 Unknown algorithm。
 *  2. 改为"采用 SDK 的 keyInfo.algorithm/iv/mac"，但 SDK 的 `GeneratedSecretStorageKey.keyInfo`
 *     只含 `{ passphrase?, name? }`——根本没有 algorithm/iv/mac。于是守卫必然抛错，
 *     `uploadSsssKeyDirectly`（阶段 A）每次都失败并被 catch 吞掉，SSSS 密钥从未真正上传。
 *
 * 正确做法：由原始私钥本地计算 iv 与 mac。规范（client-server API
 * #msecret_storagev1aes-hmac-sha2 步骤 1-4）：
 *  - HKDF-SHA256(key, salt=8 字节 0, info=name) → 64 字节；前 32 = AES-CTR key，后 32 = HMAC key
 *  - iv = 16 随机字节（bit 63 清零）
 *  - mac = HMAC-SHA256( AES-CTR-encrypt(32 个 0 字节, iv) )
 */

/**
 * 独立参照实现：按规范从零写一遍，作为被测实现的对照。
 *
 * 刻意不复用 `src/` 下任何代码，也不 import SDK 内部路径（exports map 不导出），
 * 这样两边同时写错同一处的概率很低。
 */
async function specDerive(
  key: Uint8Array<ArrayBuffer>,
  name: string
): Promise<{ aesKey: CryptoKey; hmacKey: CryptoKey }> {
  const hkdfKey = await crypto.subtle.importKey('raw', key, { name: 'HKDF' }, false, ['deriveBits'])
  const bits = await crypto.subtle.deriveBits(
    {
      name: 'HKDF',
      salt: new Uint8Array(8),
      info: new TextEncoder().encode(name),
      hash: 'SHA-256'
    },
    hkdfKey,
    512
  )
  const aesKey = await crypto.subtle.importKey('raw', bits.slice(0, 32), { name: 'AES-CTR' }, false, ['encrypt'])
  const hmacKey = await crypto.subtle.importKey('raw', bits.slice(32), { name: 'HMAC', hash: 'SHA-256' }, false, [
    'sign'
  ])
  return { aesKey, hmacKey }
}

async function specMac(key: Uint8Array<ArrayBuffer>, ivB64: string, name: string): Promise<string> {
  const { aesKey, hmacKey } = await specDerive(key, name)
  const iv = Uint8Array.from(atob(ivB64), (c) => c.charCodeAt(0))
  const ciphertext = await crypto.subtle.encrypt(
    { name: 'AES-CTR', counter: iv, length: 64 },
    aesKey,
    new Uint8Array(32)
  )
  const mac = await crypto.subtle.sign({ name: 'HMAC' }, hmacKey, ciphertext)
  return btoa(String.fromCharCode(...new Uint8Array(mac)))
}

const KEY_NAME = 'TJG Security Key'

describe('buildSsssKeyDescription（规范计算）', () => {
  it('algorithm 为规范的 m.secret_storage.v1.aes-hmac-sha2', async () => {
    const description = await buildSsssKeyDescription(crypto.getRandomValues(new Uint8Array(32)))
    expect(description.algorithm).toBe('m.secret_storage.v1.aes-hmac-sha2')
  })

  it('IV 为 16 字节且最高位已按规范清零', async () => {
    const description = await buildSsssKeyDescription(crypto.getRandomValues(new Uint8Array(32)))
    const iv = Uint8Array.from(atob(description.iv), (c) => c.charCodeAt(0))

    expect(iv.length).toBe(16)
    // bit 63 清零：第 8 字节最高位为 0
    expect(iv[8] & 0x80).toBe(0)
  })

  it('mac 与独立按规范算出的 mac 一致（同一 IV）', async () => {
    const key = crypto.getRandomValues(new Uint8Array(32))
    const description = await buildSsssKeyDescription(key)

    const expected = await specMac(key, description.iv, KEY_NAME)

    expect(description.mac).toBe(expected)
  })

  it('不同调用产生不同 IV', async () => {
    const key = crypto.getRandomValues(new Uint8Array(32))
    const a = await buildSsssKeyDescription(key)
    const b = await buildSsssKeyDescription(key)
    expect(a.iv).not.toBe(b.iv)
  })

  it('保留 passphrase 信息（若 SDK 提供了）', async () => {
    const key = crypto.getRandomValues(new Uint8Array(32))
    const passphrase = { algorithm: 'm.pbkdf2', iterations: 500000, salt: 'salt', bits: 256 }
    const description = await buildSsssKeyDescription(key, { name: KEY_NAME, passphrase })
    expect(description.passphrase).toEqual(passphrase)
  })
})
