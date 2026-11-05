import type { UploadSceneEnum } from '@/enums'
import { resolveMatrixRuntimeEndpointConfig } from '@/services/backend'
import { getMatrixAccessToken } from '@/services/matrix/matrixClientAccessor'
import { PREFIX_V3 } from '@/services/matrix/paths'
import { HttpClient, HttpClientError } from '@/utils/HttpClient'
import { createLogger } from '@/utils/Logger'

const logger = createLogger('UploadService')

/** 上传通道类型：`matrix` = 服务端未提供预签名地址，必须走 Matrix 原生上传 */
export type UploadProviderKind = 'matrix' | 'oss'

/**
 * 后端 `POST {v3}/upload/token` 的**原始**响应（snake_case）。
 *
 * 契约来源：`synapse-web/src/routes/media/upload.rs::create_upload_token`，实测返回
 * `{upload_token, storage_type, upload_url, filename, content_type, max_file_size}`。
 * 注意：这里**没有** `download_url`，`upload_url` 是媒体上传的 POST 端点
 * 这个 **POST** 端点，不是可直接 PUT 的预签名地址。
 */
interface RawUploadTokenResponse {
  upload_token?: string
  storage_type?: string
  upload_url?: string
  filename?: string
  content_type?: string
  max_file_size?: number
  // 兼容可能存在的 OSS/MinIO 预签名实现（保留旧字段直读能力）
  uploadUrl?: string
  downloadUrl?: string
  objectKey?: string
  accessKeyId?: string
  accessKeySecret?: string
  securityToken?: string
  bucket?: string
  region?: string
}

/**
 * 归一化后的上传凭证。
 *
 * `provider === 'matrix'` 时 `uploadUrl` 为空，调用方**不得**再做 PUT，
 * 必须改用 Matrix 原生上传（`matrixMediaService.uploadFile`）。
 */
export interface UploadCredential {
  provider: UploadProviderKind
  /** 预签名 PUT 地址；`matrix` 通道下恒为空串 */
  uploadUrl: string
  /** 可直接访问的下载地址；`matrix` 通道下由原生上传后回填 */
  downloadUrl: string
  objectKey?: string
  storageType?: string
  maxFileSize?: number
}

interface UploadProviderResponse {
  provider: 'default' | 'minio'
}

/** 预签名地址判定：绝对 http(s) 且不是 Matrix 媒体端点 */
function looksLikePresignedUrl(url: string): boolean {
  if (!/^https?:\/\//i.test(url)) return false
  return !url.includes('/_matrix/')
}

/**
 * 上传服务
 * 处理文件上传相关的功能
 */
class UploadService {
  /**
   * baseUrl **不再在构造期快照**。
   *
   * 历史缺陷：早期实现把 `resolveMatrixRuntimeEndpointConfig().homeserverUrl` 在
   * `constructor()` 里取一次。模块若在登录前（首屏/登录页）被加载，homeserver
   * 尚未配置 ⇒ baseUrl 为空串 ⇒ 之后所有请求变成相对路径并永久 404，且不会自愈。
   * 现在按需解析：homeserver 变化（登录/切换服务器）后自动跟随。
   */
  private get baseUrl(): string {
    return resolveMatrixRuntimeEndpointConfig().homeserverUrl
  }

  /**
   * 上传凭证请求必须带鉴权（本模块曾用裸 `HttpClient` 直接打 endpoint，
   * 而 `HttpClient` 不注入任何 header ⇒ 恒 401 `M_UNAUTHORIZED`）。
   */
  private authHeaders(): Record<string, string> {
    const token = getMatrixAccessToken()
    return token ? { Authorization: `Bearer ${token}` } : {}
  }

  /**
   * 获取上传凭证。
   *
   * @returns 归一化凭证；端点不可用（404）/未登录/失败时返回 `null`，由调用方降级
   */
  async getOssToken(params: {
    scene?: UploadSceneEnum
    filename: string
    content_type?: string
  }): Promise<UploadCredential | null> {
    const baseUrl = this.baseUrl
    if (!baseUrl) {
      logger.warn('[Upload] homeserver 未配置，跳过上传凭证获取')
      return null
    }
    const headers = this.authHeaders()
    if (!headers.Authorization) {
      logger.warn('[Upload] 无 access token，跳过上传凭证获取（将由调用方走 Matrix 原生上传）')
      return null
    }

    try {
      const raw = await HttpClient.post<RawUploadTokenResponse>(`${baseUrl}${PREFIX_V3}/upload/token`, params, {
        // baseUrl 来自 env 配置的 homeserver（动态 host）
        allowDynamicHost: true,
        headers,
        timeoutMs: 15_000
      })
      return this.normalizeCredential(raw)
    } catch (err) {
      if (err instanceof HttpClientError && err.status === 404) {
        // upload/token 端点不可用（旧后端），调用方走 Matrix 原生上传
        logger.info('[Upload] upload/token 端点不可用(404)，将使用默认上传方式')
        return null
      }
      logger.error(`[Upload] 获取上传凭证失败: ${err}`)
      return null
    }
  }

  /**
   * 把后端 snake_case 响应归一成前端模型。
   *
   * 关键映射（此前 7 个字段全部对不上，`uploadUrl`/`downloadUrl` 恒 undefined）：
   * - `upload_url` → `uploadUrl`
   * - `storage_type` → `storageType`，`matrix` 表示无预签名地址
   * - 无 `download_url` 时留空，由原生上传完成后回填
   */
  private normalizeCredential(raw: RawUploadTokenResponse): UploadCredential {
    const camelUploadUrl = raw.uploadUrl ?? ''
    const snakeUploadUrl = raw.upload_url ?? ''
    const uploadUrl = camelUploadUrl || snakeUploadUrl
    const storageType = (raw.storage_type ?? (raw.upload_token ? 'matrix' : 'oss')).toLowerCase()
    // 后端给的 upload_url 是媒体上传的 POST 端点，不是 PUT 目标 ⇒ 一律按原生通道处理
    const provider: UploadProviderKind =
      storageType === 'matrix' || !looksLikePresignedUrl(uploadUrl) ? 'matrix' : 'oss'

    return {
      provider,
      uploadUrl: provider === 'oss' ? uploadUrl : '',
      downloadUrl: raw.downloadUrl ?? '',
      ...(raw.objectKey ? { objectKey: raw.objectKey } : {}),
      storageType,
      ...(typeof raw.max_file_size === 'number' ? { maxFileSize: raw.max_file_size } : {})
    }
  }

  /**
   * 获取上传提供商
   *
   * 后端返回 `provider: "matrix"`，前端枚举只有 `default | minio` ⇒ 这里显式归一，
   * 避免把后端字符串漏进 `'default' | 'minio'` 的联合类型。
   */
  async getUploadProvider(): Promise<UploadProviderResponse> {
    const baseUrl = this.baseUrl
    if (!baseUrl) return { provider: 'default' }
    try {
      const data = await HttpClient.get<{ provider?: string }>(`${baseUrl}${PREFIX_V3}/upload/provider`, {
        allowDynamicHost: true,
        headers: this.authHeaders(),
        timeoutMs: 10_000
      })
      logger.info('[Upload] 获取上传提供商成功')
      return { provider: data?.provider === 'minio' ? 'minio' : 'default' }
    } catch (err) {
      logger.error(`[Upload] 获取上传提供商失败: ${err}`)
      // 返回默认值
      return { provider: 'default' }
    }
  }
}

export const uploadService = new UploadService()
