import type { MatrixClient } from 'matrix-js-sdk'
import type { DeviceKeysManager } from 'matrix-js-sdk/device-keys'
import type { KeyBackupManager as SDKKeyBackupManager } from 'matrix-js-sdk/key-backup'
import type { KeyVerificationManager } from 'matrix-js-sdk/key-verification'
import type {
  CryptoApi,
  DeviceTrustManager,
  GeneratedSecretStorageKey,
  ISecuritySummary,
  KeyBackupManager,
  LegacyStoredDevice,
  MatrixAuthData,
  MatrixClientExtended,
  SecureBackupManager,
  VerificationRequest
} from '@/types/matrix-extensions'
import { createLogger } from '@/utils/Logger'
import { matrixClientService } from '../MatrixClientService'

const logger = createLogger('CryptoSDKAdapter')

export interface DeviceVerificationResult {
  verified: boolean
  crossSigningVerified: boolean
  devicesCrossSigningVerified: boolean
}

export interface CrossSigningStatusResult {
  privateKeysCached: boolean
  crossSigningVerified: boolean
  isSetup: boolean
  masterPublicKey?: string
  selfSigningPublicKey?: string
  userSigningPublicKey?: string
}

export interface KeyBackupSetupResult {
  success: boolean
  recoveryKey?: string
}

export interface KeyBackupRestoreResult {
  imported: number
  total: number
}

export interface KeyExportResult {
  data: string
  count: number
}

export interface KeyImportResult {
  imported: number
  total: number
}

class CryptoSDKAdapter {
  private cryptoCache: CryptoApi | null = null

  private getExtendedClient(): MatrixClientExtended {
    return matrixClientService.getClient() as unknown as MatrixClientExtended
  }

  private getClient(): MatrixClient {
    const client = matrixClientService.getClient()
    if (!client) throw new Error('Matrix client not initialized')
    return client
  }

  getCrypto(): CryptoApi | null {
    if (this.cryptoCache) return this.cryptoCache
    const client = this.getExtendedClient()
    this.cryptoCache = client.getCrypto()
    return this.cryptoCache
  }

  invalidateCryptoCache(): void {
    this.cryptoCache = null
  }

  private getDeviceTrustManager(): DeviceTrustManager | null {
    return this.getExtendedClient().getDeviceTrustManager?.() ?? null
  }

  private getSecureBackupManager(): SecureBackupManager | null {
    return this.getExtendedClient().getSecureBackupManager?.() ?? null
  }

  private getKeyBackupManager(): KeyBackupManager | null {
    return this.getExtendedClient().getKeyBackupManager?.() ?? null
  }

  private getSDKDeviceKeysManager(): DeviceKeysManager | null {
    return this.getExtendedClient().getDeviceKeysManager?.() ?? null
  }

  private getSDKKeyBackupManager(): SDKKeyBackupManager | null {
    return this.getExtendedClient().getSDKKeyBackupManager?.() ?? null
  }

  private getSDKKeyVerificationManager(): KeyVerificationManager | null {
    return this.getExtendedClient().getKeyVerificationManager?.() ?? null
  }

  getManagerAccessors() {
    return {
      deviceTrust: () => this.getDeviceTrustManager(),
      secureBackup: () => this.getSecureBackupManager(),
      keyBackup: () => this.getKeyBackupManager(),
      sdkDeviceKeys: () => this.getSDKDeviceKeysManager(),
      sdkKeyBackup: () => this.getSDKKeyBackupManager(),
      sdkKeyVerification: () => this.getSDKKeyVerificationManager()
    }
  }

  // ==================== Device Trust ====================

