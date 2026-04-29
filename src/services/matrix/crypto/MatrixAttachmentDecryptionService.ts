import type { EncryptedAttachmentFile } from './MatrixAttachmentEncryptionService'

export type MatrixEncryptedAttachmentLike = EncryptedAttachmentFile | Record<string, unknown>

class MatrixAttachmentDecryptionService {
  private ensureCrypto(): Crypto {
    if (!globalThis.crypto?.subtle) {
      throw new Error('当前环境不支持 Web Crypto')
    }

    return globalThis.crypto
  }

  private decodeUnpaddedBase64(input: string): Uint8Array<ArrayBuffer> {
    const normalized = input.padEnd(Math.ceil(input.length / 4) * 4, '=')
    const binary = atob(normalized)
    const bytes = new Uint8Array(new ArrayBuffer(binary.length))

    for (let index = 0; index < binary.length; index += 1) {
      bytes[index] = binary.charCodeAt(index)
    }

    return bytes
  }

  private toArrayBuffer(source: ArrayBuffer | Uint8Array): ArrayBuffer {
    if (source instanceof ArrayBuffer) {
      return source.slice(0)
    }

    const bytes = new Uint8Array(new ArrayBuffer(source.byteLength))
    bytes.set(source)
    return bytes.buffer
  }

  private assertValidHash(actual: Uint8Array, expectedBase64: string) {
    const expected = this.decodeUnpaddedBase64(expectedBase64)
    if (expected.length !== actual.length) {
      throw new Error('加密附件校验失败')
    }

    for (let index = 0; index < expected.length; index += 1) {
      if (expected[index] !== actual[index]) {
        throw new Error('加密附件校验失败')
      }
    }
  }

  parseEncryptedFile(fileLike: MatrixEncryptedAttachmentLike): EncryptedAttachmentFile {
    const source = fileLike as Record<string, unknown>
    const key = (source.key ?? {}) as Record<string, unknown>
    const hashes = (source.hashes ?? {}) as Record<string, unknown>
    const keyOps = Array.isArray(key.key_ops)
      ? key.key_ops.filter((item): item is string => typeof item === 'string')
      : []

    if (typeof source.url !== 'string' || !source.url) {
      throw new Error('缺少加密附件 URL')
    }
    if (typeof source.iv !== 'string' || !source.iv) {
      throw new Error('缺少加密附件 IV')
    }
    if (typeof source.v !== 'string' || !source.v) {
      throw new Error('缺少加密附件版本信息')
    }
    if (typeof key.k !== 'string' || !key.k) {
      throw new Error('缺少加密附件密钥')
    }
    if (typeof hashes.sha256 !== 'string' || !hashes.sha256) {
      throw new Error('缺少加密附件哈希')
    }

    return {
      url: source.url,
      key: {
        alg: typeof key.alg === 'string' ? key.alg : 'A256CTR',
        key_ops: keyOps.length > 0 ? keyOps : ['decrypt'],
        kty: typeof key.kty === 'string' ? key.kty : 'oct',
        k: key.k,
        ext: typeof key.ext === 'boolean' ? key.ext : true
      },
      iv: source.iv,
      hashes: {
        sha256: hashes.sha256
      },
      v: source.v
    }
  }

  async decryptAttachment(
    source: ArrayBuffer | Uint8Array,
    fileLike: MatrixEncryptedAttachmentLike
  ): Promise<Uint8Array> {
    const cryptoApi = this.ensureCrypto()
    const encryptedFile = this.parseEncryptedFile(fileLike)
    const ciphertextBuffer = this.toArrayBuffer(source)
    const digest = new Uint8Array(await cryptoApi.subtle.digest('SHA-256', ciphertextBuffer))
    this.assertValidHash(digest, encryptedFile.hashes.sha256)

    const counter = this.decodeUnpaddedBase64(encryptedFile.iv)
    const cryptoKey = await cryptoApi.subtle.importKey(
      'jwk',
      {
        kty: encryptedFile.key.kty,
        key_ops: encryptedFile.key.key_ops,
        alg: encryptedFile.key.alg,
        ext: encryptedFile.key.ext,
        k: encryptedFile.key.k
      },
      { name: 'AES-CTR', length: 256 },
      false,
      ['decrypt']
    )

    const plaintext = await cryptoApi.subtle.decrypt(
      {
        name: 'AES-CTR',
        counter,
        length: 64
      },
      cryptoKey,
      ciphertextBuffer
    )

    return new Uint8Array(plaintext)
  }
}

export const matrixAttachmentDecryptionService = new MatrixAttachmentDecryptionService()
export default matrixAttachmentDecryptionService
