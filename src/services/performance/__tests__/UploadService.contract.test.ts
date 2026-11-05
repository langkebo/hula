import { beforeEach, describe, expect, it, vi } from 'vitest'

/**
 * `upload/token` 契约守护（FE-1）。
 *
 * 背景：该端点的响应是「后端 snake_case + 方法语义」与「前端 camelCase 凭证模型」
 * 之间唯一的一次映射。历史上两边各改各的（后端只给 `upload_url`、前端只认
 * `uploadUrl`），结果 `uploadUrl` 恒 undefined、所有附件发送失败，而单元测试因为
 * 没有真实响应样本，一直是绿的。
 *
 * 因此这里把**实测响应**原样固化为夹具，并锁住归一结果的每个字段。
 * 夹具来源：synapse-rust `6.3.0-7914e4630`（2026-11-05），
 * `POST /_matrix/client/v3/upload/token` 实际返回。
 */

vi.mock('@/services/backend', () => ({
  resolveMatrixRuntimeEndpointConfig: () => ({ homeserverUrl: 'https://matrix.test' })
}))

vi.mock('@/services/matrix/matrixClientAccessor', () => ({
  getMatrixAccessToken: vi.fn(() => 'tok-123')
}))

vi.mock('@/utils/HttpClient', async () => {
  const actual = await vi.importActual<typeof import('@/utils/HttpClient')>('@/utils/HttpClient')
  return {
    ...actual,
    HttpClient: {
      post: vi.fn(),
      get: vi.fn()
    }
  }
})

import { getMatrixAccessToken } from '@/services/matrix/matrixClientAccessor'
import { HttpClient, HttpClientError } from '@/utils/HttpClient'
import { uploadService } from '../UploadService'

/** 实测样本：matrix 通道（后端声明为 POST + download_url_prefix，无 download_url） */
const MATRIX_TOKEN_FIXTURE = {
  content_type: 'image/png',
  download_url_prefix: '/_matrix/client/v1/media/download/matrix.test/',
  filename: 'a.png',
  max_file_size: 52428800,
  storage_type: 'matrix',
  upload_method: 'POST',
  upload_url: '/_matrix/media/v3/upload'
}

/** 假想的预签名实现（用于锁住「不要把所有凭证都当 matrix」这条分支） */
const PRESIGNED_TOKEN_FIXTURE = {
  provider: 'minio',
  uploadUrl: 'https://oss.example.com/bucket/key?signature=abc',
  downloadUrl: 'https://cdn.example.com/bucket/key',
  objectKey: 'bucket/key'
}

describe('UploadService.getOssToken — 响应字段映射契约', () => {
  const post = HttpClient.post as unknown as ReturnType<typeof vi.fn>
  const getAccessToken = getMatrixAccessToken as unknown as ReturnType<typeof vi.fn>

  beforeEach(() => {
    post.mockReset()
    getAccessToken.mockReturnValue('tok-123')
  })

  it('把实测 snake_case 响应归一成 camelCase 凭证', async () => {
    post.mockResolvedValue(MATRIX_TOKEN_FIXTURE)

    const credential = await uploadService.getOssToken({ filename: 'a.png' })

    expect(credential).not.toBeNull()
    expect(credential?.provider).toBe('matrix')
    // matrix 通道没有可 PUT 的地址，uploadUrl 必须为空（否则调用方会去 PUT 一个 POST 端点）
    expect(credential?.uploadUrl).toBe('')
    expect(credential?.storageType).toBe('matrix')
    expect(credential?.maxFileSize).toBe(52428800)
    expect(credential?.downloadUrlPrefix).toBe('/_matrix/client/v1/media/download/matrix.test/')
  })

  it('upload_method=POST 时即使 storage_type 缺失也判为 matrix 通道', async () => {
    const withoutStorageType = { ...MATRIX_TOKEN_FIXTURE, storage_type: undefined }
    post.mockResolvedValue(withoutStorageType)

    const credential = await uploadService.getOssToken({ filename: 'a.png' })

    expect(credential?.provider).toBe('matrix')
    expect(credential?.uploadUrl).toBe('')
  })

  it('预签名实现仍走 oss 通道并保留 uploadUrl', async () => {
    post.mockResolvedValue(PRESIGNED_TOKEN_FIXTURE)

    const credential = await uploadService.getOssToken({ filename: 'a.png' })

    expect(credential?.provider).toBe('oss')
    expect(credential?.uploadUrl).toBe(PRESIGNED_TOKEN_FIXTURE.uploadUrl)
    expect(credential?.downloadUrl).toBe(PRESIGNED_TOKEN_FIXTURE.downloadUrl)
  })

  it('请求必须带 Bearer 鉴权（回归：曾用裸 HttpClient 调用，恒 401）', async () => {
    post.mockResolvedValue(MATRIX_TOKEN_FIXTURE)

    await uploadService.getOssToken({ filename: 'a.png', scene: 'chat' as never })

    const [, body, config] = post.mock.calls[0]
    expect(body).toMatchObject({ filename: 'a.png' })
    expect(config?.headers?.Authorization).toBe('Bearer tok-123')
  })

  it('无 access token 时不发请求，直接返回 null 交由调用方降级', async () => {
    getAccessToken.mockReturnValue(null)

    const credential = await uploadService.getOssToken({ filename: 'a.png' })

    expect(credential).toBeNull()
    expect(post).not.toHaveBeenCalled()
  })

  it('端点 404（旧后端）时返回 null，不抛错', async () => {
    post.mockRejectedValue(new HttpClientError('not found', 404, 'Not Found', ''))

    await expect(uploadService.getOssToken({ filename: 'a.png' })).resolves.toBeNull()
  })
})

describe('UploadService.getUploadProvider — 枚举归一', () => {
  const get = HttpClient.get as unknown as ReturnType<typeof vi.fn>

  beforeEach(() => {
    get.mockReset()
  })

  it('后端 provider=matrix 归一到 default（前端枚举只有 default|minio）', async () => {
    get.mockResolvedValue({ provider: 'matrix', max_file_size: 52428800 })

    await expect(uploadService.getUploadProvider()).resolves.toEqual({ provider: 'default' })
  })

  it('provider=minio 原样保留', async () => {
    get.mockResolvedValue({ provider: 'minio' })

    await expect(uploadService.getUploadProvider()).resolves.toEqual({ provider: 'minio' })
  })
})
