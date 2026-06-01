import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import { StoresEnum } from '@/enums'
import { cryptoSDKAdapter } from '@/services/matrix/crypto/CryptoSDKAdapter'
import { matrixCryptoService } from '@/services/matrix/crypto/MatrixCryptoService'
import { matrixEncryptionContextService } from '@/services/matrix/crypto/MatrixEncryptionContextService'
import { matrixEncryptionService } from '@/services/matrix/crypto/MatrixEncryptionService'
import { matrixKeyBackupService } from '@/services/matrix/crypto/MatrixKeyBackupService'
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
    markSecurityKeyConfigured,
    markCrossSigningSetup,
    markBackupEnabled,
    markDeviceVerified
  }
})
