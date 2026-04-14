import type { MatrixClient } from 'matrix-js-sdk'
import matrixClientService from './MatrixClientService'
import { BaseManager } from './BaseManager'
import { info, warn } from '@tauri-apps/plugin-log'

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

export interface CrossSigningStatus {
  privateKeysCached: boolean
  crossSigningVerified: boolean
}

export type EncryptionAlgorithm = 'm.megolm.v1.aes-sha2' | 'm.olm.v1.curve25519-aes-sha2'

export interface KeyBackupData {
  version: string
  algorithm: string
  auth_data: Record<string, unknown>
}

class MatrixCryptoService extends BaseManager {
  private crypto: unknown = null

  private getClient(): MatrixClient {
    const client = matrixClientService.getClient()
    if (!client) {
      throw new Error('客户端未初始化')
    }
    return client
  }

  private getCrypto(): unknown {
    if (this.crypto) {
      return this.crypto
    }
    const client = this.getClient()
    const cryptoApi = (client as unknown as Record<string, unknown>).getCrypto
    if (typeof cryptoApi === 'function') {
      this.crypto = cryptoApi.call(client)
    }
    return this.crypto
  }

  async initializeCrypto(throwOnError = false): Promise<void> {
    const client = this.getClient()

    try {
      const isCryptoEnabled = (client as unknown as Record<string, unknown>).isCryptoEnabled
      if (typeof isCryptoEnabled === 'function' && isCryptoEnabled.call(client)) {
        this.crypto = this.getCrypto()
        info('[MatrixCrypto] 加密模块初始化成功')
      } else {
        warn('[MatrixCrypto] 加密模块未启用')
      }
    } catch (err) {
      this.handleError(err, 'initializeCrypto', undefined as void, throwOnError)
    }
  }

  async getCryptoStatus(
    throwOnError = true
  ): Promise<{ crossSigningReady: boolean; keyBackupEnabled: boolean } | null> {
    try {
      const crypto = this.getCrypto() as Record<string, unknown> | null
      if (!crypto) return null

      let crossSigningReady = false
      let keyBackupEnabled = false

      if (typeof crypto.isCrossSigningReady === 'function') {
        crossSigningReady = await (crypto.isCrossSigningReady as () => Promise<boolean>).call(crypto)
      }
      if (typeof crypto.isKeyBackupKeyStored === 'function') {
        keyBackupEnabled = await (crypto.isKeyBackupKeyStored as () => Promise<boolean>).call(crypto)
      }

      return { crossSigningReady, keyBackupEnabled }
    } catch (err) {
      return this.handleError(err, 'getCryptoStatus', null, throwOnError)
    }
  }

  async getDevices(userId: string, throwOnError = true): Promise<DeviceInfo[]> {
    const client = this.getClient()

    try {
      const getStoredDevicesForUser = (client as unknown as Record<string, unknown>).getStoredDevicesForUser
      if (typeof getStoredDevicesForUser !== 'function') {
        return []
      }

      const devices = await (getStoredDevicesForUser as (userId: string) => Promise<unknown[]>).call(client, userId)

      return devices.map((device: unknown) => {
        const d = device as Record<string, unknown>
        return {
          deviceId: d.deviceId as string,
          userId: d.userId as string,
          displayName: typeof d.getDisplayName === 'function' ? (d.getDisplayName() as string) : undefined,
          isVerified: typeof d.isVerified === 'function' ? (d.isVerified() as boolean) : undefined
        }
      })
    } catch (err) {
      return this.handleError(err, 'getDevices', [] as DeviceInfo[], throwOnError)
    }
  }

