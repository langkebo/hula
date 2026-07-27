import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import matrixAttachmentDecryptionService, {
  type MatrixEncryptedAttachmentLike
} from '@/services/matrix/crypto/MatrixAttachmentDecryptionService'

describe('MatrixAttachmentDecryptionService.decryptBatch — 并行解密 (§9.4.4)', () => {
  let decryptSpy: ReturnType<typeof vi.spyOn>

  beforeEach(() => {
    decryptSpy = vi.spyOn(matrixAttachmentDecryptionService, 'decryptAttachment')
  })

  afterEach(() => {
    decryptSpy.mockRestore()
  })

  function makeItem(index: number) {
    return {
      source: new ArrayBuffer(8),
      fileLike: {
        url: `mxc://server/${index}`,
        iv: 'iv',
        v: 'v2',
        key: { k: 'k', kty: 'oct', key_ops: ['decrypt'], alg: 'A256CTR', ext: true },
        hashes: { sha256: 'hash' }
      }
    }
  }

  it('空数组返回空结果', async () => {
    const results = await matrixAttachmentDecryptionService.decryptBatch([])
    expect(results).toEqual([])
    expect(decryptSpy).not.toHaveBeenCalled()
  })

  it('单个项目正常解密', async () => {
    const plaintext = new Uint8Array([1, 2, 3])
    decryptSpy.mockResolvedValue(plaintext)
    const results = await matrixAttachmentDecryptionService.decryptBatch([makeItem(0)])
    expect(results).toHaveLength(1)
    expect(results[0].ok).toBe(true)
    expect(results[0].data).toBe(plaintext)
  })

  it('多个项目全部成功，结果顺序与输入一致', async () => {
    decryptSpy.mockImplementation(
      async (_source: ArrayBuffer | Uint8Array, fileLike: MatrixEncryptedAttachmentLike) => {
        const url = (fileLike as { url: string }).url
        const idx = Number(url.split('/').pop())
        return new Uint8Array([idx])
      }
    )
    const items = [makeItem(0), makeItem(1), makeItem(2), makeItem(3)]
    const results = await matrixAttachmentDecryptionService.decryptBatch(items)
    expect(results).toHaveLength(4)
    expect(results.map((r) => (r.data as Uint8Array)[0])).toEqual([0, 1, 2, 3])
    expect(results.every((r) => r.ok)).toBe(true)
  })

  it('单个项目失败不影响其他项目', async () => {
    decryptSpy.mockImplementation(
      async (_source: ArrayBuffer | Uint8Array, fileLike: MatrixEncryptedAttachmentLike) => {
        const url = (fileLike as { url: string }).url
        const idx = Number(url.split('/').pop())
        if (idx === 1) throw new Error('解密失败')
        return new Uint8Array([idx])
      }
    )
    const items = [makeItem(0), makeItem(1), makeItem(2)]
    const results = await matrixAttachmentDecryptionService.decryptBatch(items)
    expect(results).toHaveLength(3)
    expect(results[0].ok).toBe(true)
    expect(results[1].ok).toBe(false)
    expect(results[1].error).toBeInstanceOf(Error)
    expect(results[2].ok).toBe(true)
  })

  it('并发数默认为 4', async () => {
    let activeCount = 0
    let maxActive = 0
    decryptSpy.mockImplementation(async () => {
      activeCount++
      maxActive = Math.max(maxActive, activeCount)
      await new Promise((r) => setTimeout(r, 10))
      activeCount--
      return new Uint8Array([0])
    })
    const items = Array.from({ length: 10 }, (_, i) => makeItem(i))
    await matrixAttachmentDecryptionService.decryptBatch(items)
    expect(maxActive).toBeLessThanOrEqual(4)
  })

  it('可自定义并发数', async () => {
    let activeCount = 0
    let maxActive = 0
    decryptSpy.mockImplementation(async () => {
      activeCount++
      maxActive = Math.max(maxActive, activeCount)
      await new Promise((r) => setTimeout(r, 10))
      activeCount--
      return new Uint8Array([0])
    })
    const items = Array.from({ length: 6 }, (_, i) => makeItem(i))
    await matrixAttachmentDecryptionService.decryptBatch(items, 2)
    expect(maxActive).toBeLessThanOrEqual(2)
  })

  it('结果包含 index 字段对应输入位置', async () => {
    decryptSpy.mockResolvedValue(new Uint8Array([0]))
    const items = [makeItem(0), makeItem(1), makeItem(2)]
    const results = await matrixAttachmentDecryptionService.decryptBatch(items)
    expect(results.map((r) => r.index)).toEqual([0, 1, 2])
  })

  it('全部失败时返回全部 ok=false', async () => {
    decryptSpy.mockRejectedValue(new Error('全部失败'))
    const items = [makeItem(0), makeItem(1)]
    const results = await matrixAttachmentDecryptionService.decryptBatch(items)
    expect(results.every((r) => r.ok === false)).toBe(true)
    expect(results.every((r) => r.error instanceof Error)).toBe(true)
  })
})
