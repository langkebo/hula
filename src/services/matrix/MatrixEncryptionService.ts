import matrixClientService from './MatrixClientService'
import { info, error, warn } from '@tauri-apps/plugin-log'

export interface EncryptionSettings {
  algorithm: string
  rotationPeriodMs: number
  rotationPeriodMsgs: number
}

export interface CrossSigningInfo {
  isSetup: boolean
  masterPublicKey?: string
  selfSigningPublicKey?: string
  userSigningPublicKey?: string
}

export interface KeyBackupInfo {
  version: string | null
  algorithm: string | null
  authData: any
  count: number
  etag: string
}

export interface VerificationRequest {
  requestId: string
  phase: string
  methods: string[]
  otherParty: {
    userId: string
    deviceId: string
  }
}

class MatrixEncryptionService {
  private crypto: any = null

  async initialize(): Promise<void> {
    const client = matrixClientService.getClient()
    if (!client) {
      throw new Error('[Encryption] 客户端未初始化')
    }

    try {
      const isCryptoEnabled = (client as any).isCryptoEnabled?.()
      if (isCryptoEnabled) {
        this.crypto = (client as any).getCrypto?.()
        info('[Encryption] 加密模块初始化成功')
      } else {
        warn('[Encryption] 加密模块未启用')
      }
    } catch (err) {
      error(`[Encryption] 加密模块初始化失败: ${err}`)
      throw err
    }
  }

  private getCrypto(): any {
    if (!this.crypto) {
      const client = matrixClientService.getClient()
      if (client) {
        this.crypto = (client as any).getCrypto?.()
      }
    }
    return this.crypto
  }

  async isEncryptionAvailable(): Promise<boolean> {
    const crypto = this.getCrypto()
    return !!crypto
  }

  async isRoomEncrypted(roomId: string): Promise<boolean> {
    const client = matrixClientService.getClient()
    if (!client) return false

    try {
      return (client as any).isRoomEncrypted?.(roomId) ?? false
    } catch {
      return false
    }
  }

  async enableRoomEncryption(roomId: string, settings?: Partial<EncryptionSettings>): Promise<void> {
    const client = matrixClientService.getClient()
    if (!client) {
      throw new Error('[Encryption] 客户端未初始化')
    }

    try {
      const encryptionEventContent: any = {
        algorithm: settings?.algorithm || 'm.megolm.v1.aes-sha2'
      }

      if (settings?.rotationPeriodMs) {
        encryptionEventContent.rotation_period_ms = settings.rotationPeriodMs
      }
      if (settings?.rotationPeriodMsgs) {
        encryptionEventContent.rotation_period_msgs = settings.rotationPeriodMsgs
      }

      await client.sendStateEvent(roomId, 'm.room.encryption' as any, encryptionEventContent, '')
      info(`[Encryption] 启用房间加密: ${roomId}`)
    } catch (err) {
      error(`[Encryption] 启用房间加密失败: ${err}`)
      throw err
    }
  }

  async getEncryptionSettings(roomId: string): Promise<EncryptionSettings | null> {
    const client = matrixClientService.getClient()
    if (!client) return null

    try {
      const room = client.getRoom(roomId)
      if (!room) return null

      const encryptionEvent = room.currentState.getStateEvents('m.room.encryption' as any, '')
      if (!encryptionEvent) return null

      const content = encryptionEvent.getContent()
      return {
        algorithm: content.algorithm || 'm.megolm.v1.aes-sha2',
        rotationPeriodMs: content.rotation_period_ms || 604800000,
        rotationPeriodMsgs: content.rotation_period_msgs || 100
      }
    } catch (err) {
      error(`[Encryption] 获取加密设置失败: ${err}`)
      return null
    }
  }

  async setupCrossSigning(authParams?: { password?: string; authData?: any }): Promise<void> {
    const crypto = this.getCrypto()
    if (!crypto) {
      throw new Error('[Encryption] 加密模块不可用')
    }

    try {
      await crypto.bootstrapCrossSigning?.({
        authUploadDeviceSigningKeys: async (makeRequest: (authData: any) => Promise<any>) => {
          if (authParams?.authData) {
            return makeRequest(authParams.authData)
          }
          throw new Error('[Encryption] 需要认证参数')
        }
      })
      info('[Encryption] 交叉签名设置成功')
    } catch (err) {
      error(`[Encryption] 设置交叉签名失败: ${err}`)
      throw err
    }
  }

  async getCrossSigningInfo(): Promise<CrossSigningInfo> {
    const crypto = this.getCrypto()
    if (!crypto) {
      return { isSetup: false }
    }

    try {
      const status = await crypto.getCrossSigningStatus?.()
      const crossSigningKeyId = (crypto as any).crossSigningInfo?.getId?.()

      return {
        isSetup: status?.privateKeysCached ?? false,
        masterPublicKey: crossSigningKeyId,
        selfSigningPublicKey: (crypto as any).crossSigningInfo?.getId?.('self_signing'),
        userSigningPublicKey: (crypto as any).crossSigningInfo?.getId?.('user_signing')
      }
    } catch (err) {
      error(`[Encryption] 获取交叉签名信息失败: ${err}`)
      return { isSetup: false }
    }
  }