  async getDevice(userId: string, deviceId: string, throwOnError = true): Promise<DeviceInfo | null> {
    const client = this.getClient()

    try {
      const getStoredDevice = (client as unknown as Record<string, unknown>).getStoredDevice
      if (typeof getStoredDevice !== 'function') {
        return null
      }

      const device = await (getStoredDevice as (userId: string, deviceId: string) => Promise<unknown>).call(
        client,
        userId,
        deviceId
      )
      if (!device) return null

      const d = device as Record<string, unknown>
      return {
        deviceId: d.deviceId as string,
        userId: d.userId as string,
        displayName: typeof d.getDisplayName === 'function' ? (d.getDisplayName() as string) : undefined,
        isVerified: typeof d.isVerified === 'function' ? (d.isVerified() as boolean) : undefined
      }
    } catch (err) {
      return this.handleError(err, 'getDevice', null as DeviceInfo | null, throwOnError)
    }
  }

  async verifyDevice(userId: string, deviceId: string, throwOnError = false): Promise<void> {
    const client = this.getClient()

    try {
      const getStoredDevice = (client as unknown as Record<string, unknown>).getStoredDevice
      const setDeviceVerified = (client as unknown as Record<string, unknown>).setDeviceVerified

      if (typeof getStoredDevice === 'function' && typeof setDeviceVerified === 'function') {
        const device = await (getStoredDevice as (userId: string, deviceId: string) => Promise<unknown>).call(
          client,
          userId,
          deviceId
        )
        if (device) {
          await (setDeviceVerified as (userId: string, deviceId: string) => Promise<void>).call(
            client,
            userId,
            deviceId
          )
          info(`[MatrixCrypto] 设备验证成功: ${userId}:${deviceId}`)
        }
      }
    } catch (err) {
      this.handleError(err, 'verifyDevice', undefined as void, throwOnError)
    }
  }

  async unverifyDevice(userId: string, deviceId: string, throwOnError = false): Promise<void> {
    const client = this.getClient()

    try {
      const getStoredDevice = (client as unknown as Record<string, unknown>).getStoredDevice
      const setDeviceKnown = (client as unknown as Record<string, unknown>).setDeviceKnown

      if (typeof getStoredDevice === 'function' && typeof setDeviceKnown === 'function') {
        const device = await (getStoredDevice as (userId: string, deviceId: string) => Promise<unknown>).call(
          client,
          userId,
          deviceId
        )
        if (device) {
          await (setDeviceKnown as (userId: string, deviceId: string, known: boolean) => Promise<void>).call(
            client,
            userId,
            deviceId,
            false
          )
          info(`[MatrixCrypto] 取消设备验证: ${userId}:${deviceId}`)
        }
      }
    } catch (err) {
      this.handleError(err, 'unverifyDevice', undefined as void, throwOnError)
    }
  }

  async getDeviceVerificationStatus(
    userId: string,
    deviceId: string,
    throwOnError = true
  ): Promise<VerificationStatus> {
    const client = this.getClient()
    const defaultStatus: VerificationStatus = {
      verified: false,
      crossSigningVerified: false,
      devicesCrossSigningVerified: false
    }

    try {
      const getStoredDevice = (client as unknown as Record<string, unknown>).getStoredDevice
      if (typeof getStoredDevice !== 'function') {
        return defaultStatus
      }

      const device = await (getStoredDevice as (userId: string, deviceId: string) => Promise<unknown>).call(
        client,
        userId,
        deviceId
      )
      if (!device) {
        return defaultStatus
      }

      const d = device as Record<string, unknown>
      const checkUserTrust = (client as unknown as Record<string, unknown>).checkUserTrust
      const checkDeviceTrust = (client as unknown as Record<string, unknown>).checkDeviceTrust

      let crossSigningVerified = false
      let devicesCrossSigningVerified = false

      if (typeof checkUserTrust === 'function') {
        const trust = await (checkUserTrust as (userId: string) => Promise<unknown>).call(client, userId)
        const t = trust as Record<string, unknown>
        if (typeof t.isCrossSigningVerified === 'function') {
          crossSigningVerified = t.isCrossSigningVerified() as boolean
        }
      }

      if (typeof checkDeviceTrust === 'function') {
        const trust = await (checkDeviceTrust as (userId: string, deviceId: string) => Promise<unknown>).call(
          client,
          userId,
          deviceId
        )
        const t = trust as Record<string, unknown>
        if (typeof t.isCrossSigningVerified === 'function') {
          devicesCrossSigningVerified = t.isCrossSigningVerified() as boolean
        }
      }

      return {
        verified: typeof d.isVerified === 'function' ? (d.isVerified() as boolean) : false,
        crossSigningVerified,
        devicesCrossSigningVerified
      }
    } catch (err) {
      return this.handleError(err, 'getDeviceVerificationStatus', defaultStatus, throwOnError)
    }
  }

