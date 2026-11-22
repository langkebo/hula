import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useActionFeedback } from '@/composables/common/useActionFeedback'
import { useEncryption } from '@/composables/encryption'
import { matrixCryptoService } from '@/services/matrix/crypto/MatrixCryptoService'
import type { VerifyResult } from '@/services/matrix/crypto/MatrixKeyBackupService'
import { matrixKeyBackupService } from '@/services/matrix/crypto/MatrixKeyBackupService'
import { matrixClientService } from '@/services/matrix/MatrixClientService'
import type { GeneratedSecretStorageKey } from '@/types/matrix-extensions'
import { createLogger } from '@/utils/Logger'

const logger = createLogger('SecureBackupDialog')

/** 备份对话框内的三个视图：状态、创建、恢复 */
type SecureBackupTabName = 'status' | 'create' | 'restore'

interface UseSecureBackupDialogOptions {
  /** 对话框是否可见（由宿主 props 提供） */
  isOpen: () => boolean
  /** 关闭对话框（写回宿主 v-model） */
  close: () => void
  /** 创建成功后的回调 */
  onSuccess: () => void
}

/**
 * SecureBackupDialog 的全部状态与动作。
 * 打开时拉取备份状态，关闭时重置；创建流程包含「生成恢复密钥 -> 写入备份 -> 成功」三步。
 */
