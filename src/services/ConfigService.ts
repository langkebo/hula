import { resolveMatrixEndpointConfig } from '@/services/backend'
import { info, error } from '@tauri-apps/plugin-log'

export interface IceServerConfig {
  urls: string[]
  username?: string
  credential?: string
}

export interface AppConfig {
  iceServer?: IceServerConfig
  [key: string]: any
}

/**
 * 配置服务
 * 处理应用配置的获取
 */
class ConfigService {
  private baseUrl: string = ''
  private configCache: AppConfig | null = null

  constructor() {
    const { homeserverUrl } = resolveMatrixEndpointConfig()
    this.baseUrl = homeserverUrl
  }

  /**
   * 初始化配置（获取应用配置）
   * @returns 应用配置
   */
  async initConfig(): Promise<AppConfig> {
    // 如果有缓存，直接返回
    if (this.configCache) {
      return this.configCache
    }

    try {
      const response = await fetch(`${this.baseUrl}/_matrix/client/v3/config`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json'
        }
      })

      if (!response.ok) {
        throw new Error(`获取配置失败: ${response.statusText}`)
      }

      const data = await response.json()
      this.configCache = data
      info('[Config] 获取应用配置成功')
      return data
    } catch (err) {
      error(`[Config] 获取应用配置失败: ${err}`)
      // 返回空配置
      return {}
    }
  }

  /**
   * 清除配置缓存
   */
  clearCache(): void {
    this.configCache = null
  }

  /**
   * 获取 ICE 服务器配置
   * @returns ICE 服务器配置
   */
  async getIceServerConfig(): Promise<IceServerConfig | null> {
    const config = await this.initConfig()
    return config.iceServer || null
  }
}

export const configService = new ConfigService()
export default configService
