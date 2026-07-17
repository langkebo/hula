import { describe, expect, it } from 'vitest'
import { matrixAttachmentDecryptionService } from '../MatrixAttachmentDecryptionService'
import { matrixAttachmentEncryptionService } from '../MatrixAttachmentEncryptionService'

const encryptForTest = async (plaintext: Uint8Array) => {
  const { encryptedData, encryptedFile } = await matrixAttachmentEncryptionService.encryptAttachment(
    new Blob([plaintext as Uint8Array<ArrayBuffer>])
  )
  return {
    ciphertext: new Uint8Array(await encryptedData.arrayBuffer()),
    fileLike: { ...encryptedFile, url: 'mxc://hs.test/attachment' }
  }
}

describe('MatrixAttachmentDecryptionService', () => {
  it('加密→解密往返恢复原始字节', async () => {
    const plaintext = new TextEncoder().encode('端到端附件加解密往返')
    const { ciphertext, fileLike } = await encryptForTest(plaintext)

    const decrypted = await matrixAttachmentDecryptionService.decryptAttachment(ciphertext, fileLike)

    expect(Array.from(decrypted)).toEqual(Array.from(plaintext))
  })

  it('空附件往返得到空字节', async () => {
    const { ciphertext, fileLike } = await encryptForTest(new Uint8Array(0))

    const decrypted = await matrixAttachmentDecryptionService.decryptAttachment(ciphertext, fileLike)

    expect(decrypted.length).toBe(0)
  })

  it('密文被篡改时抛出校验失败', async () => {
    const { ciphertext, fileLike } = await encryptForTest(new TextEncoder().encode('tamper me'))
    ciphertext[0] = ciphertext[0] ^ 0xff

    await expect(matrixAttachmentDecryptionService.decryptAttachment(ciphertext, fileLike)).rejects.toThrow(
      '加密附件校验失败'
    )
  })

  it('哈希字段被篡改时抛出校验失败', async () => {
    const { ciphertext, fileLike } = await encryptForTest(new TextEncoder().encode('hash mismatch'))
    fileLike.hashes = { sha256: 'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA' }

    await expect(matrixAttachmentDecryptionService.decryptAttachment(ciphertext, fileLike)).rejects.toThrow(
      '加密附件校验失败'
    )
  })

  describe('parseEncryptedFile 字段校验', () => {
    const validFile = {
      url: 'mxc://hs.test/file',
      iv: 'AAECAwQFBgc',
      v: 'v2',
      key: { k: 'c2VjcmV0LWtleQ' },
      hashes: { sha256: 'ZGlnZXN0' }
    }

    const omit = (field: keyof typeof validFile) => {
      const copy: Record<string, unknown> = { ...validFile }
      delete copy[field]
      return copy
    }

    it('缺少 url 时报错', () => {
      expect(() => matrixAttachmentDecryptionService.parseEncryptedFile(omit('url'))).toThrow('缺少加密附件 URL')
    })

    it('缺少 iv 时报错', () => {
      expect(() => matrixAttachmentDecryptionService.parseEncryptedFile(omit('iv'))).toThrow('缺少加密附件 IV')
    })

    it('缺少版本信息时报错', () => {
      expect(() => matrixAttachmentDecryptionService.parseEncryptedFile(omit('v'))).toThrow('缺少加密附件版本信息')
    })

    it('缺少密钥时报错', () => {
      expect(() => matrixAttachmentDecryptionService.parseEncryptedFile({ ...validFile, key: {} })).toThrow(
        '缺少加密附件密钥'
      )
    })

    it('缺少哈希时报错', () => {
      expect(() => matrixAttachmentDecryptionService.parseEncryptedFile({ ...validFile, hashes: {} })).toThrow(
        '缺少加密附件哈希'
      )
    })

    it('缺省字段回填默认值（alg/kty/ext/key_ops）', () => {
      const parsed = matrixAttachmentDecryptionService.parseEncryptedFile(validFile)

      expect(parsed.key.alg).toBe('A256CTR')
      expect(parsed.key.kty).toBe('oct')
      expect(parsed.key.ext).toBe(true)
      expect(parsed.key.key_ops).toEqual(['decrypt'])
    })
  })
})