  async getDevices(userId: string): Promise<
    Array<{
      deviceId: string
      userId: string
      displayName?: string
      lastSeenTs?: number
      lastSeenIp?: string
      isVerified?: boolean
    }>
  > {
    const trustManager = this.getDeviceTrustManager()
    if (trustManager) {
      const trustList = await trustManager.getDeviceTrustList()
      return trustList
        .filter((d) => (d.user_id ?? '') === userId)
        .map((d) => ({
          deviceId: d.device_id,
          userId: d.user_id ?? userId,
          displayName: d.display_name,
          lastSeenTs: d.last_seen_ts,
          lastSeenIp: d.last_seen_ip,
          isVerified: d.trust_level === 'verified'
        }))
    }

    const client = this.getExtendedClient()
    if (typeof client.getStoredDevicesForUser === 'function') {
      const devices = await client.getStoredDevicesForUser(userId)
      return devices.map((device: LegacyStoredDevice) => ({
        deviceId: device.deviceId,
        userId: device.userId,
        displayName: device.displayName,
        isVerified: device.isVerified()
      }))
    }

    return []
  }

  async getDevice(
    userId: string,
    deviceId: string
  ): Promise<{
    deviceId: string
    userId: string
    displayName?: string
    lastSeenTs?: number
    lastSeenIp?: string
    isVerified?: boolean
  } | null> {
    const trustManager = this.getDeviceTrustManager()
    if (trustManager) {
      const trustInfo = await trustManager.getDeviceTrust(deviceId)
      if (!trustInfo) return null
      return {
        deviceId: trustInfo.device_id,
        userId: trustInfo.user_id ?? userId,
        displayName: trustInfo.display_name,
        lastSeenTs: trustInfo.last_seen_ts,
        lastSeenIp: trustInfo.last_seen_ip,
        isVerified: trustInfo.trust_level === 'verified'
      }
    }

    const client = this.getExtendedClient()
    if (typeof client.getStoredDevice === 'function') {
      const device = client.getStoredDevice(userId, deviceId)
      if (!device) return null
      return {
        deviceId: device.deviceId,
        userId: device.userId,
        displayName: device.displayName,
        isVerified: device.isVerified()
      }
    }

    return null
  }

  async verifyDevice(userId: string, deviceId: string): Promise<void> {
    const trustManager = this.getDeviceTrustManager()
    if (trustManager) {
      await trustManager.respondToVerification(
        (
          await trustManager.requestVerification({
            new_device_id: deviceId,
            device_id: this.getClient().getDeviceId() ?? '',
            method: 'sas'
          })
        ).token,
        true
      )
      logger.info(`设备验证成功(Manager): ${userId}:${deviceId}`)
      return
    }

    const crypto = this.getCrypto()
    if (crypto) {
      await crypto.setDeviceVerified(userId, deviceId)
      logger.info(`设备验证成功(CryptoApi): ${userId}:${deviceId}`)
      return
    }

    const client = this.getExtendedClient()
    if (typeof client.setDeviceVerified === 'function') {
      await client.setDeviceVerified(userId, deviceId)
      logger.info(`设备验证成功(Legacy): ${userId}:${deviceId}`)
    }
  }

  async unverifyDevice(userId: string, deviceId: string): Promise<void> {
    const crypto = this.getCrypto()
    if (crypto) {
      await crypto.setDeviceVerified(userId, deviceId, false)
      logger.info(`取消设备验证: ${userId}:${deviceId}`)
      return
    }

    const client = this.getExtendedClient()
    if (typeof client.setDeviceVerified === 'function') {
      await client.setDeviceVerified(userId, deviceId, false)
      logger.info(`取消设备验证(Legacy): ${userId}:${deviceId}`)
    }
  }

  async getDeviceVerificationStatus(userId: string, deviceId: string): Promise<DeviceVerificationResult> {
    const crypto = this.getCrypto()
    if (crypto) {
      const status = await crypto.getDeviceVerificationStatus(userId, deviceId)
      if (!status) {
        return { verified: false, crossSigningVerified: false, devicesCrossSigningVerified: false }
      }
      return {
        verified: status.isVerified(),
        crossSigningVerified: status.crossSigningVerified,
        devicesCrossSigningVerified: status.crossSigningVerified
      }
    }

    const client = this.getExtendedClient()
    if (typeof client.checkDeviceTrust === 'function') {
      const trust = await client.checkDeviceTrust(userId, deviceId)
      return {
        verified: trust.isVerified(),
        crossSigningVerified: trust.crossSigningVerified,
        devicesCrossSigningVerified: trust.crossSigningVerified
      }
    }

    return { verified: false, crossSigningVerified: false, devicesCrossSigningVerified: false }
  }

