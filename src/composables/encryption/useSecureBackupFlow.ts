import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useActionFeedback } from '@/composables/common/useActionFeedback'
import matrixCryptoService from '@/services/matrix/crypto/MatrixCryptoService'
import { matrixKeyBackupService } from '@/services/matrix/crypto/MatrixKeyBackupService'
import { createLogger } from '@/utils/Logger'

const logger = createLogger('useSecureBackupFlow')

type SecureBackupPhase = 'status' | 'create' | 'restore' | 'success' | 'error'
type SecureBackupStatus = 'active' | 'inactive' | 'incomplete' | 'unknown'

interface CryptoStatus {
  crossSigningReady?: boolean
  keyBackupEnabled?: boolean
  keyBackupVersion?: string | null
}

interface SecureBackupInfoLike {
  recoveryKey?: string
  version?: string
}

/**
 * 跨端安全备份流程 composable
 * - create: 经 CryptoService.createSecureBackup(passphrase) 一步生成恢复密钥并启用
 * - restore: 经 KeyBackupService.importKeys(recoveryKey) 用恢复密钥导入
 * 复用 PC SecureBackupDialog.vue 与移动端 SecuritySettings.vue 流程
 */
export function useSecureBackupFlow() {
  const { t } = useI18n()
  const { showFeedback } = useActionFeedback()

  const phase = ref<SecureBackupPhase>('status')
  const loading = ref(false)
  const recoveryKey = ref<string>('')
  const passphrase = ref<string>('')
  const restoreInput = ref<string>('')
  const cryptoStatus = ref<CryptoStatus>({})
  const errorMessage = ref<string | null>(null)

  const status = computed<SecureBackupStatus>(() => {
    if (cryptoStatus.value.crossSigningReady && cryptoStatus.value.keyBackupEnabled) {
      return 'active'
    }
    if (cryptoStatus.value.keyBackupEnabled === false) {
      return 'inactive'
    }
    if (cryptoStatus.value.keyBackupEnabled) {
      return 'incomplete'
    }
    return 'unknown'
  })

  const isActive = computed(() => status.value === 'active')

  const refreshStatus = async (): Promise<void> => {
    try {
      const result = (await matrixCryptoService?.getCryptoStatus?.()) as CryptoStatus | null
      if (result) {
        cryptoStatus.value = result
      }
    } catch (err) {
      logger.warn('getCryptoStatus failed', err)
    }
  }

  const createSecureBackup = async (): Promise<boolean> => {
    if (loading.value) return false
    loading.value = true
    phase.value = 'create'
    errorMessage.value = null
    try {
      // CryptoService.createSecureBackup 一步完成:生成恢复密钥 + 启用备份
      const result = (await matrixCryptoService?.createSecureBackup?.(
        passphrase.value || ''
      )) as SecureBackupInfoLike | null
      recoveryKey.value = result?.recoveryKey ?? ''
      phase.value = 'success'
      showFeedback(t('mobile_security.secure_backup.create_success'), 'success')
      await refreshStatus()
      return true
    } catch (err) {
      logger.error('createSecureBackup failed', err)
      errorMessage.value = t('mobile_security.secure_backup.create_failed')
      phase.value = 'error'
      showFeedback(errorMessage.value, 'error')
      return false
    } finally {
      loading.value = false
    }
  }

  const restoreFromSecureBackup = async (recoveryKeyInput?: string): Promise<boolean> => {
    if (loading.value) return false
    loading.value = true
    phase.value = 'restore'
    errorMessage.value = null
    try {
      const input = recoveryKeyInput ?? restoreInput.value
      if (!input) {
        errorMessage.value = t('mobile_security.secure_backup.enter_recovery_key')
        return false
      }
      // 用 recovery key 直接 import 恢复
      await matrixKeyBackupService.importKeys({
        recoveryKey: input
      } as unknown as Record<string, unknown>)
      phase.value = 'success'
      showFeedback(t('mobile_security.secure_backup.restore_success'), 'success')
      await refreshStatus()
      return true
    } catch (err) {
      logger.error('restoreFromSecureBackup failed', err)
      errorMessage.value = t('mobile_security.secure_backup.restore_failed')
      phase.value = 'error'
      showFeedback(errorMessage.value, 'error')
      return false
    } finally {
      loading.value = false
    }
  }

  const verifyBackup = async (): Promise<boolean> => {
    if (loading.value) return false
    loading.value = true
    try {
      const version = cryptoStatus.value.keyBackupVersion
      if (!version) {
        showFeedback(t('mobile_security.secure_backup.verify_failed'), 'error')
        return false
      }
      const result = await matrixKeyBackupService.verifyBackup(version)
      if (result?.valid) {
        showFeedback(t('mobile_security.secure_backup.verify_success'), 'success')
        return true
      }
      showFeedback(t('mobile_security.secure_backup.verify_failed'), 'error')
      return false
    } catch (err) {
      logger.error('verifyBackup failed', err)
      showFeedback(t('mobile_security.secure_backup.verify_failed'), 'error')
      return false
    } finally {
      loading.value = false
    }
  }

  const deleteSecureBackup = async (): Promise<boolean> => {
    if (loading.value) return false
    loading.value = true
    try {
      const version = cryptoStatus.value.keyBackupVersion
      if (!version) {
        return false
      }
      await matrixKeyBackupService.deleteKeyBackupVersion(version)
      showFeedback(t('mobile_security.secure_backup.delete_success'), 'success')
      await refreshStatus()
      return true
    } catch (err) {
      logger.error('deleteSecureBackup failed', err)
      showFeedback(t('mobile_security.secure_backup.delete_failed'), 'error')
      return false
    } finally {
      loading.value = false
    }
  }

  const reset = (): void => {
    phase.value = 'status'
    recoveryKey.value = ''
    passphrase.value = ''
    restoreInput.value = ''
    errorMessage.value = null
  }

  return {
    // state
    phase,
    loading,
    recoveryKey,
    passphrase,
    restoreInput,
    cryptoStatus,
    errorMessage,
    // getters
    status,
    isActive,
    // actions
    refreshStatus,
    createSecureBackup,
    restoreFromSecureBackup,
    verifyBackup,
    deleteSecureBackup,
    reset
  }
}
