/**
 * 脱水设备服务 (MSC3814)
 * 允许在不使用密钥的情况下创建和恢复设备
 */

import { createLogger } from '@/utils/Logger'
import { matrixClientService } from '../MatrixClientService'

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
  private getClient() {
    const client = matrixClientService.getClient()
    if (!client) {
      logger.warn('Matrix client not initialized, dehydrated device service unavailable.')
      return null
    }
    return client
  }

  /**
   * 创建脱水设备
   */
  async createDevice(params: CreateDehydratedDeviceParams): Promise<DehydratedDevice | null> {
    const { initialDeviceDisplayName, deviceData } = params
    const client = this.getClient()
    if (!client) return null

    try {
      const response = await client.getDehydratedDeviceManager().createDevice({
        device_data: (deviceData || {}) as { algorithm: string; account: string },
        initial_device_display_name: initialDeviceDisplayName
      })

      return {
        deviceId: response.device_id,
        userId: client.getUserId() || '',
        initialDeviceDisplayName,
        deviceData: deviceData,
        createdAt: Date.now()
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
    const client = this.getClient()
    if (!client) return null
    try {
      const response = await client.getDehydratedDeviceManager().getDevice(deviceId)

      return {
        deviceId: response.device_id,
        userId: client.getUserId() || '',
        initialDeviceDisplayName: response.initial_device_display_name,
        deviceData: response.device_data as Record<string, unknown> | undefined,
        createdAt: response.created_at ?? Date.now(),
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
    const client = this.getClient()
    if (!client) return []
    try {
      const response = await client.getDehydratedDeviceManager().getDevices()
      const devices: DehydratedDevice[] = []

      for (const device of response.devices || []) {
        devices.push({
          deviceId: device.device_id,
          userId: client.getUserId() || '',
          initialDeviceDisplayName: device.initial_device_display_name,
          deviceData: device.device_data as Record<string, unknown> | undefined,
          createdAt: device.created_at ?? Date.now(),
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
   */
  async claimDevice(
    deviceId: string,
    signingPubKey: string
  ): Promise<{ accessToken: string; deviceId: string } | null> {
    const client = this.getClient()
    if (!client) return null
    try {
      const response = await client.getDehydratedDeviceManager().claimDevice(deviceId, {
        rehydrate_data: {
          algorithm: 'org.matrix.msc3814.v1',
          account: signingPubKey
        }
      })

      return {
        accessToken: (response as Record<string, unknown>).access_token as string,
        deviceId: (response as Record<string, unknown>).device_id as string
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
    const client = this.getClient()
    if (!client) return false
    try {
      await client.getDehydratedDeviceManager().updateDeviceData(deviceId, {
        device_data: deviceData as { algorithm: string; account: string }
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
    const client = this.getClient()
    if (!client) return false
    try {
      await client.getDehydratedDeviceManager().deleteDevice(deviceId)

      return true
    } catch (error) {
      logger.error('删除设备失败:', error)
      return false
    }
  }

  /**
   * 获取设备事件
   */
  async getDeviceEvent(deviceId: string): Promise<Record<string, unknown> | null> {
    const client = this.getClient()
    if (!client) return null
    try {
      const response = await client.getDehydratedDeviceManager().getDeviceEvent(deviceId)

      return response
    } catch (error) {
      logger.error('获取设备事件失败:', error)
      return null
    }
  }
}

export const matrixDehydratedDeviceService = new MatrixDehydratedDeviceService()
