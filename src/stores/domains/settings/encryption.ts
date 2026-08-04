import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import { StoresEnum } from '@/enums'
import { cryptoSDKAdapter } from '@/services/matrix/crypto/CryptoSDKAdapter'
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
    } catch {
      crossSigningSetup.value = false
    }
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
      if (failed) {
        logger.warn(`[EncryptionStore] Crypto 初始化失败，加密房间将无法发送消息: ${cryptoInitError.value}`)
      }
    } catch (err) {
      logger.error('[EncryptionStore] 加载 Crypto 初始化状态失败:', err)
      cryptoInitFailed.value = false
      cryptoInitError.value = null
    }
  }

  return {
    // State
    encryptionEnabled,
    securityKeyConfigured,
    crossSigningSetup,
    backupEnabled,
    backupVersion,
    backupKeyCount,
    deviceVerified,
    needsRotation,
    loading,
    loaded,
    cryptoInitFailed,
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
    markBackupEnabled,
    markDeviceVerified
  }
})
