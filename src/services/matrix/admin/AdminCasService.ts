/**
 * CAS 单点登录服务管理（Admin）
 *
 * 对应 synapse-rust 的 CAS 服务管理端点，全部复用 SDK `CasManager`（R1：不另建 HTTP 调用）。
 * CAS 协议面（`/_synapse/cas/**`）不在本服务范围内，这里只覆盖管理面。
 *
 * 路由清单：
 *   GET    /_synapse/admin/v1/cas/services                    服务列表
 *   POST   /_synapse/admin/v1/cas/services                    注册服务
 *   DELETE /_synapse/admin/v1/cas/services/{id}               删除服务
 *   GET    /_synapse/admin/v1/cas/users/{id}/attributes       用户属性列表
 *   POST   /_synapse/admin/v1/cas/users/{id}/attributes       写入单个用户属性
 *
 * 注意：用户属性写接口一次只接受一个属性（`attribute_name` + `attribute_value`），
 * 后端不存在批量端点，页面需逐条提交。
 */
import type { CasManager } from '@/services/matrix/sdk'
import { createLogger } from '@/utils/Logger'
import { BaseMatrixService } from '../BaseMatrixService'

const logger = createLogger('AdminCas')

/** CAS 服务列表响应。 */
export type CasServiceListResponse = Awaited<ReturnType<CasManager['listServices']>>

/** 单个 CAS 服务。 */
export type CasServiceInfo = CasServiceListResponse['services'][number]

/** 注册 CAS 服务的请求体。 */
export type CasServiceCreateRequest = Parameters<CasManager['createService']>[0]

/** 注册 CAS 服务的响应。 */
export type CasServiceCreateResponse = Awaited<ReturnType<CasManager['createService']>>

/** 删除 CAS 服务的响应。 */
export type CasServiceDeleteResponse = Awaited<ReturnType<CasManager['deleteService']>>

/** CAS 用户属性。 */
export type CasUserAttribute = Awaited<ReturnType<CasManager['getUserAttributes']>>[number]

/** 写入单个用户属性的请求体。 */
export type CasSetAttributeRequest = Parameters<CasManager['setUserAttribute']>[1]

/** 写入单个用户属性的响应。 */
type CasSetAttributeResponse = Awaited<ReturnType<CasManager['setUserAttribute']>>

/** CAS 服务与用户属性管理。 */
export class AdminCasService extends BaseMatrixService {
  private getManager() {
    return this.getClient().getCasManager()
  }

  /** 读取 CAS 服务列表。 */
  async listServices(): Promise<CasServiceListResponse> {
    try {
      return await this.getManager().listServices()
    } catch (err) {
      logger.error(`[AdminCas] listServices 失败: ${err}`)
      throw err
    }
  }

  /** 注册 CAS 服务。 */
  async createService(data: CasServiceCreateRequest): Promise<CasServiceCreateResponse> {
    try {
      return await this.getManager().createService(data)
    } catch (err) {
      logger.error(`[AdminCas] createService 失败: ${err}`)
      throw err
    }
  }

  /** 删除 CAS 服务。 */
  async deleteService(serviceId: string): Promise<CasServiceDeleteResponse> {
    try {
      return await this.getManager().deleteService(serviceId)
    } catch (err) {
      logger.error(`[AdminCas] deleteService 失败: ${err}`)
      throw err
    }
  }

  /** 读取用户属性列表。 */
  async getUserAttributes(userId: string): Promise<CasUserAttribute[]> {
    try {
      return await this.getManager().getUserAttributes(userId)
    } catch (err) {
      logger.error(`[AdminCas] getUserAttributes 失败: ${err}`)
      throw err
    }
  }

  /** 写入单个用户属性。 */
  async setUserAttribute(userId: string, body: CasSetAttributeRequest): Promise<CasSetAttributeResponse> {
    try {
      return await this.getManager().setUserAttribute(userId, body)
    } catch (err) {
      logger.error(`[AdminCas] setUserAttribute 失败: ${err}`)
      throw err
    }
  }
}

export const adminCasService = new AdminCasService()