  async isCrossSigningReady(): Promise<boolean> {
    const client = matrixClientService.getClient() as any
    if (!client) return false

    try {
      return client.isCrossSigningReady?.() ?? false
    } catch {
      return false
    }
  }

  async setupKeyBackup(recoveryKey?: string): Promise<string> {
    const crypto = this.getCrypto()
    if (!crypto) {
      throw new Error('[Encryption] 加密模块不可用')
    }

    try {
      let key: string

      if (recoveryKey) {
        await crypto.restoreKeyBackup?.(recoveryKey)
        key = recoveryKey
      } else {
        key = await crypto.resetKeyBackup?.()
      }

      info('[Encryption] 密钥备份设置成功')
      return key
    } catch (err) {
      error(`[Encryption] 设置密钥备份失败: ${err}`)
      throw err
    }
  }

  async getKeyBackupInfo(): Promise<KeyBackupInfo | null> {
    const crypto = this.getCrypto()
    if (!crypto) return null

    try {
      const backupInfo = await crypto.getKeyBackupVersion?.()
      if (!backupInfo) return null

      return {
        version: backupInfo.version,
        algorithm: backupInfo.algorithm,
        authData: backupInfo.auth_data,
        count: backupInfo.count || 0,
        etag: backupInfo.etag
      }
    } catch (err) {
      error(`[Encryption] 获取密钥备份信息失败: ${err}`)
      return null
    }
  }

  async restoreFromBackup(recoveryKey: string): Promise<{ imported: number; total: number }> {
    const crypto = this.getCrypto()
    if (!crypto) {
      throw new Error('[Encryption] 加密模块不可用')
    }

    try {
      const backupInfo = await crypto.getKeyBackupVersion?.()
      if (!backupInfo) {
        throw new Error('[Encryption] 没有可用的密钥备份')
      }

      const result = await crypto.restoreKeyBackup?.(recoveryKey, undefined, undefined, backupInfo)

      info(`[Encryption] 从备份恢复密钥成功: ${result?.imported || 0} 个`)
      return {
        imported: result?.imported || 0,
        total: result?.total || 0
      }
    } catch (err) {
      error(`[Encryption] 从备份恢复密钥失败: ${err}`)
      throw err
    }
  }

  async deleteKeyBackup(): Promise<void> {
    const crypto = this.getCrypto()
    if (!crypto) return

    try {
      const backupInfo = await crypto.getKeyBackupVersion?.()
      if (backupInfo) {
        await crypto.deleteKeyBackupVersion?.(backupInfo.version)
        info('[Encryption] 删除密钥备份成功')
      }
    } catch (err) {
      error(`[Encryption] 删除密钥备份失败: ${err}`)
      throw err
    }
  }

  async requestDeviceVerification(
    userId: string,
    deviceId: string,
    methods: string[] = ['m.sas.v1', 'm.qr_code.show.v1', 'm.reciprocate.v1']
  ): Promise<VerificationRequest> {
    const client = matrixClientService.getClient() as any
    if (!client) {
      throw new Error('[Encryption] 客户端未初始化')
    }

    try {
      const request = await client.requestVerificationDM?.(userId, deviceId, methods)

      return {
        requestId: request?.transactionId || '',
        phase: request?.phase || 'requested',
        methods: request?.methods || methods,
        otherParty: {
          userId,
          deviceId
        }
      }
    } catch (err) {
      error(`[Encryption] 请求设备验证失败: ${err}`)
      throw err
    }
  }

  async requestUserVerification(userId: string, methods: string[] = ['m.sas.v1']): Promise<VerificationRequest> {
    const client = matrixClientService.getClient() as any
    if (!client) {
      throw new Error('[Encryption] 客户端未初始化')
    }

    try {
      const request = await client.requestVerification?.(userId, methods)

      return {
        requestId: request?.transactionId || '',
        phase: request?.phase || 'requested',
        methods: request?.methods || methods,
        otherParty: {
          userId,
          deviceId: ''
        }
      }
    } catch (err) {
      error(`[Encryption] 请求用户验证失败: ${err}`)
      throw err
    }
  }

  async getVerificationRequests(userId: string): Promise<VerificationRequest[]> {
    const client = matrixClientService.getClient() as any
    if (!client) return []

    try {
      const requests = client.getVerificationRequestsToDevice?.(userId) || []
      return requests.map((r: any) => ({
        requestId: r.transactionId,
        phase: r.phase,
        methods: r.methods || [],
        otherParty: {
          userId: r.userId,
          deviceId: r.deviceId
        }
      }))
    } catch {
      return []
    }
  }

  async trustDevice(userId: string, deviceId: string): Promise<void> {
    const client = matrixClientService.getClient() as any
    if (!client) {
      throw new Error('[Encryption] 客户端未初始化')
    }

    try {
      await client.setDeviceVerified?.(userId, deviceId)
      info(`[Encryption] 信任设备: ${userId}:${deviceId}`)
    } catch (err) {
      error(`[Encryption] 信任设备失败: ${err}`)
      throw err
    }
  }

