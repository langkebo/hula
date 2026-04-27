/**
 * 脱水设备服务 (MSC2987)
 * 允许在不使用密钥的情况下创建和恢复设备
 */
import { matrixClientService } from '../MatrixClientService'
import { createLogger } from '@/utils/Logger'

const logger = createLogger('DehydratedDevice')

export interface DehydratedDevice {
  deviceId: string
  userId: string
  initialDeviceDisplayName?: string
  deviceData?: Record<string, unknown>
  createdAt: number
  expiresAt?: number
}

export interface CreateDehydratedDeviceParams {
  initialDeviceDisplayName?: string
  deviceData?: Record<string, unknown>
}

export interface ClaimDehydratedDeviceParams {
  deviceId: string
  accessToken: string
}

class MatrixDehydratedDeviceService {
  private get client() {
    const client = matrixClientService.getClient()
    if (!client) {
      throw new Error('Matrix client not initialized')
    }
    return client
  }

  /**
   * 创建脱水设备
   * 使用 /_matrix/client/v1/dehydrated_device 创建新设备
   */
  async createDevice(params: CreateDehydratedDeviceParams): Promise<DehydratedDevice | null> {
    const { initialDeviceDisplayName, deviceData } = params

    try {
      const response = (await this.client.http.authedRequest(
        {},
        'POST',
        '/_matrix/client/v1/dehydrated_device',
        undefined,
        {
          body: JSON.stringify({
            device_data: deviceData || {},
            initial_device_display_name: initialDeviceDisplayName
          })
        }
      )) as { device_id: string; device_data?: Record<string, unknown>; expires_at?: number }

      return {
        deviceId: response.device_id,
        userId: this.client.getUserId() || '',
        initialDeviceDisplayName,
        deviceData: response.device_data,
        createdAt: Date.now(),
        expiresAt: response.expires_at
      }
    } catch (error) {
      logger.error('创建失败:', error)
      return null
    }
  }

  /**
   * 获取脱水设备信息
   */
  async getDevice(deviceId: string): Promise<DehydratedDevice | null> {
    try {
      const response = (await this.client.http.authedRequest(
        {},
        'GET',
        `/_matrix/client/v1/dehydrated_device/${deviceId}`,
        undefined
      )) as {
        device_id: string
        initial_device_display_name?: string
        device_data?: Record<string, unknown>
        created_at: number
        expires_at?: number
      }

      return {
        deviceId: response.device_id,
        userId: this.client.getUserId() || '',
        initialDeviceDisplayName: response.initial_device_display_name,
        deviceData: response.device_data,
        createdAt: response.created_at,
        expiresAt: response.expires_at
      }
    } catch (error) {
      logger.error('获取设备失败:', error)
      return null
    }
  }

  /**
   * 获取用户所有脱水设备
   */
  async getDevices(): Promise<DehydratedDevice[]> {
    try {
      const response = (await this.client.http.authedRequest(
        {},
        'GET',
        '/_matrix/client/v1/dehydrated_device',
        undefined
      )) as {
        devices: Array<{
          device_id: string
          initial_device_display_name?: string
          device_data?: Record<string, unknown>
          created_at: number
          expires_at?: number
        }>
      }
      const devices: DehydratedDevice[] = []

      for (const device of response.devices || []) {
        devices.push({
          deviceId: device.device_id,
          userId: this.client.getUserId() || '',
          initialDeviceDisplayName: device.initial_device_display_name,
          deviceData: device.device_data,
          createdAt: device.created_at,
          expiresAt: device.expires_at
        })
      }

      return devices
    } catch (error) {
      logger.error('获取设备列表失败:', error)
      return []
    }
  }

  /**
   * 认领脱水设备
   * 使用设备ID和密钥恢复设备
   */
  async claimDevice(
    deviceId: string,
    signingPubKey: string
  ): Promise<{ accessToken: string; deviceId: string } | null> {
    try {
      const response = (await this.client.http.authedRequest(
        {},
        'POST',
        `/_matrix/client/v1/dehydrated_device/${deviceId}/claim`,
        undefined,
        {
          body: JSON.stringify({
            signing_pubkey: signingPubKey
          })
        }
      )) as { access_token: string; device_id: string }

      return {
        accessToken: response.access_token,
        deviceId: response.device_id
      }
    } catch (error) {
      logger.error('认领设备失败:', error)
      return null
    }
  }

  /**
   * 更新脱水设备数据
   */
  async updateDeviceData(deviceId: string, deviceData: Record<string, unknown>): Promise<boolean> {
    try {
      await this.client.http.authedRequest({}, 'PUT', `/_matrix/client/v1/dehydrated_device/${deviceId}`, undefined, {
        body: JSON.stringify({
          device_data: deviceData
        })
      })

      return true
    } catch (error) {
      logger.error('更新设备数据失败:', error)
      return false
    }
  }

  /**
   * 删除脱水设备
   */
  async deleteDevice(deviceId: string): Promise<boolean> {
    try {
      await this.client.http.authedRequest({}, 'DELETE', `/_matrix/client/v1/dehydrated_device/${deviceId}`, undefined)

      return true
    } catch (error) {
      logger.error('删除设备失败:', error)
      return false
    }
  }

  /**
   * 获取设备事件
   * 用于获取脱水设备的初始状态
   */
  async getDeviceEvent(deviceId: string): Promise<Record<string, unknown> | null> {
    try {
      const response = await this.client.http.authedRequest(
        {},
        'GET',
        `/_matrix/client/v1/dehydrated_device/${deviceId}/initial_device`,
        undefined
      )

      return response as Record<string, unknown>
    } catch (error) {
      logger.error('获取设备事件失败:', error)
      return null
    }
  }
}

export const matrixDehydratedDeviceService = new MatrixDehydratedDeviceService()
