import matrixClientService from './MatrixClientService'
import { info, error, warn } from '@tauri-apps/plugin-log'

export interface DeviceInfo {
  deviceId: string
  userId: string
  displayName?: string
  lastSeenTs?: number
  lastSeenIp?: string
  isVerified?: boolean
}

export interface VerificationStatus {
  verified: boolean
  crossSigningVerified: boolean
  devicesCrossSigningVerified: boolean
}

class MatrixCryptoService {
  private crypto: any = null

  async initializeCrypto(): Promise<void> {
    const client = matrixClientService.getClient()
    if (!client) {
      throw new Error('客户端未初始化')
    }

    try {
      const isCryptoEnabled = (client as any).isCryptoEnabled?.()
      if (isCryptoEnabled) {
        this.crypto = (client as any).getCrypto?.()
        info('[MatrixCrypto] 加密模块初始化成功')
      } else {
        warn('[MatrixCrypto] 加密模块未启用')
      }
    } catch (err) {
      error(`[MatrixCrypto] 加密模块初始化失败: ${err}`)
      throw err
    }
  }

  async getDevices(userId: string): Promise<DeviceInfo[]> {
    const client = matrixClientService.getClient() as any
    if (!client) {
      throw new Error('客户端未初始化')
    }

    try {
      const devices = await client.getStoredDevicesForUser?.(userId) ?? []
      return devices.map((device: any) => ({
        deviceId: device.deviceId,
        userId: device.userId,
        displayName: device.getDisplayName?.(),
        isVerified: device.isVerified?.()
      }))
    } catch (err) {
      error(`[MatrixCrypto] 获取设备列表失败: ${err}`)
      throw err
    }
  }

  async getDevice(userId: string, deviceId: string): Promise<DeviceInfo | null> {
    const client = matrixClientService.getClient() as any
    if (!client) {
      throw new Error('客户端未初始化')
    }

    try {
      const device = await client.getStoredDevice?.(userId, deviceId)
      if (!device) return null

      return {
        deviceId: device.deviceId,
        userId: device.userId,
        displayName: device.getDisplayName?.(),
        isVerified: device.isVerified?.()
      }
    } catch (err) {
      error(`[MatrixCrypto] 获取设备信息失败: ${err}`)
      throw err
    }
  }

  async verifyDevice(userId: string, deviceId: string): Promise<void> {
    const client = matrixClientService.getClient() as any
    if (!client) {
      throw new Error('客户端未初始化')
    }

    try {
      const device = await client.getStoredDevice?.(userId, deviceId)
      if (device) {
        await client.setDeviceVerified?.(userId, deviceId)
        info(`[MatrixCrypto] 设备验证成功: ${userId}:${deviceId}`)
      }
    } catch (err) {
      error(`[MatrixCrypto] 设备验证失败: ${err}`)
      throw err
    }
  }

  async unverifyDevice(userId: string, deviceId: string): Promise<void> {
    const client = matrixClientService.getClient() as any
    if (!client) {
      throw new Error('客户端未初始化')
    }

    try {
      const device = await client.getStoredDevice?.(userId, deviceId)
      if (device) {
        await client.setDeviceKnown?.(userId, deviceId, false)
        info(`[MatrixCrypto] 取消设备验证: ${userId}:${deviceId}`)
      }
    } catch (err) {
      error(`[MatrixCrypto] 取消设备验证失败: ${err}`)
      throw err
    }
  }

  async getDeviceVerificationStatus(userId: string, deviceId: string): Promise<VerificationStatus> {
    const client = matrixClientService.getClient() as any
    if (!client) {
      throw new Error('客户端未初始化')
    }

    try {
      const device = await client.getStoredDevice?.(userId, deviceId)
      if (!device) {
        return {
          verified: false,
          crossSigningVerified: false,
          devicesCrossSigningVerified: false
        }
      }

      return {
        verified: device.isVerified?.() ?? false,
        crossSigningVerified: await client.checkUserTrust?.(userId)?.then?.((t: any) => t?.isCrossSigningVerified?.()) ?? false,
        devicesCrossSigningVerified: await client.checkDeviceTrust?.(userId, deviceId)?.then?.((t: any) => t?.isCrossSigningVerified?.()) ?? false
      }
    } catch (err) {
      error(`[MatrixCrypto] 获取设备验证状态失败: ${err}`)
      throw err
    }
  }