  async backupKeys(throwOnError = false): Promise<void> {
    try {
      const crypto = this.getCrypto() as Record<string, unknown> | null
      if (crypto) {
        const getKeyBackupVersion = crypto.getKeyBackupVersion
        const resetKeyBackup = crypto.resetKeyBackup

        if (typeof getKeyBackupVersion === 'function') {
          const backupInfo = await (getKeyBackupVersion as () => Promise<unknown>).call(crypto)
          if (!backupInfo && typeof resetKeyBackup === 'function') {
            await (resetKeyBackup as () => Promise<void>).call(crypto)
            info('[MatrixCrypto] 创建新的密钥备份')
          } else {
            info('[MatrixCrypto] 密钥备份已存在')
          }
        }
      }
    } catch (err) {
      this.handleError(err, 'backupKeys', undefined as void, throwOnError)
    }
  }

  async setupKeyBackup(_passphrase: string, throwOnError = false): Promise<void> {
    try {
      const crypto = this.getCrypto() as Record<string, unknown> | null
      if (crypto) {
        const getKeyBackupVersion = crypto.getKeyBackupVersion
        const resetKeyBackup = crypto.resetKeyBackup
        const backupRoomKeys = crypto.backupRoomKeys

        if (typeof getKeyBackupVersion === 'function') {
          const backupInfo = await (getKeyBackupVersion as () => Promise<unknown>).call(crypto)
          if (!backupInfo && typeof resetKeyBackup === 'function') {
            await (resetKeyBackup as () => Promise<void>).call(crypto)
            info('[MatrixCrypto] 创建新的密钥备份')
          }
        }

        if (typeof backupRoomKeys === 'function') {
          await (backupRoomKeys as () => Promise<void>).call(crypto)
          info('[MatrixCrypto] 设置密钥备份成功')
        }
      }
    } catch (err) {
      this.handleError(err, 'setupKeyBackup', undefined as void, throwOnError)
    }
  }

  async restoreKeys(backupKey: string, throwOnError = false): Promise<void> {
    try {
      const crypto = this.getCrypto() as Record<string, unknown> | null
      if (crypto) {
        const getKeyBackupVersion = crypto.getKeyBackupVersion
        const restoreKeyBackup = crypto.restoreKeyBackup

        if (typeof getKeyBackupVersion === 'function' && typeof restoreKeyBackup === 'function') {
          const backupInfo = await (getKeyBackupVersion as () => Promise<unknown>).call(crypto)
          if (backupInfo) {
            await (
              restoreKeyBackup as (key: string, target?: unknown, opts?: unknown, info?: unknown) => Promise<void>
            ).call(crypto, backupKey, undefined, undefined, backupInfo)
            info('[MatrixCrypto] 恢复密钥成功')
          }
        }
      }
    } catch (err) {
      this.handleError(err, 'restoreKeys', undefined as void, throwOnError)
    }
  }

  async exportKeys(_passphrase: string, throwOnError = false): Promise<string> {
    try {
      const crypto = this.getCrypto() as Record<string, unknown> | null
      if (crypto) {
        const exportRoomKeys = crypto.exportRoomKeys
        if (typeof exportRoomKeys === 'function') {
          const keys = await (exportRoomKeys as () => Promise<unknown[]>).call(crypto)
          const exportedData = JSON.stringify(keys)
          info('[MatrixCrypto] 导出密钥成功')
          return exportedData
        }
      }
      return ''
    } catch (err) {
      return this.handleError(err, 'exportKeys', '' as string, throwOnError)
    }
  }

