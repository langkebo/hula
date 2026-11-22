import { DEFAULT_PAGE_LIMIT } from '@/common/constants'
import type { AdminManager, SamlMapping, SamlMetadata } from '@/services/matrix/sdk'
import { createLogger } from '@/utils/Logger'

const logger = createLogger('SecuritySaml')

type SecuritySamlSdkGetter = () => Promise<AdminManager>

/**
 * `GET /_synapse/admin/v1/saml/config` 的响应。
 *
 * 服务端字段为 snake_case，同时兼容历史 camelCase 别名（`idpEntityId` 等）。
 * 配置键集合随 homeserver 版本扩展，因此保留索引签名承载未建模字段。
 */
export interface SamlConfigResponse {
  enabled?: boolean
  saml_enabled?: boolean
  entity_id?: string
  idp_entity_id?: string
  idpEntityId?: string
  idp_url?: string
  idpUrl?: string
  sso_url?: string
  sp_entity_id?: string
  sp_url?: string
  spUrl?: string
  acs_url?: string
  metadata_url?: string
  /** 服务端新增的配置键（如签名/加密开关），不做穷举建模。 */
  [key: string]: unknown
}

/**
 * SAML IdP 元数据，`getSamlMetadata` 与 `refreshIdpMetadata` 共用。
 *
 * 元数据由 IdP 动态下发（含 XML 与 X.509 证书），字段集合不固定。
 */
export interface SamlMetadataResponse {
  entity_id?: string
  entityId?: string
  sso_url?: string
  ssoUrl?: string
  slo_url?: string
  nameid_format?: string
  x509_certificates?: string[]
  xml?: string
  /** IdP 元数据中的其它扩展字段。 */
  [key: string]: unknown
}

/**
 * `AdminSecurityService` 的 SAML 方法片段。
 *
 * 从 `SecurityService.ts` 抽离：SAML / IdP 相关操作独立成域，
 * 以避免安全服务文件随端点增加持续膨胀。子类提供 SDK 管理器 getter。
 */
export abstract class AdminSamlMethods {
  protected abstract readonly sdkAdmin: SecuritySamlSdkGetter

  /** 读取 SAML 配置；失败时返回空对象。 */
  async getSamlConfig(): Promise<SamlConfigResponse> {
    try {
      const admin = await this.sdkAdmin()
      return (await admin.getSamlConfig()) ?? {}
    } catch (err) {
      logger.error(`[MatrixAdmin] 获取 SAML 配置失败: ${err}`)
      return {}
    }
  }

  /** 读取 IdP 元数据；失败时返回空对象。 */
  async getSamlMetadata(): Promise<SamlMetadataResponse> {
    try {
      const admin = await this.sdkAdmin()
      return (await admin.getSamlMetadata()) ?? {}
    } catch (err) {
      logger.error(`[MatrixAdmin] 获取 SAML 元数据失败: ${err}`)
      return {}
    }
  }

  /** 读取本端 SP 元数据（XML 文本或 Blob）；失败时返回 null。 */
  async getSpMetadata(): Promise<Blob | string | null> {
    try {
      const admin = await this.sdkAdmin()
      return (await admin.getSpMetadata()) ?? null
    } catch (err) {
      logger.error(`[MatrixAdmin] 获取 SP 元数据失败: ${err}`)
      return null
    }
  }

  /** 更新 SAML 配置；失败时向上抛错。 */
  async updateSamlConfig(config: Partial<SamlMetadata>): Promise<void> {
    try {
      const admin = await this.sdkAdmin()
      await admin.updateSamlConfig(config)
      logger.info('[MatrixAdmin] 更新 SAML 配置成功')
    } catch (err) {
      logger.error(`[MatrixAdmin] 更新 SAML 配置失败: ${err}`)
      throw err
    }
  }

  /** 让服务端重新拉取 IdP 元数据；失败时向上抛错。 */
  async refreshIdpMetadata(): Promise<SamlMetadataResponse> {
    try {
      const admin = await this.sdkAdmin()
      const metadata = await admin.refreshIdpMetadata()
      logger.info('[MatrixAdmin] 刷新 SAML IdP 元数据成功')
      return metadata ?? {}
    } catch (err) {
      logger.error(`[MatrixAdmin] 刷新 SAML IdP 元数据失败: ${err}`)
      throw err
    }
  }

  async getSamlMappings(
    limit = DEFAULT_PAGE_LIMIT,
    from?: string
  ): Promise<{
    mappings: SamlMapping[]
    nextToken?: string | undefined
  }> {
    try {
      const admin = await this.sdkAdmin()
      const result = await admin.listSamlMappings({ limit, ...(from !== undefined ? { from } : {}) })
      return {
        mappings: result?.mappings ?? [],
        nextToken: result?.next_token
      }
    } catch (err) {
      logger.error(`[Admin] 获取SAML映射失败: ${err}`)
      return { mappings: [] }
    }
  }

  /** 读取单条 SAML 映射；失败时返回 null。 */
  async getSamlMapping(nameId: string): Promise<SamlMapping | null> {
    try {
      const admin = await this.sdkAdmin()
      return (await admin.getSamlMapping(nameId)) ?? null
    } catch (err) {
      logger.error(`[Admin] 获取SAML映射详情失败: ${err}`)
      return null
    }
  }

  /** 更新单条 SAML 映射；失败时向上抛错。 */
  async updateSamlMapping(nameId: string, updates: Partial<SamlMapping>): Promise<void> {
    try {
      const admin = await this.sdkAdmin()
      await admin.updateSamlMapping(nameId, updates)
      logger.info(`[Admin] 更新SAML映射: ${nameId}`)
    } catch (err) {
      logger.error(`[Admin] 更新SAML映射失败: ${err}`)
      throw err
    }
  }

  /** 删除单条 SAML 映射；失败时向上抛错。 */
  async deleteSamlMapping(nameId: string): Promise<void> {
    try {
      const admin = await this.sdkAdmin()
      await admin.deleteSamlMapping(nameId)
      logger.info(`[Admin] 删除SAML映射: ${nameId}`)
    } catch (err) {
      logger.error(`[Admin] 删除SAML映射失败: ${err}`)
      throw err
    }
  }

  /** 强制指定用户走 SAML 登出；失败时向上抛错。 */
  async samlLogout(userId: string): Promise<void> {
    try {
      const admin = await this.sdkAdmin()
      await admin.samlLogout(userId)
      logger.info(`[Admin] SAML登出: ${userId}`)
    } catch (err) {
      logger.error(`[Admin] SAML登出失败: ${err}`)
      throw err
    }
  }
}