  async untrustDevice(userId: string, deviceId: string): Promise<void> {
    const client = matrixClientService.getClient() as any
    if (!client) {
      throw new Error('[Encryption] 客户端未初始化')
    }

    try {
      await client.setDeviceKnown?.(userId, deviceId, false)
      info(`[Encryption] 取消信任设备: ${userId}:${deviceId}`)
    } catch (err) {
      error(`[Encryption] 取消信任设备失败: ${err}`)
      throw err
    }
  }

  async blockDevice(userId: string, deviceId: string): Promise<void> {
    const client = matrixClientService.getClient() as any
    if (!client) {
      throw new Error('[Encryption] 客户端未初始化')
    }

    try {
      await client.setDeviceBlocked?.(userId, deviceId, true)
      info(`[Encryption] 阻止设备: ${userId}:${deviceId}`)
    } catch (err) {
      error(`[Encryption] 阻止设备失败: ${err}`)
      throw err
    }
  }

  async unblockDevice(userId: string, deviceId: string): Promise<void> {
    const client = matrixClientService.getClient() as any
    if (!client) {
      throw new Error('[Encryption] 客户端未初始化')
    }

    try {
      await client.setDeviceBlocked?.(userId, deviceId, false)
      info(`[Encryption] 取消阻止设备: ${userId}:${deviceId}`)
    } catch (err) {
      error(`[Encryption] 取消阻止设备失败: ${err}`)
      throw err
    }
  }

  async getDeviceTrustLevel(
    userId: string,
    deviceId: string
  ): Promise<{
    isVerified: boolean
    isCrossSigningVerified: boolean
    isTofu: boolean
  }> {
    const client = matrixClientService.getClient() as any
    if (!client) {
      return { isVerified: false, isCrossSigningVerified: false, isTofu: false }
    }

    try {
      const device = await client.getStoredDevice?.(userId, deviceId)
      if (!device) {
        return { isVerified: false, isCrossSigningVerified: false, isTofu: false }
      }

      const trustInfo = await client.checkDeviceTrust?.(userId, deviceId)

      return {
        isVerified: device.isVerified?.() ?? false,
        isCrossSigningVerified: trustInfo?.isCrossSigningVerified?.() ?? false,
        isTofu: !device.isUnverified?.()
      }
    } catch {
      return { isVerified: false, isCrossSigningVerified: false, isTofu: false }
    }
  }

  async exportRoomKeys(): Promise<string> {
    const crypto = this.getCrypto()
    if (!crypto) {
      throw new Error('[Encryption] 加密模块不可用')
    }

    try {
      const keys = await crypto.exportRoomKeys?.()
      const exported = JSON.stringify(keys, null, 2)
      info('[Encryption] 导出房间密钥成功')
      return exported
    } catch (err) {
      error(`[Encryption] 导出房间密钥失败: ${err}`)
      throw err
    }
  }

  async importRoomKeys(keysJson: string): Promise<{ imported: number; total: number }> {
    const crypto = this.getCrypto()
    if (!crypto) {
      throw new Error('[Encryption] 加密模块不可用')
    }

    try {
      const keys = JSON.parse(keysJson)
      const result = await crypto.importRoomKeys?.(keys, {
        progressCallback: () => {}
      })

      info(`[Encryption] 导入房间密钥成功: ${result?.length || 0} 个`)
      return {
        imported: result?.length || 0,
        total: keys.length || 0
      }
    } catch (err) {
      error(`[Encryption] 导入房间密钥失败: ${err}`)
      throw err
    }
  }

  async getUnverifiedDevicesInRoom(roomId: string): Promise<string[]> {
    const client = matrixClientService.getClient() as any
    if (!client) return []

    try {
      const room = client.getRoom(roomId)
      if (!room) return []

      const members = room.getEncryptionTargetMembers?.() || room.getJoinedMembers?.() || []
      const unverifiedDevices: string[] = []

      for (const member of members) {
        const userId = member.userId || member
        const devices = (await client.getStoredDevicesForUser?.(userId)) || []

        for (const device of devices) {
          const isVerified = device.isVerified?.()
          if (!isVerified) {
            unverifiedDevices.push(`${userId}:${device.deviceId}`)
          }
        }
      }

      return unverifiedDevices
    } catch {
      return []
    }
  }

  async hasUndecryptableEvents(roomId: string): Promise<boolean> {
    const client = matrixClientService.getClient() as any
    if (!client) return false

    try {
      const room = client.getRoom(roomId)
      if (!room) return false

      const timeline = room.getLiveTimeline()
      const events = timeline.getEvents()

      for (const event of events) {
        if (event.isDecryptionFailure?.()) {
          return true
        }
      }

      return false
    } catch {
      return false
    }
  }
}

export const matrixEncryptionService = new MatrixEncryptionService()
export default matrixEncryptionService