export function useSecureBackupDialog(options: UseSecureBackupDialogOptions) {
  const { t } = useI18n()
  const { showFeedback } = useActionFeedback()
  const encryption = useEncryption()

  const activeTab = ref<SecureBackupTabName>('status')

  // Loading states
  const loading = ref(false)
  const statusLoading = ref(false)
  const restoreLoading = ref(false)
  // 读取失败不能落成「未开启备份」，否则用户会误以为可以重新创建覆盖
  const statusLoadFailed = ref(false)

  // Backup status data
  const backupExists = ref(false)
  const backupData = ref<{
    id: string
    algorithm: string
    keyCount: number | null
  }>({ id: '', algorithm: '', keyCount: null })

  // Create flow
  const createStep = ref(0)
  const recoveryKey = ref('')
  const keySaved = ref(false)
  const currentPassword = ref('')
  const generatedRecoveryKey = ref<GeneratedSecretStorageKey | null>(null)

  // Restore flow
  const restoreRecoveryKey = ref('')
  const restoreResult = ref<{ success: boolean; imported: number } | null>(null)

  // Verify result
  const verifyResult = ref<VerifyResult | null>(null)

  const dialogTitle = computed(() => {
    switch (activeTab.value) {
      case 'create':
        return t('encryption.secure_backup.create_title')
      case 'restore':
        return t('encryption.secure_backup.restore_title')
      default:
        return t('encryption.secure_backup.dialog_title')
    }
  })

  async function loadBackupStatus() {
    statusLoading.value = true
    statusLoadFailed.value = false
    try {
      // P0-#3：对话框在冷启动时可能早于客户端就绪打开，先等待就绪再查备份状态
      await matrixClientService.waitForClientReady({ timeoutMs: 10000 })
      const info = await encryption.getKeyBackupInfo()
      if (info?.version) {
        backupExists.value = true
        backupData.value = {
          id: info.version,
          algorithm: info.algorithm || '',
          keyCount: info.count !== undefined ? info.count : null
        }
      } else {
        backupExists.value = false
      }
    } catch {
      statusLoadFailed.value = true
      backupExists.value = false
    } finally {
      statusLoading.value = false
    }
  }

  function resetState() {
    activeTab.value = 'status'
    createStep.value = 0
    recoveryKey.value = ''
    keySaved.value = false
    currentPassword.value = ''
    generatedRecoveryKey.value = null
    restoreRecoveryKey.value = ''
    restoreResult.value = null
    verifyResult.value = null
    loading.value = false
    restoreLoading.value = false
    statusLoadFailed.value = false
  }

  function handleBackToStatus() {
    activeTab.value = 'status'
    createStep.value = 0
    recoveryKey.value = ''
    keySaved.value = false
    currentPassword.value = ''
    generatedRecoveryKey.value = null
  }

  async function handleCreateBackup() {
    if (!currentPassword.value.trim()) {
      showFeedback(t('setting.account.current_password_required'), 'warning')
      return
    }

    loading.value = true
    try {
      await matrixClientService.waitForClientReady({ timeoutMs: 10000 })

      // Check if we need to generate key here instead of in watch (better error handling)
      if (!generatedRecoveryKey.value) {
        const generatedKey = await matrixCryptoService.createRecoveryKeyFromPassphrase()
        if (!generatedKey?.encodedPrivateKey) {
          throw new Error('Failed to generate recovery key')
        }
        generatedRecoveryKey.value = generatedKey
        recoveryKey.value = generatedKey.encodedPrivateKey
      }

      await encryption.setupKeyBackup({
        password: currentPassword.value.trim(),
        generatedKey: generatedRecoveryKey.value
      })

      await loadBackupStatus()
      createStep.value = 2
      showFeedback(t('encryption.secure_backup.create_success'), 'success')
    } catch (err) {
      logger.error('Failed to create secure backup:', err)
      showFeedback(t('encryption.secure_backup.create_failed'), 'error')
    } finally {
      loading.value = false
    }
  }

  function handleCreateDone() {
    options.close()
    resetState()
    options.onSuccess()
  }

  function copyKey() {
    navigator.clipboard
      .writeText(recoveryKey.value)
      .then(() => showFeedback(t('encryption.backup.copy_success'), 'success'))
      .catch(() => showFeedback(t('encryption.secure_backup.copy_failed'), 'error'))
  }

  function downloadKey() {
    const blob = new Blob([recoveryKey.value], { type: 'text/plain' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `tjg-secure-backup-key-${Date.now()}.txt`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
    showFeedback(t('encryption.backup.download_success'), 'success')
  }

  async function handleRestore() {
    const key = restoreRecoveryKey.value.trim()
    if (!key) {
      showFeedback(t('setting.encryption.recovery_key_required'), 'warning')
      return
    }

    restoreLoading.value = true
    restoreResult.value = null
    try {
      const result = await encryption.restoreFromBackup(key)
      restoreResult.value = { success: true, imported: result.imported ?? 0 }
      showFeedback(t('encryption.secure_backup.restore_success'), 'success')
    } catch (err) {
      logger.error('Failed to restore from secure backup:', err)
      restoreResult.value = { success: false, imported: 0 }
      showFeedback(t('encryption.secure_backup.restore_failed'), 'error')
    } finally {
      restoreLoading.value = false
    }
  }

  async function handleVerify() {
    if (!backupData.value.id) {
      showFeedback(t('encryption.secure_backup.no_backup_id'), 'warning')
      return
    }

    loading.value = true
    try {
      const result = await matrixKeyBackupService.verifyBackup(backupData.value.id)
      verifyResult.value = {
        valid: result.valid,
        algorithm: result.algorithm || backupData.value.algorithm,
        // auth_data 契约随备份算法变化；这里保留空对象兜底，运行时行为与旧实现一致
        auth_data: result.auth_data || ({} as VerifyResult['auth_data']),
        key_count: backupData.value.keyCount ?? 0,
        signatures: result.signatures || {}
      }
      if (result.valid) {
        showFeedback(t('encryption.secure_backup.verify_valid'), 'success')
      } else {
        showFeedback(t('encryption.secure_backup.verify_invalid'), 'warning')
      }
    } catch (err) {
      logger.error('Failed to verify secure backup:', err)
      showFeedback(t('encryption.secure_backup.verify_failed'), 'error')
    } finally {
      loading.value = false
    }
  }

  async function handleAddKeys() {
    showFeedback(t('encryption.secure_backup.add_keys_failed'), 'warning')
    // We no longer manually add keys to secure backup in the new rust-crypto high level API
    // It's handled automatically by the Rust Crypto machine
  }

  async function handleDelete() {
    if (!backupData.value.id) {
      showFeedback(t('encryption.secure_backup.no_backup_id'), 'warning')
      return
    }

    loading.value = true
    try {
      await encryption.deleteKeyBackup()
      backupExists.value = false
      backupData.value = { id: '', algorithm: '', keyCount: null }
      verifyResult.value = null
      showFeedback(t('encryption.secure_backup.delete_success'), 'success')
      await loadBackupStatus()
    } catch (err) {
      logger.error('Failed to delete secure backup:', err)
      showFeedback(t('encryption.secure_backup.delete_failed'), 'error')
    } finally {
      loading.value = false
    }
  }

  // Load backup status when dialog opens
  watch(
    () => options.isOpen(),
    (newVal) => {
      if (newVal) {
        void loadBackupStatus()
      } else {
        resetState()
      }
    },
    { immediate: true }
  )

  // When user enters create flow step 1, generate a recovery key to display
  watch(createStep, async (newStep) => {
    if (activeTab.value === 'create' && newStep === 1 && !recoveryKey.value) {
      try {
        loading.value = true
        const generatedKey = await matrixCryptoService.createRecoveryKeyFromPassphrase()
        if (generatedKey?.encodedPrivateKey) {
          generatedRecoveryKey.value = generatedKey
          recoveryKey.value = generatedKey.encodedPrivateKey
        }
      } catch (e) {
        logger.error('Failed to generate key', e)
        showFeedback(t('encryption.secure_backup.create_failed'), 'error')
      } finally {
        loading.value = false
      }
    }
  })

  return {
    activeTab,
    loading,
    statusLoading,
    restoreLoading,
    statusLoadFailed,
    backupExists,
    backupData,
    createStep,
    recoveryKey,
    keySaved,
    currentPassword,
    restoreRecoveryKey,
    restoreResult,
    verifyResult,
    dialogTitle,
    loadBackupStatus,
    resetState,
    handleBackToStatus,
    handleCreateBackup,
    handleCreateDone,
    copyKey,
    downloadKey,
    handleRestore,
    handleVerify,
    handleAddKeys,
    handleDelete
  }
}
