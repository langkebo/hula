import { error, info, warn } from '@tauri-apps/plugin-log'
import type { MatrixClient } from 'matrix-js-sdk'
import matrixClientService from '../MatrixClientService'

/**
 * 设备信息接口
 */
export interface DeviceInfo {
  /** 设备 ID */
  deviceId: string
  /** 用户 ID */
  userId: string
  /** 设备显示名称 */
  displayName?: string
  /** 最后_seen时间戳 */
  lastSeenTs?: number
  /** 最后_seen IP */
  lastSeenIp?: string
  /** 是否已验证 */
  isVerified?: boolean
}

/**
 * 验证状态接口
 */
export interface VerificationStatus {
  /** 是否已验证 */
  verified: boolean
  /** 跨设备签名是否验证 */
  crossSigningVerified: boolean
  /** 设备跨设备签名是否验证 */
  devicesCrossSigningVerified: boolean
}

/**
 * 跨设备签名状态接口
 */
export interface CrossSigningStatus {
  /** 私钥是否已缓存 */
  privateKeysCached: boolean
  /** 跨设备签名是否验证 */
  crossSigningVerified: boolean
}

/**
 * 加密算法类型
 */
export type EncryptionAlgorithm = 'm.megolm.v1.aes-sha2' | 'm.olm.v1.curve25519-aes-sha2'

/**
 * 密钥备份数据
 */
export interface KeyBackupData {
  version: string
  algorithm: string
  auth_data: Record<string, unknown>
}

/**
 * Matrix 加密服务
 *
 * 负责设备验证、密钥备份、房间加密等加密相关功能。
 *
 * @example
 * ```typescript
 * const cryptoService = matrixCryptoService;
 *
 * // 初始化加密模块
 * await cryptoService.initializeCrypto();
 *
 * // 获取设备列表
 * const devices = await cryptoService.getDevices('@user:server');
 *
 * // 验证设备
 * await cryptoService.verifyDevice('@user:server', 'DEVICEID');
 *
 * // 启用房间加密
 * await cryptoService.enableEncryption('!roomId:server');
 * ```
 */
class MatrixCryptoService {
  private crypto: unknown = null

  /**
   * 获取 Matrix 客户端实例
   *
   * @returns Matrix 客户端实例
   * @throws {Error} 如果客户端未初始化
   */
  private getClient(): MatrixClient {
    const client = matrixClientService.getClient()
    if (!client) {
      throw new Error('客户端未初始化')
    }
    return client
  }

  /**
   * 获取加密模块
   *
   * @returns 加密模块实例
   */
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

