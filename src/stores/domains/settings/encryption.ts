import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import { StoresEnum } from '@/enums'
import { cryptoSDKAdapter } from '@/services/matrix/crypto/CryptoSDKAdapter'
import type { StoreCrossSigningKeysResult } from '@/services/matrix/crypto/cryptoAdapterTypes'
import { matrixCryptoService } from '@/services/matrix/crypto/MatrixCryptoService'
import { matrixEncryptionContextService } from '@/services/matrix/crypto/MatrixEncryptionContextService'
import { matrixEncryptionService } from '@/services/matrix/crypto/MatrixEncryptionService'
import { matrixKeyBackupService } from '@/services/matrix/crypto/MatrixKeyBackupService'
import { matrixClientService } from '@/services/matrix/MatrixClientService'
import { createLogger } from '@/utils/Logger'

const logger = createLogger('EncryptionStore')

export const useEncryptionStore = defineStore(StoresEnum.ENCRYPTION, () => {
  // === State ===
  const encryptionEnabled = ref(false)
  const securityKeyConfigured = ref(false)
  const crossSigningSetup = ref(false)
  /** 交叉签名**私钥**已存入服务端密钥存储（4S）—— 决定换设备/清缓存后能否恢复 */
  const crossSigningKeysInSecretStorage = ref(false)
  /**
   * 私钥**只在本机**（本机有私钥但未入 4S）⇒ 真实的可恢复性缺口。
   *
   * 与 `crossSigningSetup` 的区别：后者=「私钥已入 4S」，本值=「已建立交叉签名但没存进 4S」。
   * 用 `publicKeysOnDevice` 之外的信息判定：只要本机能取到私钥且 4S 里没有，就该提示用户。
   * 查询失败一律置 false（宁可漏提示，也不要在查不到时报警吓人）。
   */
  const crossSigningKeysLocalOnly = ref(false)
  const backupEnabled = ref(false)
  const backupVersion = ref('')
  const backupKeyCount = ref(0)
  const deviceVerified = ref(false)
  const needsRotation = ref(false)
  const loading = ref(false)
  const loaded = ref(false)
  // Rust Crypto 初始化失败状态（登录后检查）
  const cryptoInitFailed = ref(false)
  const cryptoInitError = ref<string | null>(null)
  /**
   * crypto 生命周期失配（Batch 4.1）：解绑被拒 / 已停止的 crypto 被复用。
   *
   * 与 `cryptoInitFailed` 分开：后者是「本次初始化没成功」，本字段是「时序被破坏」——
   * 前者会让用户发不出加密消息（需横幅提示），后者的 crypto 可能仍是好的，
   * 但**同一 client 复用时**会静默失效，故只作为诊断/客服可见信号，不参与用户横幅判定。
   */
  const cryptoLifecycleWarning = ref<string | null>(null)

  // === Getters ===
  const e2eeFullySetup = computed(
    () => encryptionEnabled.value && securityKeyConfigured.value && crossSigningSetup.value && backupEnabled.value
  )

  const setupProgress = computed(() => {
    let completed = 0
    const total = 4
    if (encryptionEnabled.value) completed++
    if (securityKeyConfigured.value) completed++
    if (crossSigningSetup.value) completed++
    if (backupEnabled.value) completed++
    return { completed, total, percentage: Math.round((completed / total) * 100) }
  })

  // === Actions ===
  async function loadEncryptionStatus() {
    if (loading.value) return
    loading.value = true

    try {
      const { isCryptoEnabled } = matrixEncryptionContextService.getCurrentSessionContext()
      encryptionEnabled.value = isCryptoEnabled

      if (!isCryptoEnabled) {
        loaded.value = true
        return
      }

      const results = await Promise.allSettled([
        loadSecurityKeyStatus(),
        loadCrossSigningStatus(),
        loadBackupStatus(),
        loadRotationStatus()
      ])

      for (const result of results) {
        if (result.status === 'rejected') {
          logger.warn('Partial encryption status load failed:', result.reason)
        }
      }

      loaded.value = true
    } catch (error) {
      logger.error('Failed to load encryption status', error)
    } finally {
      loading.value = false
    }
  }

  async function loadSecurityKeyStatus() {
    try {
      const cryptoStatus = await matrixCryptoService.getCryptoStatus()
      securityKeyConfigured.value = cryptoStatus?.crossSigningReady ?? false
    } catch {
      securityKeyConfigured.value = false
    }
  }

  async function loadCrossSigningStatus() {
    try {
      const crossSigningInfo = await cryptoSDKAdapter.getCrossSigningStatus()
      crossSigningSetup.value = crossSigningInfo.isSetup
      crossSigningKeysInSecretStorage.value = crossSigningInfo.privateKeysInSecretStorage
      crossSigningKeysLocalOnly.value =
        crossSigningInfo.privateKeysCachedLocally && !crossSigningInfo.privateKeysInSecretStorage
    } catch {
      crossSigningSetup.value = false
      crossSigningKeysInSecretStorage.value = false
      crossSigningKeysLocalOnly.value = false
    }
  }

  /**
   * 把已知的交叉签名私钥补存进既有 4S（幂等）。
   *
   * 返回 `'needs-setup'` 表示 4S 本身还不存在 —— 此时**不能**走这条路（SDK 会新建一个
   * 用户从未见过的 4S 密钥），调用方应引导用户去「安全密钥/安全备份」设置流程。
   */
  async function storeCrossSigningKeysInSecretStorage(): Promise<StoreCrossSigningKeysResult> {
    const result = await cryptoSDKAdapter.storeCrossSigningKeysInSecretStorage()
    if (result === 'stored' || result === 'already-stored') {
      await loadCrossSigningStatus()
    }
    return result
  }

  async function loadBackupStatus() {
    try {
      const backupInfo = await matrixKeyBackupService.checkKeyBackup()
      if (backupInfo) {
        backupEnabled.value = true
        backupVersion.value = backupInfo.version ?? ''
        backupKeyCount.value = backupInfo.count ?? 0
      } else {
        backupEnabled.value = false
      }
    } catch {
      backupEnabled.value = false
    }
  }

  async function loadRotationStatus() {
    try {
      const rotationStatus = await matrixEncryptionService.getKeyRotationStatus()
      needsRotation.value = rotationStatus.needsRotation
    } catch {
      needsRotation.value = false
    }
  }

  async function loadDeviceVerification() {
    try {
      const { userId, deviceId } = matrixEncryptionContextService.getCurrentSessionContext()
      if (userId && deviceId) {
        const { matrixVerificationService } = await import('@/services/matrix/crypto/MatrixVerificationService')
        deviceVerified.value = await matrixVerificationService.isDeviceVerified(userId, deviceId)
      }
    } catch {
      deviceVerified.value = false
    }
  }

  function markSecurityKeyConfigured() {
    securityKeyConfigured.value = true
  }

  function markCrossSigningSetup() {
    crossSigningSetup.value = true
  }

  function markBackupEnabled(version?: string, count?: number) {
    backupEnabled.value = true
    if (version) backupVersion.value = version
    if (count !== undefined) backupKeyCount.value = count
  }

  function markDeviceVerified() {
    deviceVerified.value = true
  }

  /**
   * 检查 Rust Crypto 初始化状态（登录后调用）。
   * 若 crypto 未成功初始化，则 cryptoInitFailed=true，加密房间将无法发送消息。
   */
  function loadCryptoInitStatus() {
    try {
      const state = matrixClientService.getRustCryptoDebugState()
      // 仅当尝试过初始化（attempted=true）但未成功（initialized=false）时判定为失败，
      // 排除"未登录"（skippedReason='missing-client-or-access-token'）等正常跳过情况
      const failed = state.attempted && !state.initialized
      cryptoInitFailed.value = failed
      cryptoInitError.value = failed ? (state.error ?? state.skippedReason ?? 'unknown') : null
      // Batch 4.1：把生命周期失配也接到这个刷新点上（此前只在日志里可见）。
      const lifecycle = matrixClientService.getCryptoLifecycleDiagnostics()
      cryptoLifecycleWarning.value = lifecycle.staleCryptoReuseWarning ?? lifecycle.lastBindingReleaseRejection
      if (failed) {
        logger.warn(`[EncryptionStore] Crypto 初始化失败，加密房间将无法发送消息: ${cryptoInitError.value}`)
      }
    } catch (err) {
      logger.error('[EncryptionStore] 加载 Crypto 初始化状态失败:', err)
      cryptoInitFailed.value = false
      cryptoInitError.value = null
      cryptoLifecycleWarning.value = null
    }
  }

  return {
    // State
    encryptionEnabled,
    securityKeyConfigured,
    crossSigningSetup,
    crossSigningKeysInSecretStorage,
    crossSigningKeysLocalOnly,
    backupEnabled,
    backupVersion,
    backupKeyCount,
    deviceVerified,
    needsRotation,
    loading,
    loaded,
    cryptoInitFailed,
    cryptoLifecycleWarning,
    cryptoInitError,
    // Getters
    e2eeFullySetup,
    setupProgress,
    // Actions
    loadEncryptionStatus,
    loadSecurityKeyStatus,
    loadCrossSigningStatus,
    loadBackupStatus,
    loadRotationStatus,
    loadDeviceVerification,
    loadCryptoInitStatus,
    markSecurityKeyConfigured,
    markCrossSigningSetup,
    storeCrossSigningKeysInSecretStorage,
    markBackupEnabled,
    markDeviceVerified
  }
})
