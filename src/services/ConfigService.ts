import { invoke } from '@tauri-apps/api/core'
import { error, info } from '@tauri-apps/plugin-log'
import { resolveMatrixRuntimeEndpointConfig } from '@/services/backend'

export interface IceServerConfig {
  urls: string[]
  username?: string
  credential?: string
}

export interface AppConfig {
  iceServer?: IceServerConfig
  default_hs_url?: string
  default_is_url?: string
  default_server_name?: string
  default_server_config?: Record<string, unknown>
  brand?: string
  [key: string]: unknown
}

/**
 * 配置服务
 * 处理应用配置的获取
 */
class ConfigService {
  private configCache: AppConfig | null = null
  baseUrl: string

  constructor() {
    const { homeserverUrl } = resolveMatrixRuntimeEndpointConfig()
    this.baseUrl = homeserverUrl
  }

  /**
   * 从 Tauri 后端加载分层配置（base + local 合并）
   * @returns 应用配置
   */
  async loadConfig(): Promise<AppConfig> {
    try {
      const config = await invoke<AppConfig>('get_config')
      this.configCache = config
      info('[Config] 从 Tauri 后端加载配置成功')
      return config
    } catch (err) {
      error(`[Config] 从 Tauri 后端加载配置失败: ${err}`)
      this.configCache = {}
      return {}
    }
  }

  /**
   * 初始化配置（获取应用配置）
   * @returns 应用配置
   */
  async initConfig(): Promise<AppConfig> {
    if (this.configCache) {
      return this.configCache
    }

    return this.loadConfig()
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

  /**
   * 获取默认主服务器 URL
   */
  get defaultHsUrl(): string {
    return (
      (this.configCache?.default_hs_url as string | undefined) ??
      ((this.configCache?.default_server_config as Record<string, unknown> | undefined)?.m_server as string) ??
      'https://matrix.org'
    )
  }

  /**
   * 获取默认 Identity Server URL
   */
  get defaultIsUrl(): string {
    return this.configCache?.default_is_url ?? 'https://vector.im'
  }
}

export const configService = new ConfigService()
export default configService