  async requestDeviceVerification(userId: string, deviceId: string): Promise<VerificationRequest | null> {
    const trustManager = this.getDeviceTrustManager()
    if (trustManager) {
      await trustManager.requestVerification({
        new_device_id: deviceId,
        device_id: this.getClient().getDeviceId() ?? '',
        method: 'sas'
      })
      return null
    }

    const crypto = this.getCrypto()
    if (crypto) {
      return await crypto.requestDeviceVerification(userId, deviceId)
    }

    return null
  }

  async blockDevice(userId: string, deviceId: string): Promise<void> {
    const client = this.getExtendedClient()
    if (typeof client.setDeviceBlocked === 'function') {
      await client.setDeviceBlocked(userId, deviceId, true)
      logger.info(`设备已屏蔽(Legacy): ${userId}:${deviceId}`)
      return
    }

    const crypto = this.getCrypto()
    if (crypto) {
      await crypto.setDeviceVerified(userId, deviceId, false)
      logger.info(`设备已标记为未验证(CryptoApi, 等效屏蔽): ${userId}:${deviceId}`)
      return
    }

    logger.warn(`无法屏蔽设备：无可用的加密接口`)
  }

  async unblockDevice(userId: string, deviceId: string): Promise<void> {
    const client = this.getExtendedClient()
    if (typeof client.setDeviceBlocked === 'function') {
      await client.setDeviceBlocked(userId, deviceId, false)
      logger.info(`设备已取消屏蔽(Legacy): ${userId}:${deviceId}`)
      return
    }

    const crypto = this.getCrypto()
    if (crypto) {
      await crypto.setDeviceVerified(userId, deviceId, false)
      logger.info(`设备已恢复为未验证状态(CryptoApi): ${userId}:${deviceId}`)
      return
    }

    logger.warn(`无法取消屏蔽设备：无可用的加密接口`)
  }

  async getSecuritySummary(): Promise<ISecuritySummary | null> {
    const trustManager = this.getDeviceTrustManager()
    if (trustManager) {
      return await trustManager.getSecuritySummary()
    }
    return null
  }

  // ==================== Cross Signing ====================

  async getCrossSigningStatus(): Promise<CrossSigningStatusResult> {
    const crypto = this.getCrypto()
    if (!crypto) {
      return { privateKeysCached: false, crossSigningVerified: false, isSetup: false }
    }

    let privateKeysCached = false
    let crossSigningVerified = false

    try {
      const status = await crypto.getCrossSigningStatus()
      privateKeysCached = status.privateKeysInSecretStorage
    } catch (err) {
      logger.warn('Get cross-signing status failed:', err)
    }

    try {
      crossSigningVerified = await crypto.isCrossSigningReady()
    } catch (err) {
      logger.warn('Check cross-signing ready failed:', err)
    }

    const crossSigningInfo = (crypto as unknown as { crossSigningInfo?: { getId?(type?: string): string | undefined } })
      .crossSigningInfo

    return {
      privateKeysCached,
      crossSigningVerified,
      isSetup: privateKeysCached,
      masterPublicKey: crossSigningInfo?.getId?.(),
      selfSigningPublicKey: crossSigningInfo?.getId?.('self_signing'),
      userSigningPublicKey: crossSigningInfo?.getId?.('user_signing')
    }
  }

  async isCrossSigningReady(): Promise<boolean> {
    const client = this.getExtendedClient()
    try {
      return client.isCrossSigningReady?.() ?? false
    } catch (err) {
      logger.error('Check cross-signing ready failed:', err)
      return false
    }
  }

  // ==================== Key Backup ====================

