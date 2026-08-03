import { createLogger } from '@/utils/Logger'
import { BaseMatrixService } from './BaseMatrixService'

const logger = createLogger('MatrixApplicationService')

interface ApplicationServiceNamespace {
  exclusive: boolean
  pattern: string
}

interface ApplicationServiceRegistration {
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

interface RegisteredApplicationService {
  id: string
  url: string
}

class MatrixApplicationService extends BaseMatrixService {
  async register(payload: ApplicationServiceRegistration): Promise<boolean> {
    try {
      await (
        this.getClient().getAdminManager().server as unknown as {
          registerAppService: (payload: Record<string, unknown>) => Promise<unknown>
        }
      ).registerAppService(payload as unknown as Record<string, unknown>)
      return true
    } catch (err) {
      logger.error(`[MatrixApplicationService] 注册失败: ${err}`)
      return false
    }
  }

  async list(): Promise<RegisteredApplicationService[]> {
    try {
      const response = await (
        this.getClient().getAdminManager().server as unknown as {
          listAppServices: () => Promise<{ services?: unknown[] }>
        }
      ).listAppServices()
      return Array.isArray(response.services) ? (response.services as RegisteredApplicationService[]) : []
    } catch (err) {
      logger.error(`[MatrixApplicationService] 获取列表失败: ${err}`)
      return []
    }
  }

  async setEnabled(id: string, enabled: boolean): Promise<boolean> {
    try {
      await (
        this.getClient().getAdminManager().server as unknown as {
          setAppServiceEnabled: (id: string, enabled: boolean) => Promise<unknown>
        }
      ).setAppServiceEnabled(id, enabled)
      return true
    } catch (err) {
      logger.error(`[MatrixApplicationService] 设置启用状态失败: ${err}`)
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
      const response = (await (
        this.getClient().getAdminManager().server as unknown as {
          getAppService: (id: string) => Promise<unknown>
        }
      ).getAppService(id)) as {
        namespaces?: {
          users?: unknown
          rooms?: unknown
        }
      }
      const value = response.namespaces?.[key]
      return Array.isArray(value) ? (value as ApplicationServiceNamespace[]) : []
    } catch (err) {
      logger.error(`[MatrixApplicationService] 获取 namespace 失败: ${err}`)
      return []
    }
  }
}

const _matrixApplicationService = new MatrixApplicationService()