  /**
   * 初始化加密模块
   *
   * @throws {Error} 如果客户端未初始化或初始化失败
   */
  async initializeCrypto(): Promise<void> {
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
      error(`[MatrixCrypto] 加密模块初始化失败: ${err}`)
      throw err
    }
  }

  /**
   * 获取加密状态
   *
   * @returns 加密状态信息
   */
  async getCryptoStatus(): Promise<{ crossSigningReady: boolean; keyBackupEnabled: boolean } | null> {
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
      error(`[MatrixCrypto] 获取加密状态失败: ${err}`)
      return null
    }
  }

  /**
   * 获取用户的所有设备
   *
   * @param userId - 用户 ID
   * @returns 设备列表
   * @throws {Error} 如果客户端未初始化或获取失败
   */
  async getDevices(userId: string): Promise<DeviceInfo[]> {
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
      error(`[MatrixCrypto] 获取设备列表失败: ${err}`)
      throw err
    }
  }

  /**
   * 获取指定设备信息
   *
   * @param userId - 用户 ID
   * @param deviceId - 设备 ID
   * @returns 设备信息，如果不存在则返回 null
   * @throws {Error} 如果客户端未初始化或获取失败
   */
  async getDevice(userId: string, deviceId: string): Promise<DeviceInfo | null> {
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
      error(`[MatrixCrypto] 获取设备信息失败: ${err}`)
      throw err
    }
  }

  /**
   * 验证设备
   *
   * @param userId - 用户 ID
   * @param deviceId - 设备 ID
   * @throws {Error} 如果客户端未初始化或验证失败
   */
  async verifyDevice(userId: string, deviceId: string): Promise<void> {
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
      error(`[MatrixCrypto] 设备验证失败: ${err}`)
      throw err
    }
  }

  /**
   * 取消设备验证
   *
   * @param userId - 用户 ID
   * @param deviceId - 设备 ID
   * @throws {Error} 如果客户端未初始化或取消失败
   */
  async unverifyDevice(userId: string, deviceId: string): Promise<void> {
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
      error(`[MatrixCrypto] 取消设备验证失败: ${err}`)
      throw err
    }
  }

  /**
   * 获取设备验证状态
   *
   * @param userId - 用户 ID
   * @param deviceId - 设备 ID
   * @returns 验证状态
   * @throws {Error} 如果客户端未初始化
   */
  async getDeviceVerificationStatus(userId: string, deviceId: string): Promise<VerificationStatus> {
    const client = this.getClient()

    try {
      const getStoredDevice = (client as unknown as Record<string, unknown>).getStoredDevice
      if (typeof getStoredDevice !== 'function') {
        return {
          verified: false,
          crossSigningVerified: false,
          devicesCrossSigningVerified: false
        }
      }

      const device = await (getStoredDevice as (userId: string, deviceId: string) => Promise<unknown>).call(
        client,
        userId,
        deviceId
      )
      if (!device) {
        return {
          verified: false,
          crossSigningVerified: false,
          devicesCrossSigningVerified: false
        }
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
      error(`[MatrixCrypto] 获取设备验证状态失败: ${err}`)
      throw err
    }
  }

  /**
   * 备份密钥
   *
   * @throws {Error} 如果客户端未初始化或备份失败
   */
  async backupKeys(): Promise<void> {
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
      error(`[MatrixCrypto] 备份密钥失败: ${err}`)
      throw err
    }
  }

  /**
   * 设置密钥备份
   *
   * @param passphrase - 密码短语 (暂未使用，保留接口兼容)
   * @throws {Error} 如果客户端未初始化或设置失败
   */
  async setupKeyBackup(_passphrase: string): Promise<void> {
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
      error(`[MatrixCrypto] 设置密钥备份失败: ${err}`)
      throw err
    }
  }

  /**
   * 恢复密钥
   *
   * @param backupKey - 备份密钥
   * @throws {Error} 如果客户端未初始化或恢复失败
   */
  async restoreKeys(backupKey: string): Promise<void> {
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
      error(`[MatrixCrypto] 恢复密钥失败: ${err}`)
      throw err
    }
  }

  /**
   * 导出密钥
   *
   * @param passphrase - 密码短语 (暂未使用，保留接口兼容)
   * @returns 导出的密钥数据 (JSON 字符串)
   * @throws {Error} 如果客户端未初始化或导出失败
   */
  async exportKeys(_passphrase: string): Promise<string> {
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
      error(`[MatrixCrypto] 导出密钥失败: ${err}`)
      throw err
    }
  }

  /**
   * 导入密钥
   *
   * @param data - 密钥数据 (JSON 字符串)
   * @param passphrase - 密码短语 (暂未使用，保留接口兼容)
   * @throws {Error} 如果客户端未初始化或导入失败
   */
  async importKeys(data: string, _passphrase: string): Promise<void> {
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
      error(`[MatrixCrypto] 导入密钥失败: ${err}`)
      throw err
    }
  }

  /**
   * 检查房间是否加密
   *
   * @param roomId - 房间 ID
   * @returns 是否加密
   */
  async isRoomEncrypted(roomId: string): Promise<boolean> {
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
      error(`[MatrixCrypto] 检查房间加密状态失败: ${err}`)
      return false
    }
  }

  /**
   * 启用房间加密
   *
   * @param roomId - 房间 ID
   * @param algorithm - 加密算法 (默认: m.megolm.v1.aes-sha2)
   * @throws {Error} 如果客户端未初始化或启用失败
   */
  async enableEncryption(roomId: string, algorithm: EncryptionAlgorithm = 'm.megolm.v1.aes-sha2'): Promise<void> {
    const client = this.getClient()

    try {
      await client.sendStateEvent(roomId, 'm.room.encryption', { algorithm }, '')
      info(`[MatrixCrypto] 启用房间加密: ${roomId}`)
    } catch (err) {
      error(`[MatrixCrypto] 启用房间加密失败: ${err}`)
      throw err
    }
  }

  /**
   * 请求设备验证
   *
   * @param userId - 用户 ID
   * @param deviceId - 设备 ID
   * @returns 验证请求的事务 ID
   * @throws {Error} 如果客户端未初始化或请求失败
   */
  async requestVerification(userId: string, deviceId: string): Promise<string> {
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
      error(`[MatrixCrypto] 请求验证失败: ${err}`)
      throw err
    }
  }

  /**
   * 获取跨设备签名状态
   *
   * @returns 跨设备签名状态
   */
  async getCrossSigningStatus(): Promise<CrossSigningStatus> {
    const client = this.getClient()

    try {
      const crypto = this.getCrypto() as Record<string, unknown> | null
      if (!crypto) {
        return {
          privateKeysCached: false,
          crossSigningVerified: false
        }
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
      error(`[MatrixCrypto] 获取跨设备签名状态失败: ${err}`)
      return {
        privateKeysCached: false,
        crossSigningVerified: false
      }
    }
  }

  async uploadKeys(
    deviceKeys?: Record<string, unknown>,
    oneTimeKeys?: Record<string, unknown>
  ): Promise<{
    oneTimeKeyCounts: Record<string, number>
  }> {
    const client = this.getClient()
    try {
      const uploadKeys = (client as unknown as Record<string, unknown>).uploadKeys
      if (typeof uploadKeys !== 'function') {
        return { oneTimeKeyCounts: {} }
      }
      const result = await (
        uploadKeys as (dk?: Record<string, unknown>, otk?: Record<string, unknown>) => Promise<unknown>
      ).call(client, deviceKeys, oneTimeKeys)
      const r = result as Record<string, unknown>
      info('[MatrixCrypto] 上传密钥成功')
      return { oneTimeKeyCounts: (r?.one_time_key_counts as Record<string, number>) ?? {} }
    } catch (err) {
      error(`[MatrixCrypto] 上传密钥失败: ${err}`)
      throw err
    }
  }

  async queryKeys(userIds: string[], timeout?: number): Promise<Record<string, unknown>> {
    const client = this.getClient()
    try {
      const queryKeys = (client as unknown as Record<string, unknown>).queryKeys
      if (typeof queryKeys !== 'function') {
        return {}
      }
      const deviceKeys: Record<string, unknown> = {}
      for (const userId of userIds) {
        deviceKeys[userId] = []
      }
      const result = await (
        queryKeys as (dk: Record<string, unknown>, opts?: Record<string, unknown>) => Promise<unknown>
      ).call(client, { device_keys: deviceKeys }, timeout ? { timeout } : undefined)
      info(`[MatrixCrypto] 查询密钥成功: ${userIds.length} 个用户`)
      return result as Record<string, unknown>
    } catch (err) {
      error(`[MatrixCrypto] 查询密钥失败: ${err}`)
      throw err
    }
  }

  async claimKeys(claims: Record<string, Record<string, string>>): Promise<Record<string, unknown>> {
    const client = this.getClient()
    try {
      const claimKeys = (client as unknown as Record<string, unknown>).claimKeys
      if (typeof claimKeys !== 'function') {
        return {}
      }
      const result = await (claimKeys as (c: Record<string, unknown>) => Promise<unknown>).call(client, {
        one_time_keys: claims
      })
      info('[MatrixCrypto] 声明密钥成功')
      return result as Record<string, unknown>
    } catch (err) {
      error(`[MatrixCrypto] 声明密钥失败: ${err}`)
      throw err
    }
  }

  async getKeyChanges(
    fromToken: string,
    toToken: string
  ): Promise<{
    changed: string[]
    left: string[]
  }> {
    const client = this.getClient()
    try {
      const result = await client.http.authedRequest('GET', '/_matrix/client/v3/keys/changes', {
        from: fromToken,
        to: toToken
      })
      const r = result as Record<string, unknown>
      return {
        changed: (r?.changed as string[]) ?? [],
        left: (r?.left as string[]) ?? []
      }
    } catch (err) {
      error(`[MatrixCrypto] 获取密钥变化失败: ${err}`)
      return { changed: [], left: [] }
    }
  }

  async sendToDevice(eventType: string, contentMap: Record<string, Record<string, unknown>>): Promise<void> {
    const client = this.getClient()
    try {
      const txnId = `txn_${Date.now()}`
      await client.http.authedRequest(
        'PUT',
        `/_matrix/client/v3/sendToDevice/${encodeURIComponent(eventType)}/${encodeURIComponent(txnId)}`,
        undefined,
        { messages: contentMap }
      )
      info(`[MatrixCrypto] 发送ToDevice消息成功: ${eventType}`)
    } catch (err) {
      error(`[MatrixCrypto] 发送ToDevice消息失败: ${err}`)
      throw err
    }
  }

  async uploadSignatures(signatures: Record<string, unknown>): Promise<void> {
    const client = this.getClient()
    try {
      await client.http.authedRequest('POST', '/_matrix/client/v3/keys/signatures/upload', undefined, signatures)
      info('[MatrixCrypto] 上传签名成功')
    } catch (err) {
      error(`[MatrixCrypto] 上传签名失败: ${err}`)
      throw err
    }
  }

  async uploadDeviceSigningKeys(
    masterKey?: Record<string, unknown>,
    selfSigningKey?: Record<string, unknown>,
    userSigningKey?: Record<string, unknown>
  ): Promise<void> {
    const client = this.getClient()
    try {
      const body: Record<string, unknown> = {}
      if (masterKey) body.master_key = masterKey
      if (selfSigningKey) body.self_signing_key = selfSigningKey
      if (userSigningKey) body.user_signing_key = userSigningKey
      await client.http.authedRequest('POST', '/_matrix/client/v3/keys/device_signing/upload', undefined, body)
      info('[MatrixCrypto] 上传设备签名密钥成功')
    } catch (err) {
      error(`[MatrixCrypto] 上传设备签名密钥失败: ${err}`)
      throw err
    }
  }

  async createRoomKeyRequest(
    roomId: string,
    sessionId: string,
    algorithm: string,
    devices: Record<string, string[]>
  ): Promise<void> {
    const client = this.getClient()
    try {
      await client.http.authedRequest('POST', '/_matrix/client/v3/room_keys/request', undefined, {
        action: 'request',
        requesting_device_id: client.getDeviceId(),
        request_id: `req_${Date.now()}`,
        room_id: roomId,
        session_id: sessionId,
        algorithm,
        devices
      })
      info(`[MatrixCrypto] 创建房间密钥请求成功: ${roomId}`)
    } catch (err) {
      error(`[MatrixCrypto] 创建房间密钥请求失败: ${err}`)
      throw err
    }
  }
}

export const matrixCryptoService = new MatrixCryptoService()
export default matrixCryptoService