  async backupKeys(): Promise<void> {
    const backupManager = this.getKeyBackupManager()
    if (backupManager) {
      const backupInfo = await backupManager.checkKeyBackup()
      if (!backupInfo) {
        const crypto = this.getCrypto()
        if (crypto) {
          await crypto.resetKeyBackup()
          logger.info('创建新的密钥备份')
        }
      }
      backupManager.scheduleKeyBackupSend()
      return
    }

    const crypto = this.getCrypto()
    if (crypto) {
      const backupInfo = await crypto.getKeyBackupInfo()
      if (!backupInfo) {
        await crypto.resetKeyBackup()
        logger.info('创建新的密钥备份')
      }
    }
  }

  async setupKeyBackup(passphrase: string): Promise<KeyBackupSetupResult> {
    const secureBackupManager = this.getSecureBackupManager()
    if (secureBackupManager) {
      await secureBackupManager.createSecureBackup(passphrase)
      logger.info('安全密钥备份设置成功(passphrase加密)')
      return { success: true }
    }

    const backupManager = this.getKeyBackupManager()
    if (backupManager) {
      const backupInfo = await backupManager.checkKeyBackup()
      if (!backupInfo) {
        const keyInfo = await backupManager.prepareKeyBackupVersion()
        await backupManager.createKeyBackupVersion({
          algorithm: keyInfo.algorithm,
          auth_data: keyInfo.auth_data
        })
      }
      backupManager.scheduleKeyBackupSend()
      logger.info('密钥备份设置成功')
      return { success: true }
    }

    const crypto = this.getCrypto()
    if (crypto) {
      const backupInfo = await crypto.getKeyBackupInfo()
      if (!backupInfo) {
        await crypto.resetKeyBackup()
      }
      logger.info('密钥备份设置成功(基础)')
      return { success: true }
    }

    return { success: false }
  }

