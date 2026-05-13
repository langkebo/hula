import { error } from '@tauri-apps/plugin-log'
import { BaseMatrixService } from './BaseMatrixService'
import { MATRIX_PATHS } from './paths'

export interface ApplicationServiceNamespace {
  exclusive: boolean
  pattern: string
}

export interface ApplicationServiceRegistration {
  id?: string
  url: string
  as_token: string
  sender: string
  namespaces?: {
    users?: ApplicationServiceNamespace[]
    rooms?: ApplicationServiceNamespace[]
    aliases?: ApplicationServiceNamespace[]
  }
}

export interface RegisteredApplicationService {
  id: string
  url: string
}

class MatrixApplicationService extends BaseMatrixService {
  async register(payload: ApplicationServiceRegistration): Promise<boolean> {
    try {
      await this.getClient().http.authedRequest('POST', MATRIX_PATHS.ADMIN.APPSERVICES, undefined, payload)
      return true
    } catch (err) {
      error(`[MatrixApplicationService] 注册失败: ${err}`)
      return false
    }
  }

  async list(): Promise<RegisteredApplicationService[]> {
    try {
      const response = (await this.getClient().http.authedRequest('GET', MATRIX_PATHS.ADMIN.APPSERVICES)) as {
        services?: unknown
      }
      return Array.isArray(response.services) ? (response.services as RegisteredApplicationService[]) : []
    } catch (err) {
      error(`[MatrixApplicationService] 获取列表失败: ${err}`)
      return []
    }
  }

  async setEnabled(id: string, enabled: boolean): Promise<boolean> {
    try {
      await this.getClient().http.authedRequest('PUT', MATRIX_PATHS.ADMIN.APPSERVICE_BY_ID(id), undefined, {
        enabled
      })
      return true
    } catch (err) {
      error(`[MatrixApplicationService] 设置启用状态失败: ${err}`)
      return false
    }
  }

  async getUsersNamespace(id: string): Promise<ApplicationServiceNamespace[]> {
    return this.getNamespace(id, 'users')
  }

  async getRoomsNamespace(id: string): Promise<ApplicationServiceNamespace[]> {
    return this.getNamespace(id, 'rooms')
  }

  private async getNamespace(id: string, key: 'users' | 'rooms'): Promise<ApplicationServiceNamespace[]> {
    try {
      const response = (await this.getClient().http.authedRequest('GET', MATRIX_PATHS.ADMIN.APPSERVICE_BY_ID(id))) as {
        namespaces?: {
          users?: unknown
          rooms?: unknown
        }
      }
      const value = response.namespaces?.[key]
      return Array.isArray(value) ? (value as ApplicationServiceNamespace[]) : []
    } catch (err) {
      error(`[MatrixApplicationService] 获取 namespace 失败: ${err}`)
      return []
    }
  }
}

export const matrixApplicationService = new MatrixApplicationService()
export default matrixApplicationService
