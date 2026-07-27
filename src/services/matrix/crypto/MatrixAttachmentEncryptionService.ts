export interface EncryptedAttachmentFile {
  url: string
  key: {
    alg: string
    key_ops: string[]
    kty: string
    k: string
    ext: boolean
  }
  iv: string
  hashes: Record<string, string>
  v: string
}

interface EncryptedAttachmentPayload {
  encryptedData: Blob
  encryptedFile: Omit<EncryptedAttachmentFile, 'url'>
}

class MatrixAttachmentEncryptionService {
  private ensureCrypto(): Crypto {
    if (!globalThis.crypto?.subtle) {
      throw new Error('当前环境不支持 Web Crypto')
    }

    return globalThis.crypto
  }

  private encodeUnpaddedBase64(input: ArrayBuffer | Uint8Array): string {
    const bytes = input instanceof Uint8Array ? input : new Uint8Array(input)
    let binary = ''
    const chunkSize = 0x8000

    for (let index = 0; index < bytes.length; index += chunkSize) {
      binary += String.fromCharCode(...bytes.subarray(index, index + chunkSize))
    }

    return btoa(binary).replace(/=+$/g, '')
  }

  private createInitialCounterBlock(cryptoApi: Crypto): Uint8Array<ArrayBuffer> {
    const counter = new Uint8Array(new ArrayBuffer(16))
    cryptoApi.getRandomValues(counter.subarray(0, 8))
    counter.fill(0, 8)
    return counter
  }

  async encryptAttachment(source: Blob): Promise<EncryptedAttachmentPayload> {
    const cryptoApi = this.ensureCrypto()
    const plaintext = await source.arrayBuffer()
    const counter = this.createInitialCounterBlock(cryptoApi)
    const cryptoKey = await cryptoApi.subtle.generateKey({ name: 'AES-CTR', length: 256 }, true, ['encrypt', 'decrypt'])
    const jwk = await cryptoApi.subtle.exportKey('jwk', cryptoKey)
    const ciphertext = await cryptoApi.subtle.encrypt(
      {
        name: 'AES-CTR',
        counter,
        length: 64
      },
      cryptoKey,
      plaintext
    )
    const digest = await cryptoApi.subtle.digest('SHA-256', ciphertext)

    return {
      encryptedData: new Blob([ciphertext], { type: 'application/octet-stream' }),
      encryptedFile: {
        key: {
          alg: typeof jwk.alg === 'string' ? jwk.alg : 'A256CTR',
          key_ops: Array.isArray(jwk.key_ops) ? [...jwk.key_ops] : ['encrypt', 'decrypt'],
          kty: typeof jwk.kty === 'string' ? jwk.kty : 'oct',
          k: typeof jwk.k === 'string' ? jwk.k : '',
          ext: typeof jwk.ext === 'boolean' ? jwk.ext : true
        },
        iv: this.encodeUnpaddedBase64(counter),
        hashes: {
          sha256: this.encodeUnpaddedBase64(digest)
        },
        v: 'v2'
      }
    }
  }
}

export const matrixAttachmentEncryptionService = new MatrixAttachmentEncryptionService()
