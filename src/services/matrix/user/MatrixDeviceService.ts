/**
 * Matrix 设备管理服务
 *
 * 提供设备列表、设备详情、设备更新、设备删除等功能
 * 参考 API 契约: device.md
 */

import { info, error } from '@tauri-apps/plugin-log'
import matrixClientService from '../MatrixClientService'
import type { MatrixClient } from 'matrix-js-sdk'
import type { MatrixClientExtended } from '@/types/matrix-extensions'

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
export interface DevicesResponse {
  devices: Device[]
}

/**
 * 设备详情响应
 */
export interface DeviceDetailResponse {
  device_id: string
  display_name?: string
  last_seen_ts?: number
  last_seen_ip?: string
  device?: Device
}

/**
 * 设备更新响应
 */
export interface DeviceUpdateResponse {
  device_id: string
  display_name: string
  updated_ts: number
}

/**
 * 设备列表变更响应
 */
export interface DeviceListUpdatesResponse {
  changed: string[]
  left: string[]
  deleted?: string[]
  stream_id?: number
}

/**
 * 设备列表变更请求
 */
export interface DeviceListUpdatesRequest {
  users: string[]
  since?: string | number
  from?: string | number
  to?: string | number
}

/**
 * 设备管理服务
 */
class MatrixDeviceService {
  /**
   * 获取客户端实例
   */
  private getClient(): MatrixClient {
    const client = matrixClientService.getClient()
    if (!client) {
      throw new Error('MatrixClient 未初始化')
    }
    return client
  }

  /**
   * 获取当前用户的所有设备
   *
   * @returns 设备列表
   */
  async getDevices(): Promise<Device[]> {
    try {
      const client = this.getClient()
      const extendedClient = client as MatrixClientExtended
      const deviceManager = extendedClient.getDeviceManager?.()

      if (deviceManager) {
        // 使用 DeviceManager
        const devices = await deviceManager.getDevices()
        info(`[DeviceService] 获取设备列表成功: ${devices.length} 个设备`)
        return devices
      } else {
        // 降级到直接 HTTP 调用
        const response = (await client.http.authedRequest('GET', '/_matrix/client/v3/devices')) as DevicesResponse
        info(`[DeviceService] 获取设备列表成功: ${response.devices.length} 个设备`)
        return response.devices
      }
    } catch (err) {
      error(`[DeviceService] 获取设备列表失败: ${err}`)
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
      const deviceManager = (client as MatrixClientExtended).getDeviceManager?.()

      if (deviceManager) {
        // 使用 DeviceManager
        const device = await deviceManager.getDevice(deviceId)
        info(`[DeviceService] 获取设备详情成功: ${deviceId}`)
        return device
      } else {
        // 降级到直接 HTTP 调用
        const response = (await client.http.authedRequest(
          'GET',
          `/_matrix/client/v3/devices/${encodeURIComponent(deviceId)}`
        )) as DeviceDetailResponse
        info(`[DeviceService] 获取设备详情成功: ${deviceId}`)
        // 返回嵌套的 device 对象或扁平字段
        return (
          response.device || {
            device_id: response.device_id,
            display_name: response.display_name,
            last_seen_ts: response.last_seen_ts,
            last_seen_ip: response.last_seen_ip
          }
        )
      }
    } catch (err) {
      error(`[DeviceService] 获取设备详情失败: ${deviceId}, ${err}`)
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
      const client = this.getClient()
      const deviceManager = (client as MatrixClientExtended).getDeviceManager?.()

      if (deviceManager) {
        // 使用 DeviceManager
        await deviceManager.updateDevice(deviceId, displayName)
        info(`[DeviceService] 更新设备成功: ${deviceId}`)
        return {
          device_id: deviceId,
          display_name: displayName,
          updated_ts: Date.now()
        }
      } else {
        // 降级到直接 HTTP 调用
        const response = (await client.http.authedRequest(
          'PUT',
          `/_matrix/client/v3/devices/${encodeURIComponent(deviceId)}`,
          undefined,
          { display_name: displayName }
        )) as DeviceUpdateResponse
        info(`[DeviceService] 更新设备成功: ${deviceId}`)
        return response
      }
    } catch (err) {
      error(`[DeviceService] 更新设备失败: ${deviceId}, ${err}`)
      throw err
    }
  }

