import { resolveMatrixRuntimeEndpointConfig } from '@/services/backend'
import { UploadSceneEnum } from '@/enums'
import { info, error } from '@tauri-apps/plugin-log'

export interface OssTokenResponse {
  uploadUrl: string
  downloadUrl: string
  objectKey?: string // 添加 objectKey 属性
  accessKeyId?: string
  accessKeySecret?: string
  securityToken?: string
  bucket?: string
  region?: string
}

export interface UploadProviderResponse {
  provider: 'default' | 'minio'
}

/**
 * 上传服务
 * 处理文件上传相关的功能
 */
class UploadService {
  private baseUrl: string = ''

  constructor() {
    const { homeserverUrl } = resolveMatrixRuntimeEndpointConfig()
    this.baseUrl = homeserverUrl
  }

  /**
   * 获取 OSS 上传令牌
   * @param params 参数
   * @returns OSS 令牌信息
   */
  async getOssToken(params: { scene?: UploadSceneEnum; fileName: string }): Promise<OssTokenResponse> {
    try {
      const response = await fetch(`${this.baseUrl}/_matrix/client/v3/upload/token`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(params)
      })

      if (!response.ok) {
        throw new Error(`获取上传令牌失败: ${response.statusText}`)
      }

      const data = await response.json()
      info('[Upload] 获取上传令牌成功')
      return data
    } catch (err) {
      error(`[Upload] 获取上传令牌失败: ${err}`)
      throw err
    }
  }

  /**
   * 获取上传提供商
   * @returns 上传提供商信息
   */
  async getUploadProvider(): Promise<UploadProviderResponse> {
    try {
      const response = await fetch(`${this.baseUrl}/_matrix/client/v3/upload/provider`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json'
        }
      })

      if (!response.ok) {
        throw new Error(`获取上传提供商失败: ${response.statusText}`)
      }

      const data = await response.json()
      info('[Upload] 获取上传提供商成功')
      return data
    } catch (err) {
      error(`[Upload] 获取上传提供商失败: ${err}`)
      // 返回默认值
      return { provider: 'default' }
    }
  }
}

export const uploadService = new UploadService()
export default uploadService
