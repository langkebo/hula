/**
 * 分片上传返回夹具。
 *
 * `UploadResult` 未在 `ChunkUploadService` 导出，类型从 `chunkUploadService.upload()`
 * 的返回签名推导（`mxcUrl / filename / size / mimeType` 四键必填）。
 */
import type { chunkUploadService } from '@/services/performance/ChunkUploadService'

export type ChunkUploadResultFixture = Awaited<ReturnType<typeof chunkUploadService.upload>>

export function makeChunkUploadResult(overrides: Partial<ChunkUploadResultFixture> = {}): ChunkUploadResultFixture {
  return {
    mxcUrl: 'mxc://hs/chunked',
    filename: 'big.bin',
    size: 8,
    mimeType: 'application/octet-stream',
    ...overrides
  }
}
