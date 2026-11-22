import type { UploadCustomRequestOptions } from 'naive-ui'
import { computed, onMounted, reactive, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useActionFeedback } from '@/composables/common/useActionFeedback'
import { useEncryption } from '@/composables/encryption'
import { matrixKeyBackupService } from '@/services/matrix'
import { matrixClientService } from '@/services/matrix/MatrixClientService'
import { createLogger } from '@/utils/Logger'
import { useTimerManager } from '@/utils/TimerManager'

const logger = createLogger('KeyBackupRestore')

interface KeyBackupRestoreOptions {
  /** 关闭对话框（由宿主组件把 `show` 置 false） */
  close: () => void
  /** 恢复成功后的宿主回调 */
  notifySuccess: () => void
}

/**
 * 密钥备份恢复对话框的状态与行为。
 * 从 `KeyBackupRestoreDialog.vue` 下沉，供纯 UI 壳复用，逻辑不进入模板。
 */
export function useKeyBackupRestore(options: KeyBackupRestoreOptions) {
  const timerManager = useTimerManager()
  const { t } = useI18n()
  const { showFeedback } = useActionFeedback()
  const encryption = useEncryption()

  const loading = ref(false)
  const restoreProgress = ref<number | null>(null)
  const restoreResult = ref<{ success: boolean; message: string } | null>(null)
  const activeTab = ref('recoveryKey')

  // Version selection
  const backupVersions = ref<Array<{ version: string; algorithm: string }>>([])
  const selectedVersion = ref<string | null>(null)
  // 备份信息读取失败：显式提示并可重试，不静默退化为「无版本可选」
  const backupInfoError = ref(false)

  const versionOptions = computed(() =>
    backupVersions.value.map((v) => ({
      label: `${t('encryption.backup_restore_dialog.version_label')} ${v.version} (${v.algorithm})`,
      value: v.version
    }))
  )

  // Recovery key form
  const formData = reactive({
    recoveryKey: ''
  })

  // Key file
  const fileName = ref('')
  const fileContent = ref('')

  // Passphrase form
  const passphraseData = reactive({
    passphrase: ''
  })

  // Advanced options
  const advancedData = reactive({
    roomId: '',
    sessionId: ''
  })

  const canRestore = computed(() => {
    if (loading.value) return false
    if (activeTab.value === 'recoveryKey') return !!formData.recoveryKey.trim()
    if (activeTab.value === 'keyFile') return !!fileContent.value.trim()
    if (activeTab.value === 'passphrase') return !!passphraseData.passphrase.trim()
    return false
  })

  onMounted(async () => {
    await loadBackupVersions()
  })

  async function loadBackupVersions() {
    backupInfoError.value = false
    try {
      // P0-#3：对话框可能在客户端就绪前打开（如设置页冷启动），先等待就绪
      await matrixClientService.waitForClientReady({ timeoutMs: 10000 })
      const info = await encryption.getKeyBackupInfo()
      if (info) {
        // Single version: auto-select and hide selector
        const versionInfo = {
          version: String(info.version ?? '1'),
          algorithm: String(info.algorithm ?? 'unknown')
        }
        backupVersions.value = [versionInfo]
        selectedVersion.value = versionInfo.version
      }
    } catch (error) {
      logger.warn('Failed to load backup info:', error)
      backupInfoError.value = true
    }
  }

  function handleFileUpload({ file }: UploadCustomRequestOptions) {
    const rawFile = file.file
    if (!rawFile) return

    fileName.value = file.name
    const reader = new FileReader()
    reader.onload = (e) => {
      const content = e.target?.result
      if (typeof content === 'string') {
        fileContent.value = content.trim()
      } else {
        showFeedback(t('encryption.backup_restore_dialog.file_read_failed'), 'error')
      }
    }
    reader.onerror = () => {
      showFeedback(t('encryption.backup_restore_dialog.file_read_failed'), 'error')
    }
    reader.readAsText(rawFile)
  }

  function clearFile() {
    fileName.value = ''
    fileContent.value = ''
  }

  function handleCancel() {
    options.close()
    resetState()
  }

  function resetState() {
    formData.recoveryKey = ''
    passphraseData.passphrase = ''
    fileName.value = ''
    fileContent.value = ''
    advancedData.roomId = ''
    advancedData.sessionId = ''
    loading.value = false
    restoreProgress.value = null
    restoreResult.value = null
  }

  async function handleRestore() {
    if (activeTab.value === 'recoveryKey') {
      const recoveryKey = formData.recoveryKey.trim()
      if (!recoveryKey) {
        showFeedback(t('setting.encryption.recovery_key_required'), 'warning')
        return
      }
      await runRestore(() => encryption.restoreFromBackup(recoveryKey))
    } else if (activeTab.value === 'keyFile') {
      const recoveryKey = fileContent.value.trim()
      if (!recoveryKey) {
        showFeedback(t('encryption.backup_restore_dialog.file_required'), 'warning')
        return
      }
      await runRestore(() => encryption.restoreFromBackup(recoveryKey))
    } else if (activeTab.value === 'passphrase') {
      const passphrase = passphraseData.passphrase.trim()
      if (!passphrase) {
        showFeedback(t('encryption.backup_restore_dialog.passphrase_required'), 'warning')
        return
      }
      await runRestore(() => encryption.restoreFromBackupWithPassphrase(passphrase))
    }
  }

  async function runRestore(restoreOperation: () => Promise<{ imported: number; total: number }>) {
    loading.value = true
    restoreProgress.value = 0
    restoreResult.value = null
    let progressInterval: number | null = null

    try {
      progressInterval = timerManager.setInterval(() => {
        if (restoreProgress.value !== null && restoreProgress.value < 90) {
          restoreProgress.value += 10
        }
      }, 200)

      const result = await restoreOperation()

      timerManager.clearInterval(progressInterval)
      restoreProgress.value = 100

      restoreResult.value = {
        success: true,
        message: t('encryption.backup_restore_dialog.restore_result_success', { imported: result.imported })
      }

      showFeedback(t('setting.encryption.restore_success'), 'success')

      timerManager.setTimeout(() => {
        options.close()
        resetState()
        options.notifySuccess()
      }, 1500)
    } catch (error) {
      logger.error('Failed to restore from backup:', error)
      restoreProgress.value = null
      restoreResult.value = {
        success: false,
        message: t('encryption.backup_restore_dialog.restore_result_failed')
      }
      showFeedback(t('setting.encryption.restore_backup_failed'), 'error')
    } finally {
      if (progressInterval !== null) {
        timerManager.clearInterval(progressInterval)
      }
      loading.value = false
    }
  }

  async function handleRoomRecover() {
    const version = selectedVersion.value
    const roomId = advancedData.roomId.trim()
    if (!version || !roomId) {
      showFeedback(t('encryption.backup_restore_dialog.room_id_required'), 'warning')
      return
    }

    loading.value = true
    restoreResult.value = null
    try {
      await matrixKeyBackupService.recoverRoomKeys(version, roomId)
      restoreResult.value = {
        success: true,
        message: t('encryption.backup_restore_dialog.room_recover_success', { roomId })
      }
      showFeedback(t('setting.encryption.restore_success'), 'success')
    } catch (error) {
      logger.error('Failed to recover room keys:', error)
      restoreResult.value = {
        success: false,
        message: t('encryption.backup_restore_dialog.room_recover_failed')
      }
      showFeedback(t('setting.encryption.restore_backup_failed'), 'error')
    } finally {
      loading.value = false
    }
  }

  async function handleSessionRecover() {
    const version = selectedVersion.value
    const roomId = advancedData.roomId.trim()
    const sessionId = advancedData.sessionId.trim()
    if (!version || !roomId || !sessionId) {
      showFeedback(t('encryption.backup_restore_dialog.session_id_required'), 'warning')
      return
    }

    loading.value = true
    restoreResult.value = null
    try {
      await matrixKeyBackupService.recoverSessionKey(version, roomId, sessionId)
      restoreResult.value = {
        success: true,
        message: t('encryption.backup_restore_dialog.session_recover_success')
      }
      showFeedback(t('setting.encryption.restore_success'), 'success')
    } catch (error) {
      logger.error('Failed to recover session key:', error)
      restoreResult.value = {
        success: false,
        message: t('encryption.backup_restore_dialog.session_recover_failed')
      }
      showFeedback(t('setting.encryption.restore_backup_failed'), 'error')
    } finally {
      loading.value = false
    }
  }

  return {
    loading,
    restoreProgress,
    restoreResult,
    activeTab,
    backupVersions,
    selectedVersion,
    backupInfoError,
    versionOptions,
    formData,
    fileName,
    fileContent,
    passphraseData,
    advancedData,
    canRestore,
    loadBackupVersions,
    handleFileUpload,
    clearFile,
    handleCancel,
    handleRestore,
    handleRoomRecover,
    handleSessionRecover
  }
}