  async setupKeyBackupWithOptions(
    input?:
      | string
      | {
          recoveryKey?: string
          password?: string
          authData?: unknown
          generatedKey?: GeneratedSecretStorageKey | null
        }
  ): Promise<string> {
    // 用 logger.warn 确保所有步骤都显示在终端（INFO 级别可能被 Tauri 插件缓冲丢失）
    const log = (msg: string) => {
      logger.warn(`[CryptoSDKAdapter] ${msg}`)
    }
    const logErr = (msg: string) => {
      logger.error(`[CryptoSDKAdapter] ${msg}`)
    }

    log('setupKeyBackupWithOptions 开始')
    const crypto = this.getCrypto()
    if (!crypto) {
      logErr('setupKeyBackupWithOptions 失败: getCrypto() 返回 null')
      throw new Error('CryptoApi 不可用')
    }
    log(
      `getCrypto() 成功 — createRecoveryKeyFromPassphrase=${typeof crypto.createRecoveryKeyFromPassphrase === 'function'}, bootstrapSecretStorage=${typeof crypto.bootstrapSecretStorage === 'function'}`
    )

    const recoveryKey = typeof input === 'string' ? input : input?.recoveryKey
    let generatedKey = typeof input === 'string' ? null : (input?.generatedKey ?? null)
    const authData = typeof input === 'string' ? undefined : (input?.authData as Record<string, unknown> | undefined)

    if (recoveryKey) {
      log('分支 1: recoveryKey 已提供，调用 crypto.restoreKeyBackup()')
      await crypto.restoreKeyBackup()
      log('分支 1 完成: restoreKeyBackup 成功')
      return recoveryKey
    }

    if (!generatedKey && typeof crypto.createRecoveryKeyFromPassphrase === 'function') {
      const password = typeof input !== 'string' ? input?.password : undefined
      log(`分支 2: 调用 createRecoveryKeyFromPassphrase — password=${password ? '已提供' : '未提供(随机生成)'}`)
      const t2 = Date.now()
      // 30s 超时保护，防止 WASM 操作挂起
      generatedKey = await Promise.race([
        crypto.createRecoveryKeyFromPassphrase(password),
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error('createRecoveryKeyFromPassphrase 超时 (30s)')), 30000)
        )
      ])
      log(
        `分支 2 完成: createRecoveryKeyFromPassphrase 成功 (${Date.now() - t2}ms) — encodedKeyLength=${generatedKey?.encodedPrivateKey?.length ?? 0}`
      )
    } else if (!generatedKey) {
      log('跳过分支 2: createRecoveryKeyFromPassphrase 不是函数或 generatedKey 已存在')
    }

    if (generatedKey && typeof crypto.bootstrapSecretStorage === 'function') {
      // 非阻塞模式：密钥已生成，SSSS 上传改为后台执行，不阻塞用户界面
      // 根因：bootstrapSecretStorage 内部 setDefaultKeyId 上传 account_data 后
      // 等待 /sync 回送 AccountData 事件才 resolve。若 sync 循环未运行则永久挂起。
      // 修复：确保 sync 正在运行后再调用 bootstrapSecretStorage。
      log('分支 3: SSSS 上传改为非阻塞（后台执行），立即返回密钥')
      const t3 = Date.now()

      void (async () => {
        // 确保 sync 循环正在运行，否则 setDefaultKeyId 等待 AccountData 事件会永久挂起
        const client = matrixClientService.getClient()
        const syncState = client?.getSyncState?.()
        if (syncState === 'STOPPED' || syncState === null || syncState === 'ERROR') {
          log(`分支 3 前置: sync 未运行 (state=${syncState})，调用 startClient() 启动 sync`)
          try {
            client?.startClient()
            // 等待 sync 开始运行（最多 5s）
            await new Promise<void>((resolve) => {
              const deadline = Date.now() + 5000
              const check = () => {
                const state = client?.getSyncState?.()
                if (state === 'SYNCING' || state === 'PREPARED' || Date.now() > deadline) {
                  resolve()
                } else {
                  setTimeout(check, 200)
                }
              }
              check()
            })
            log(`分支 3 前置: sync 已启动 (state=${client?.getSyncState?.()})`)
          } catch (e) {
            log(`分支 3 前置: startClient 失败: ${e instanceof Error ? e.message : String(e)}`)
          }
        }

        try {
          await Promise.race([
            crypto.bootstrapSecretStorage({
              createSecretStorageKey: async () => {
                log('分支 3a 回调: createSecretStorageKey 被 SDK 调用')
                return generatedKey as GeneratedSecretStorageKey
              },
              setupNewSecretStorage: true,
              setupNewKeyBackup: false
            }),
            new Promise<never>((_, reject) =>
              setTimeout(() => reject(new Error('bootstrapSecretStorage(SSSS) 后台超时 (15s)')), 15000)
            )
          ])
          log(`分支 3a 完成: bootstrapSecretStorage(SSSS) 后台成功 (${Date.now() - t3}ms)`)

          log('分支 3b: 后台调用 resetKeyBackup')
          try {
            await Promise.race([
              crypto.resetKeyBackup(),
              new Promise<never>((_, reject) =>
                setTimeout(() => reject(new Error('resetKeyBackup 后台超时 (15s)')), 15000)
              )
            ])
            log(`分支 3b 完成: resetKeyBackup 后台成功 (${Date.now() - t3}ms)`)
          } catch (err) {
            const msg = err instanceof Error ? err.message : String(err)
            log(`分支 3b 结果: resetKeyBackup 后台失败 (${Date.now() - t3}ms): ${msg}`)
          }
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err)
          log(`分支 3a 结果: bootstrapSecretStorage(SSSS) 后台失败 (${Date.now() - t3}ms): ${msg}`)
        }
      })()

      log(`分支 3: SSSS 后台上传已启动，立即返回密钥 (${Date.now() - t3}ms)`)
      return generatedKey.encodedPrivateKey
    } else {
      log('分支 4: 调用 resetKeyBackup (bootstrapSecretStorage 不可用)')
      await crypto.resetKeyBackup(authData as unknown as MatrixAuthData)
      const key = generatedKey?.encodedPrivateKey || ''
      log('分支 4 完成: resetKeyBackup 成功')
      return key
    }
  }

  async restoreKeys(backupKey: string): Promise<KeyBackupRestoreResult> {
    const secureBackupManager = this.getSecureBackupManager()
    if (secureBackupManager) {
      const versions = await this.getSDKKeyBackupManager()?.getBackupVersions()
      if (versions?.versions?.length) {
        const result = await secureBackupManager.restoreFromSecureBackup(versions.versions[0].version, backupKey)
        return { imported: result.recovered_keys, total: result.total_keys }
      }
    }

    const backupManager = this.getKeyBackupManager()
    if (backupManager) {
      const backupInfo = await backupManager.checkKeyBackup()
      if (backupInfo) {
        const result = await backupManager.restoreKeyBackupWithRecoveryKey(backupKey)
        return { imported: result.imported, total: result.total }
      }
      return { imported: 0, total: 0 }
    }

    const crypto = this.getCrypto()
    if (crypto) {
      const backupInfo = await crypto.getKeyBackupInfo()
      if (backupInfo) {
        const result = await crypto.restoreKeyBackup()
        return { imported: result.imported, total: result.total }
      }
    }

    return { imported: 0, total: 0 }
  }

  async restoreFromBackup(_recoveryKey: string): Promise<KeyBackupRestoreResult> {
    const crypto = this.getCrypto()
    if (!crypto) {
      throw new Error('CryptoApi 不可用')
    }

    const backupInfo = await crypto.getKeyBackupInfo()
    if (!backupInfo) {
      throw new Error('无可用密钥备份')
    }

    const result = await crypto.restoreKeyBackup()
    return {
      imported: result.imported,
      total: result.total
    }
  }

  async restoreFromBackupWithPassphrase(passphrase: string): Promise<KeyBackupRestoreResult> {
    const crypto = this.getCrypto()
    if (!crypto) {
      throw new Error('CryptoApi 不可用')
    }

    const backupInfo = await crypto.getKeyBackupInfo()
    if (!backupInfo) {
      throw new Error('无可用密钥备份')
    }

    if (typeof crypto.restoreKeyBackupWithPassphrase !== 'function') {
      throw new Error('当前客户端不支持通过安全短语恢复密钥备份')
    }

    const result = await crypto.restoreKeyBackupWithPassphrase(passphrase)
    return {
      imported: result.imported,
      total: result.total
    }
  }

  // ==================== Key Import/Export ====================

  async exportKeys(passphrase?: string): Promise<KeyExportResult> {
    const secureBackupManager = this.getSecureBackupManager()
    if (secureBackupManager && passphrase) {
      const sdkManager = this.getSDKKeyBackupManager()
      if (sdkManager) {
        const versions = await sdkManager.getBackupVersions()
        if (versions.versions.length > 0) {
          const verifyResult = await secureBackupManager.verifySecureBackup(versions.versions[0].version, passphrase)
          if (!verifyResult.valid) {
            throw new Error('密码验证失败')
          }
        }
      }
    }

    const crypto = this.getCrypto()
    if (crypto && typeof crypto.exportRoomKeys === 'function') {
      const keys = await crypto.exportRoomKeys()
      return { data: JSON.stringify(keys), count: Array.isArray(keys) ? keys.length : 0 }
    }
    return { data: '', count: 0 }
  }

  async importKeys(data: string): Promise<KeyImportResult> {
    const keys = JSON.parse(data)
    const crypto = this.getCrypto()
    if (crypto) {
      await crypto.importRoomKeys(keys)
      const total = Array.isArray(keys) ? keys.length : 0
      return { imported: total, total }
    }
    return { imported: 0, total: 0 }
  }

  async createRecoveryKeyFromPassphrase(password?: string): Promise<GeneratedSecretStorageKey | null> {
    const crypto = this.getCrypto()
    if (!crypto) return null
    if (typeof crypto.createRecoveryKeyFromPassphrase !== 'function') return null
    return await crypto.createRecoveryKeyFromPassphrase(password)
  }

  // ==================== Room Encryption ====================

  async isRoomEncrypted(roomId: string): Promise<boolean> {
    const client = this.getClient()
    const room = client.getRoom(roomId)
    if (!room) return false

    const crypto = this.getCrypto()
    if (crypto) {
      if ((room as unknown as { hasEncryptionStateEvent: () => boolean }).hasEncryptionStateEvent()) {
        return true
      }
    }

    try {
      const encryptionEvent = room.currentState.getStateEvents('m.room.encryption', '')
      if (encryptionEvent) {
        const content = encryptionEvent.getContent() as { algorithm?: string }
        if (content.algorithm) return true
      }
    } catch {
      // Ignore
    }

    return false
  }

  async enableEncryption(roomId: string, algorithm: string = 'm.megolm.v1.aes-sha2'): Promise<void> {
    const client = this.getClient()
    await client.sendStateEvent(roomId, 'm.room.encryption', { algorithm })
  }

  // ==================== Crypto Status ====================

  async getCryptoStatus(): Promise<{ crossSigningReady: boolean; keyBackupEnabled: boolean } | null> {
    const crypto = this.getCrypto()
    if (!crypto) return null

    let crossSigningReady = false
    let keyBackupEnabled = false

    try {
      crossSigningReady = await crypto.isCrossSigningReady()
    } catch (err) {
      logger.warn('Check cross-signing ready failed:', err)
    }

    try {
      const backupManager = this.getKeyBackupManager()
      if (backupManager) {
        const backupInfo = await backupManager.checkKeyBackup()
        keyBackupEnabled = backupInfo !== null
      }
    } catch (err) {
      logger.warn('Check key backup status failed:', err)
    }

    return { crossSigningReady, keyBackupEnabled }
  }

  async isEncryptionAvailable(): Promise<boolean> {
    return !!this.getCrypto()
  }

  // ==================== Bootstrap / Cross-Signing Setup ====================

  async setupCrossSigning(authParams?: { password?: string; authData?: unknown }): Promise<void> {
    const crypto = this.getCrypto()
    if (!crypto) {
      throw new Error('CryptoApi 不可用')
    }

    const buildPasswordAuthData = (password?: string, session?: string) => {
      const trimmedPassword = password?.trim()
      const userId = this.getClient().getUserId()
      if (!trimmedPassword || !userId) return undefined
      return {
        type: 'm.login.password',
        user: userId,
        password: trimmedPassword,
        ...(session ? { session } : {})
      }
    }

    const extractUiaErrorData = (err: unknown) => {
      const candidates: unknown[] = [err]
      if (err && typeof err === 'object' && 'cause' in err) {
        candidates.push((err as { cause?: unknown }).cause)
      }
      for (const candidate of candidates) {
        if (!candidate || typeof candidate !== 'object') continue
        const record = candidate as Record<string, unknown>
        if (record.data && typeof record.data === 'object') {
          const data = record.data as Record<string, unknown>
          if ('session' in data || 'flows' in data || 'params' in data) return data
        }
        if ('session' in record || 'flows' in record || 'params' in record) return record
      }
      return null
    }

    await crypto.bootstrapCrossSigning?.({
      authUploadDeviceSigningKeys: async (makeRequest: (authData: unknown) => Promise<unknown>) => {
        const baseAuthData =
          (authParams?.authData as Record<string, unknown> | undefined) ?? buildPasswordAuthData(authParams?.password)
        if (baseAuthData) {
          try {
            return await makeRequest(baseAuthData)
          } catch (err) {
            const uiaData = extractUiaErrorData(err)
            if (uiaData?.session && !baseAuthData.session) {
              return makeRequest({ ...baseAuthData, session: uiaData.session })
            }
            throw err
          }
        }
        throw new Error('需要认证参数')
      }
    })
  }

  // ==================== Device Keys Manager (SDK) ====================

  requireSDKDeviceKeysManager(): DeviceKeysManager {
    const manager = this.getSDKDeviceKeysManager()
    if (!manager) throw new Error('DeviceKeysManager not available')
    return manager
  }

  requireSDKKeyBackupManager(): SDKKeyBackupManager {
    const manager = this.getSDKKeyBackupManager()
    if (!manager) throw new Error('SDKKeyBackupManager not available')
    return manager
  }

  requireSDKKeyVerificationManager(): KeyVerificationManager {
    const manager = this.getSDKKeyVerificationManager()
    if (!manager) throw new Error('KeyVerificationManager not available')
    return manager
  }
}

export const cryptoSDKAdapter = new CryptoSDKAdapter()
