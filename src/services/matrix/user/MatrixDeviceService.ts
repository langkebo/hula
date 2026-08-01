/**
 * Matrix 设备管理服务
 *
 * 提供设备列表、设备详情、设备更新、设备删除等功能
 * 参考 API 契约: device.md
 */

import type { IDeviceUpdateRequest } from 'matrix-js-sdk'
import type { AuthDict, MatrixClientExtended } from '@/types/matrix-extensions'
import { createLogger } from '@/utils/Logger'
import { BaseMatrixService } from '../BaseMatrixService'

const logger = createLogger('MatrixDeviceService')

/**
 * 设备信息接口
 */
export interface Device {
  device_id: string
  display_name?: string
  last_seen_ts?: number
  last_seen_ip?: string
  last_seen_user_agent?: string
  verified?: boolean
}

/**
 * 设备列表响应
 */
interface DevicesResponse {
  devices: Device[]
}

/**
 * 设备详情响应
 */
interface DeviceDetailResponse {
  device_id: string
  display_name?: string
  last_seen_ts?: number
  last_seen_ip?: string
  device?: Device
}

/**
 * 设备更新响应
 */
interface DeviceUpdateResponse {
  device_id: string
  display_name: string
  updated_ts: number
}

/**
 * 设备列表变更响应
 */
interface DeviceListUpdatesResponse {
  changed: string[]
  left: string[]
  deleted?: string[]
  stream_id?: number
}

/**
 * 设备列表变更请求
 */
interface DeviceListUpdatesRequest {
  users: string[]
  since?: string | number
  from?: string | number
  to?: string | number
}

/**
 * 设备管理服务
 */
class MatrixDeviceService extends BaseMatrixService {
  /**
   * 获取当前用户的所有设备
   *
   * @returns 设备列表
   */
  async getDevices(): Promise<Device[]> {
    try {
      const client = this.getClient()
      const extendedClient = client as unknown as MatrixClientExtended
      const deviceManager = extendedClient.getDeviceManager?.()

      if (!deviceManager) {
        throw new Error('DeviceManager not available')
      }

      const devices = await deviceManager.getDevices()
      logger.info(`[DeviceService] 获取设备列表成功: ${devices.length} 个设备`)
      return devices
    } catch (err) {
      logger.error(`[DeviceService] 获取设备列表失败: ${err}`)
      throw err
    }
  }

  /**
   * 获取单个设备详情
   *
   * @param deviceId 设备 ID
   * @returns 设备详情
   */
  async getDevice(deviceId: string): Promise<Device> {
    try {
      const client = this.getClient()
      const deviceManager = (client as unknown as MatrixClientExtended).getDeviceManager?.()

      if (!deviceManager) {
        throw new Error('DeviceManager not available')
      }

      const device = await deviceManager.getDevice(deviceId)
      logger.info(`[DeviceService] 获取设备详情成功: ${deviceId}`)
      return device
    } catch (err) {
      logger.error(`[DeviceService] 获取设备详情失败: ${deviceId}, ${err}`)
      throw err
    }
  }

  /**
   * 更新设备显示名称
   *
   * @param deviceId 设备 ID
   * @param displayName 新的显示名称
   * @returns 更新结果
   */
  async updateDevice(deviceId: string, displayName: string): Promise<DeviceUpdateResponse> {
    try {
      // SDK-9: 设备名称长度 ≤100 字符前端校验
      if (displayName && displayName.length > 100) {
        throw new Error(`设备名称不能超过 100 个字符（当前: ${displayName.length}）`)
      }

      const client = this.getClient()
      const deviceManager = (client as unknown as MatrixClientExtended).getDeviceManager?.()

      if (!deviceManager) {
        throw new Error('DeviceManager not available')
      }

      // 使用 DeviceManager（SDK-9: 适配 IDeviceUpdateRequest 对象签名）
      const updates: IDeviceUpdateRequest = { display_name: displayName }
      await deviceManager.updateDevice(deviceId, updates)
      logger.info(`[DeviceService] 更新设备成功: ${deviceId}`)
      return {
        device_id: deviceId,
        display_name: displayName,
        updated_ts: Date.now()
      }
    } catch (err) {
      logger.error(`[DeviceService] 更新设备失败: ${deviceId}, ${err}`)
      throw err
    }
  }

