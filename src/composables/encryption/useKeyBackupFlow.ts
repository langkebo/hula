import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useActionFeedback } from '@/composables/common/useActionFeedback'
import matrixCryptoService from '@/services/matrix/crypto/MatrixCryptoService'
import type {
  BackupVersionInfo,
  ExportResult,
  ImportResult,
  VerifyResult
} from '@/services/matrix/crypto/MatrixKeyBackupService'
import { matrixKeyBackupService } from '@/services/matrix/crypto/MatrixKeyBackupService'
import { createLogger } from '@/utils/Logger'

const logger = createLogger('useKeyBackupFlow')

type KeyBackupStep = 'intro' | 'create' | 'showKey' | 'verify' | 'restore' | 'success' | 'error'
type KeyBackupMode = 'setup' | 'restore'

interface BackupInfoLike {
  version?: string
  algorithm?: string
  count?: number
  etag?: string
}

interface UseKeyBackupFlowOptions {
  mode?: KeyBackupMode
}

/**
 * 跨端密钥备份流程 composable
 * - setup: 经 CryptoService.setupKeyBackup(passphrase) 启用备份
 * - restore: 经 KeyBackupService.restoreKeyBackup(version) 按 version 恢复
 * - verify: 经 KeyBackupService.verifyBackup(version) 校验
 * 复用 PC KeyBackupSetupDialog/KeyBackupRestoreDialog 与移动端 EncryptionSettings 流程
 */
export function useKeyBackupFlow(options: UseKeyBackupFlowOptions = {}) {
  const { t } = useI18n()
  const { showFeedback } = useActionFeedback()

  const mode = ref<KeyBackupMode>(options.mode ?? 'setup')
  const step = ref<KeyBackupStep>('intro')
  const loading = ref(false)
  const recoveryKey = ref<string>('')
  const passphrase = ref<string>('')
  const verifyInput = ref<string>('')
  const currentVersion = ref<string>('')
  const backupInfo = ref<BackupInfoLike | null>(null)
  const backupVersions = ref<BackupVersionInfo[]>([])
  const lastImportResult = ref<ImportResult | null>(null)
  const lastVerifyResult = ref<VerifyResult | null>(null)
  const errorMessage = ref<string | null>(null)

  const hasBackup = computed(() => !!backupInfo.value?.version)
  const isFinished = computed(() => step.value === 'success' || step.value === 'error')

  const refreshStatus = async (): Promise<void> => {
    try {
      const info = (await matrixKeyBackupService.checkKeyBackup()) as BackupInfoLike | null
      backupInfo.value = info
      currentVersion.value = info?.version ?? ''
    } catch (err) {
      logger.warn('checkKeyBackup failed', err)
    }
  }

  const createBackup = async (): Promise<boolean> => {
    if (loading.value) return false
    loading.value = true
    step.value = 'create'
    errorMessage.value = null
    try {
      // CryptoService.setupKeyBackup 内部封装 createKeyBackupVersion 等细节
      await matrixCryptoService?.setupKeyBackup?.(passphrase.value || '')
      // 创建成功后获取最新 version
      await refreshStatus()
      step.value = 'showKey'
      return true
    } catch (err) {
      logger.error('createBackup failed', err)
      errorMessage.value = t('encryption.backup.failed')
      step.value = 'error'
      showFeedback(errorMessage.value, 'error')
      return false
    } finally {
      loading.value = false
    }
  }

  const confirmKeySaved = async (): Promise<boolean> => {
    if (!hasBackup.value) {
      return false
    }
    step.value = 'verify'
    return true
  }

  const verifyBackup = async (): Promise<boolean> => {
    if (!currentVersion.value) {
      errorMessage.value = t('encryption.backup.verify_failed')
      return false
    }
    if (loading.value) return false
    loading.value = true
    try {
      const result = await matrixKeyBackupService.verifyBackup(currentVersion.value)
      lastVerifyResult.value = result
      if (result?.valid) {
        step.value = 'success'
        showFeedback(t('encryption.backup.create_success'), 'success')
        await refreshStatus()
        return true
      }
      errorMessage.value = t('encryption.backup.verify_failed')
      return false
    } catch (err) {
      logger.error('verifyBackup failed', err)
      errorMessage.value = t('encryption.backup.verify_failed')
      showFeedback(errorMessage.value, 'error')
      return false
    } finally {
      loading.value = false
    }
  }

  const restoreFromBackup = async (version?: string): Promise<boolean> => {
    const targetVersion = version ?? currentVersion.value
    if (!targetVersion) {
      errorMessage.value = t('encryption.backup.failed')
      showFeedback(errorMessage.value, 'error')
      return false
    }
    if (loading.value) return false
    loading.value = true
    step.value = 'restore'
    errorMessage.value = null
    try {
      const result = await matrixKeyBackupService.restoreKeyBackup(targetVersion)
      lastImportResult.value = result as unknown as ImportResult
      step.value = 'success'
      const imported = (result as { imported?: number })?.imported ?? 0
      const total = (result as { total?: number })?.total ?? 0
      showFeedback(t('encryption.backup.restore_success', { imported, total }), 'success')
      return true
    } catch (err) {
      logger.error('restoreFromBackup failed', err)
      errorMessage.value = t('encryption.backup.failed')
      step.value = 'error'
      showFeedback(errorMessage.value, 'error')
      return false
    } finally {
      loading.value = false
    }
  }

  const importFromRecoveryKey = async (recoveryKeyInput: string): Promise<boolean> => {
    if (loading.value) return false
    loading.value = true
    step.value = 'restore'
    errorMessage.value = null
    try {
      // 用 recovery key 直接 import(适用于换设备场景)
      const result = await matrixKeyBackupService.importKeys({
        recoveryKey: recoveryKeyInput
      } as unknown as ExportResult)
      lastImportResult.value = result
      step.value = 'success'
      // ImportResult 真实结构为 {count, failed, total}
      const imported = result?.count ?? 0
      const total = result?.total ?? 0
      showFeedback(t('encryption.backup.restore_success', { imported, total }), 'success')
      return true
    } catch (err) {
      logger.error('importFromRecoveryKey failed', err)
      errorMessage.value = t('encryption.backup.failed')
      step.value = 'error'
      showFeedback(errorMessage.value, 'error')
      return false
    } finally {
      loading.value = false
    }
  }

  const deleteBackupVersion = async (version: string): Promise<boolean> => {
    if (loading.value) return false
    loading.value = true
    try {
      await matrixKeyBackupService.deleteKeyBackupVersion(version)
      showFeedback(t('encryption.backup.versions.delete_success'), 'success')
      await refreshStatus()
      return true
    } catch (err) {
      logger.error('deleteBackupVersion failed', err)
      showFeedback(t('encryption.backup.versions.delete_failed'), 'error')
      return false
    } finally {
      loading.value = false
    }
  }

  const reset = (): void => {
    step.value = 'intro'
    recoveryKey.value = ''
    passphrase.value = ''
    verifyInput.value = ''
    errorMessage.value = null
  }

  return {
    // state
    mode,
    step,
    loading,
    recoveryKey,
    passphrase,
    verifyInput,
    currentVersion,
    backupInfo,
    backupVersions,
    lastImportResult,
    lastVerifyResult,
    errorMessage,
    // getters
    hasBackup,
    isFinished,
    // actions
    refreshStatus,
    createBackup,
    confirmKeySaved,
    verifyBackup,
    restoreFromBackup,
    importFromRecoveryKey,
    deleteBackupVersion,
    reset
  }
}