  /**
   * 删除单个设备
   *
   * @param deviceId 设备 ID
   * @param auth 可选的认证信息（用于 UIA）
   */
  async deleteDevice(deviceId: string, auth?: any): Promise<void> {
    try {
      const client = this.getClient()
      const deviceManager = (client as MatrixClientExtended).getDeviceManager?.()

      if (deviceManager) {
        // 使用 DeviceManager（会自动保护当前设备）
        await deviceManager.deleteDevice(deviceId, auth)
        info(`[DeviceService] 删除设备成功: ${deviceId}`)
      } else {
        // 降级到直接 HTTP 调用
        await client.http.authedRequest(
          'DELETE',
          `/_matrix/client/v3/devices/${encodeURIComponent(deviceId)}`,
          undefined,
          auth ? { auth } : undefined
        )
        info(`[DeviceService] 删除设备成功: ${deviceId}`)
      }
    } catch (err) {
      error(`[DeviceService] 删除设备失败: ${deviceId}, ${err}`)
      throw err
    }
  }

  /**
   * 批量删除设备
   *
   * @param deviceIds 设备 ID 列表
   * @param auth 可选的认证信息（用于 UIA）
   */
  async deleteDevices(deviceIds: string[], auth?: any): Promise<void> {
    try {
      const client = this.getClient()
      const deviceManager = (client as MatrixClientExtended).getDeviceManager?.()

      if (deviceManager) {
        // 使用 DeviceManager
        await deviceManager.deleteDevices(deviceIds, auth)
        info(`[DeviceService] 批量删除设备成功: ${deviceIds.length} 个设备`)
      } else {
        // 降级到直接 HTTP 调用
        await client.http.authedRequest('POST', '/_matrix/client/v3/delete_devices', undefined, {
          devices: deviceIds,
          auth
        })
        info(`[DeviceService] 批量删除设备成功: ${deviceIds.length} 个设备`)
      }
    } catch (err) {
      error(`[DeviceService] 批量删除设备失败: ${err}`)
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
      const deviceManager = (client as MatrixClientExtended).getDeviceManager?.()

      if (deviceManager) {
        // 使用 DeviceManager
        const sinceToken =
          typeof request.since === 'string'
            ? request.since
            : typeof request.from === 'string'
              ? request.from
              : undefined
        const updates = await deviceManager.getDeviceListUpdates(request.users, sinceToken)
        info(`[DeviceService] 获取设备变更成功: ${request.users.length} 个用户`)
        return updates
      } else {
        // 降级到直接 HTTP 调用
        const response = (await client.http.authedRequest(
          'POST',
          '/_matrix/client/v3/keys/device_list_updates',
          undefined,
          request
        )) as DeviceListUpdatesResponse
        info(`[DeviceService] 获取设备变更成功: ${request.users.length} 个用户`)
        return response
      }
    } catch (err) {
      error(`[DeviceService] 获取设备变更失败: ${err}`)
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
      error(`[DeviceService] 获取当前设备 ID 失败: ${err}`)
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

  async getRoomKeyRequests(): Promise<Array<Record<string, unknown>>> {
    const client = this.getClient()
    try {
      const result = await client.http.authedRequest('GET', '/_matrix/client/v3/room_keys/request')
      info('[DeviceService] 获取密钥请求列表成功')
      return (result as { requests?: Array<Record<string, unknown>> }).requests ?? []
    } catch (err) {
      error(`[DeviceService] 获取密钥请求列表失败: ${err}`)
      return []
    }
  }

  async deleteRoomKeyRequest(requestId: string): Promise<boolean> {
    const client = this.getClient()
    try {
      await client.http.authedRequest('DELETE', `/_matrix/client/v3/room_keys/request/${encodeURIComponent(requestId)}`)
      info(`[DeviceService] 删除密钥请求成功: ${requestId}`)
      return true
    } catch (err) {
      error(`[DeviceService] 删除密钥请求失败: ${err}`)
      return false
    }
  }
}

/**
 * 单例实例
 */
export const matrixDeviceService = new MatrixDeviceService()

/**
 * 初始化设备服务
 */
export function initializeDeviceService(): void {
  const client = matrixClientService.getClient()
  if (!client) {
    return
  }
  info('[DeviceService] 服务已就绪')
}

export default matrixDeviceService