  async importKeys(data: string, _passphrase: string, throwOnError = false): Promise<void> {
    try {
      const crypto = this.getCrypto() as Record<string, unknown> | null
      if (crypto) {
        const importRoomKeys = crypto.importRoomKeys
        if (typeof importRoomKeys === 'function') {
          const keys = JSON.parse(data)
          await (importRoomKeys as (keys: unknown[]) => Promise<void>).call(crypto, keys)
          info('[MatrixCrypto] 导入密钥成功')
        }
      }
    } catch (err) {
      this.handleError(err, 'importKeys', undefined as void, throwOnError)
    }
  }

  async isRoomEncrypted(roomId: string, throwOnError = true): Promise<boolean> {
    const client = this.getClient()

    try {
      const room = client.getRoom(roomId)
      if (!room) return false

      const isRoomEncrypted = (client as unknown as Record<string, unknown>).isRoomEncrypted
      if (typeof isRoomEncrypted === 'function') {
        return isRoomEncrypted.call(client, roomId) as boolean
      }
      return false
    } catch (err) {
      return this.handleError(err, 'isRoomEncrypted', false, throwOnError)
    }
  }

  async enableEncryption(
    roomId: string,
    algorithm: EncryptionAlgorithm = 'm.megolm.v1.aes-sha2',
    throwOnError = false
  ): Promise<void> {
    const client = this.getClient()

    try {
      await client.sendStateEvent(roomId, 'm.room.encryption', { algorithm }, '')
      info(`[MatrixCrypto] 启用房间加密: ${roomId}`)
    } catch (err) {
      this.handleError(err, 'enableEncryption', undefined as void, throwOnError)
    }
  }

  async requestVerification(userId: string, deviceId: string, throwOnError = false): Promise<string> {
    const client = this.getClient()

    try {
      const requestVerificationDM = (client as unknown as Record<string, unknown>).requestVerificationDM
      if (typeof requestVerificationDM === 'function') {
        const request = await (requestVerificationDM as (userId: string, deviceId: string) => Promise<unknown>).call(
          client,
          userId,
          deviceId
        )
        const r = request as Record<string, unknown>
        info(`[MatrixCrypto] 请求验证: ${userId}:${deviceId}`)
        return (r?.transactionId as string) ?? ''
      }
      return ''
    } catch (err) {
      return this.handleError(err, 'requestVerification', '' as string, throwOnError)
    }
  }

  async getCrossSigningStatus(throwOnError = true): Promise<CrossSigningStatus> {
    const client = this.getClient()
    const defaultStatus: CrossSigningStatus = {
      privateKeysCached: false,
      crossSigningVerified: false
    }

    try {
      const crypto = this.getCrypto() as Record<string, unknown> | null
      if (!crypto) {
        return defaultStatus
      }

      const getCrossSigningStatus = crypto.getCrossSigningStatus
      const isCrossSigningReady = (client as unknown as Record<string, unknown>).isCrossSigningReady

      let privateKeysCached = false
      let crossSigningVerified = false

      if (typeof getCrossSigningStatus === 'function') {
        const status = await (getCrossSigningStatus as () => Promise<unknown>).call(crypto)
        const s = status as Record<string, unknown>
        privateKeysCached = (s?.privateKeysCached as boolean) ?? false
      }

      if (typeof isCrossSigningReady === 'function') {
        crossSigningVerified = await (isCrossSigningReady as () => Promise<boolean>).call(client)
      }

      return {
        privateKeysCached,
        crossSigningVerified
      }
    } catch (err) {
      return this.handleError(err, 'getCrossSigningStatus', defaultStatus, throwOnError)
    }
  }
}

export const matrixCryptoService = new MatrixCryptoService()
export default matrixCryptoService