  /**
   * 删除单个设备
   *
   * @param deviceId 设备 ID
   * @param auth 可选的认证信息（用于 UIA）
   */
  async deleteDevice(deviceId: string, auth?: AuthDict): Promise<void> {
    try {
      const client = this.getClient()
      const deviceManager = (client as unknown as MatrixClientExtended).getDeviceManager?.()

      if (!deviceManager) {
        throw new Error('DeviceManager not available')
      }

      // 使用 DeviceManager（会自动保护当前设备）
      await deviceManager.deleteDevice(deviceId, auth)
      logger.info(`[DeviceService] 删除设备成功: ${deviceId}`)
    } catch (err) {
      logger.error(`[DeviceService] 删除设备失败: ${deviceId}, ${err}`)
      throw err
    }
  }

  /**
   * 批量删除设备
   *
   * @param deviceIds 设备 ID 列表
   * @param auth 可选的认证信息（用于 UIA）
   */
  async deleteDevices(deviceIds: string[], auth?: AuthDict): Promise<void> {
    try {
      const client = this.getClient()
      const deviceManager = (client as unknown as MatrixClientExtended).getDeviceManager?.()

      if (!deviceManager) {
        throw new Error('DeviceManager not available')
      }

      await deviceManager.deleteDevices(deviceIds, auth)
      logger.info(`[DeviceService] 批量删除设备成功: ${deviceIds.length} 个设备`)
    } catch (err) {
      logger.error(`[DeviceService] 批量删除设备失败: ${err}`)
      throw err
    }
  }

  /**
   * 查询多用户设备列表变更
   *
   * @param request 查询请求
   * @returns 设备变更信息
   */
  async getDeviceListUpdates(request: DeviceListUpdatesRequest): Promise<DeviceListUpdatesResponse> {
    try {
      const client = this.getClient()
      const deviceManager = (client as unknown as MatrixClientExtended).getDeviceManager?.()

      if (!deviceManager) {
        throw new Error('DeviceManager not available')
      }

      const sinceToken =
        typeof request.since === 'string' ? request.since : typeof request.from === 'string' ? request.from : undefined
      const updates = await deviceManager.getDeviceListUpdates(request.users, sinceToken)
      logger.info(`[DeviceService] 获取设备变更成功: ${request.users.length} 个用户`)
      return updates
    } catch (err) {
      logger.error(`[DeviceService] 获取设备变更失败: ${err}`)
      throw err
    }
  }

  /**
   * 获取当前设备 ID
   *
   * @returns 当前设备 ID
   */
  getCurrentDeviceId(): string | null {
    try {
      const client = this.getClient()
      return client.getDeviceId() || null
    } catch (err) {
      logger.error(`[DeviceService] 获取当前设备 ID 失败: ${err}`)
      return null
    }
  }

  /**
   * 检查是否为当前设备
   *
   * @param deviceId 设备 ID
   * @returns 是否为当前设备
   */
  isCurrentDevice(deviceId: string): boolean {
    const currentDeviceId = this.getCurrentDeviceId()
    return currentDeviceId === deviceId
  }

  /**
   * 获取房间密钥请求列表
   */
  async getRoomKeyRequests(): Promise<Array<Record<string, unknown>>> {
    const client = this.getClient()
    try {
      const result = await client.getRoomKeysManager().getRoomKeyRequests()
      logger.info('[DeviceService] 获取密钥请求列表成功')
      return (result?.requests ?? []) as Array<Record<string, unknown>>
    } catch (err) {
      logger.error(`[DeviceService] 获取密钥请求列表失败: ${err}`)
      return []
    }
  }

  /**
   * 删除房间密钥请求
   */
  async deleteRoomKeyRequest(requestId: string): Promise<boolean> {
    const client = this.getClient()
    try {
      await client.getRoomKeysManager().deleteRoomKeyRequest(requestId)
      logger.info(`[DeviceService] 删除密钥请求成功: ${requestId}`)
      return true
    } catch (err) {
      logger.error(`[DeviceService] 删除密钥请求失败: ${err}`)
      return false
    }
  }
}

/**
 * 单例实例
 */
export const matrixDeviceService = new MatrixDeviceService()
