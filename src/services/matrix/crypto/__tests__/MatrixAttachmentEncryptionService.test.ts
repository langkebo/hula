import { describe, expect, it } from 'vitest'
import { matrixAttachmentEncryptionService } from '../MatrixAttachmentEncryptionService'

const UNPADDED_BASE64 = /^[A-Za-z0-9+/]+$/

describe('MatrixAttachmentEncryptionService', () => {
  it('输出 Matrix v2 加密附件元数据契约（alg/kty/v/iv/hashes）', async () => {
    const source = new Blob([new Uint8Array([1, 2, 3, 4, 5])])

    const { encryptedFile } = await matrixAttachmentEncryptionService.encryptAttachment(source)

    expect(encryptedFile.v).toBe('v2')
    expect(encryptedFile.key.alg).toBe('A256CTR')
    expect(encryptedFile.key.kty).toBe('oct')
    expect(encryptedFile.key.ext).toBe(true)
    expect(encryptedFile.key.k).toMatch(/^[A-Za-z0-9_-]+$/)
    expect(encryptedFile.iv).toMatch(UNPADDED_BASE64)
    expect(encryptedFile.iv).not.toContain('=')
    expect(encryptedFile.hashes.sha256).toMatch(UNPADDED_BASE64)
    expect(encryptedFile.hashes.sha256).not.toContain('=')
  })

  it('IV 为 16 字节计数器块且后 8 字节为零（AES-CTR 规范要求）', async () => {
    const { encryptedFile } = await matrixAttachmentEncryptionService.encryptAttachment(new Blob(['payload']))

    const padded = encryptedFile.iv.padEnd(Math.ceil(encryptedFile.iv.length / 4) * 4, '=')
    const counter = Uint8Array.from(atob(padded), (char) => char.charCodeAt(0))

    expect(counter.length).toBe(16)
    expect(Array.from(counter.subarray(8))).toEqual([0, 0, 0, 0, 0, 0, 0, 0])
  })

  it('密文与明文不同且 sha256 哈希与密文匹配', async () => {
    const plaintext = new TextEncoder().encode('hula attachment secret')

    const { encryptedData, encryptedFile } = await matrixAttachmentEncryptionService.encryptAttachment(
      new Blob([plaintext])
    )
    const ciphertext = new Uint8Array(await encryptedData.arrayBuffer())

    expect(ciphertext.length).toBe(plaintext.length)
    expect(Array.from(ciphertext)).not.toEqual(Array.from(plaintext))

    const digest = new Uint8Array(await globalThis.crypto.subtle.digest('SHA-256', ciphertext))
    const digestBase64 = btoa(String.fromCharCode(...digest)).replace(/=+$/g, '')
    expect(encryptedFile.hashes.sha256).toBe(digestBase64)
  })

  it('每次加密使用随机密钥与 IV（同一明文产生不同密文）', async () => {
    const source = new Blob(['same plaintext'])

    const first = await matrixAttachmentEncryptionService.encryptAttachment(source)
    const second = await matrixAttachmentEncryptionService.encryptAttachment(source)

    expect(first.encryptedFile.key.k).not.toBe(second.encryptedFile.key.k)
    expect(first.encryptedFile.iv).not.toBe(second.encryptedFile.iv)
  })
})