  async backupKeys(): Promise<void> {
    const client = matrixClientService.getClient() as any
    if (!client) {
      throw new Error('客户端未初始化')
    }

    try {
      const crypto = this.crypto ?? (client as any).getCrypto?.()
      if (crypto) {
        const backupInfo = await crypto.getKeyBackupVersion?.()
        if (!backupInfo) {
          await crypto.resetKeyBackup?.()
          info('[MatrixCrypto] 创建新的密钥备份')
        } else {
          info('[MatrixCrypto] 密钥备份已存在')
        }
      }
    } catch (err) {
      error(`[MatrixCrypto] 备份密钥失败: ${err}`)
      throw err
    }
  }

  async restoreKeys(backupKey: string): Promise<void> {
    const client = matrixClientService.getClient() as any
    if (!client) {
      throw new Error('客户端未初始化')
    }

    try {
      const crypto = this.crypto ?? (client as any).getCrypto?.()
      if (crypto) {
        const backupInfo = await crypto.getKeyBackupVersion?.()
        if (backupInfo) {
          await crypto.restoreKeyBackup?.(backupKey, undefined, undefined, backupInfo)
          info('[MatrixCrypto] 恢复密钥成功')
        }
      }
    } catch (err) {
      error(`[MatrixCrypto] 恢复密钥失败: ${err}`)
      throw err
    }
  }

  async exportKeys(_passphrase: string): Promise<string> {
    const client = matrixClientService.getClient() as any
    if (!client) {
      throw new Error('客户端未初始化')
    }

    try {
      const crypto = this.crypto ?? (client as any).getCrypto?.()
      if (crypto) {
        const keys = await crypto.exportRoomKeys?.()
        const exportedData = JSON.stringify(keys)
        info('[MatrixCrypto] 导出密钥成功')
        return exportedData
      }
      return ''
    } catch (err) {
      error(`[MatrixCrypto] 导出密钥失败: ${err}`)
      throw err
    }
  }

  async importKeys(data: string, _passphrase: string): Promise<void> {
    const client = matrixClientService.getClient() as any
    if (!client) {
      throw new Error('客户端未初始化')
    }

    try {
      const crypto = this.crypto ?? (client as any).getCrypto?.()
      if (crypto) {
        const keys = JSON.parse(data)
        await crypto.importRoomKeys?.(keys)
        info('[MatrixCrypto] 导入密钥成功')
      }
    } catch (err) {
      error(`[MatrixCrypto] 导入密钥失败: ${err}`)
      throw err
    }
  }

  async isRoomEncrypted(roomId: string): Promise<boolean> {
    const client = matrixClientService.getClient() as any
    if (!client) {
      throw new Error('客户端未初始化')
    }

    try {
      const room = client.getRoom?.(roomId)
      if (!room) return false
      return client.isRoomEncrypted?.(roomId) ?? false
    } catch (err) {
      error(`[MatrixCrypto] 检查房间加密状态失败: ${err}`)
      return false
    }
  }

  async enableEncryption(roomId: string): Promise<void> {
    const client = matrixClientService.getClient()
    if (!client) {
      throw new Error('客户端未初始化')
    }

    try {
      await client.sendStateEvent(roomId, 'm.room.encryption' as any, {
        algorithm: 'm.megolm.v1.aes-sha2'
      }, '')
      info(`[MatrixCrypto] 启用房间加密: ${roomId}`)
    } catch (err) {
      error(`[MatrixCrypto] 启用房间加密失败: ${err}`)
      throw err
    }
  }

  async requestVerification(userId: string, deviceId: string): Promise<string> {
    const client = matrixClientService.getClient() as any
    if (!client) {
      throw new Error('客户端未初始化')
    }

    try {
      const request = await client.requestVerificationDM?.(userId, deviceId)
      info(`[MatrixCrypto] 请求验证: ${userId}:${deviceId}`)
      return request?.transactionId ?? ''
    } catch (err) {
      error(`[MatrixCrypto] 请求验证失败: ${err}`)
      throw err
    }
  }

  async getCrossSigningStatus(): Promise<{
    privateKeysCached: boolean
    crossSigningVerified: boolean
  }> {
    const client = matrixClientService.getClient() as any
    if (!client) {
      throw new Error('客户端未初始化')
    }

    try {
      const crypto = this.crypto ?? (client as any).getCrypto?.()
      if (!crypto) {
        return {
          privateKeysCached: false,
          crossSigningVerified: false
        }
      }

      const crossSigningStatus = await crypto.getCrossSigningStatus?.()
      return {
        privateKeysCached: crossSigningStatus?.privateKeysCached ?? false,
        crossSigningVerified: await client.isCrossSigningReady?.() ?? false
      }
    } catch (err) {
      error(`[MatrixCrypto] 获取跨设备签名状态失败: ${err}`)
      return {
        privateKeysCached: false,
        crossSigningVerified: false
      }
    }
  }
}

export const matrixCryptoService = new MatrixCryptoService()
export default matrixCryptoService
