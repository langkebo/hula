import { computed, onUnmounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useActionFeedback } from '@/composables/common/useActionFeedback'
import { matrixVerificationService } from '@/services/matrix/crypto/MatrixVerificationService'
import { createLogger } from '@/utils/Logger'

const logger = createLogger('useDeviceVerifyFlow')

export type VerificationStep =
  | 'intro'
  | 'pending'
  | 'showKey'
  | 'showQr'
  | 'scanQr'
  | 'success'
  | 'rejected'
  | 'cancelled'
  | 'failed'

export interface PendingRequest {
  transactionId: string
  userId: string
  deviceId: string
  methods: string[]
  timestamp: number
}

export interface UseDeviceVerifyFlowOptions {
  userId?: string
  deviceId?: string
  transactionId?: string
}

/**
 * 跨端设备验证流程 composable
 * PC 端 DeviceVerifyDialog.vue 与移动端 MobileDeviceVerifyDialog.vue 共用此逻辑
 */
export function useDeviceVerifyFlow(options: UseDeviceVerifyFlowOptions = {}) {
  const { t } = useI18n()
  const { showFeedback } = useActionFeedback()

  const step = ref<VerificationStep>('intro')
  const loading = ref(false)
  const emojis = ref<Array<{ emoji: string; description: string }>>([])
  const pendingRequests = ref<PendingRequest[]>([])
  const currentTransactionId = ref<string | null>(options.transactionId ?? null)
  const targetUserId = ref<string>(options.userId ?? '')
  const targetDeviceId = ref<string>(options.deviceId ?? '')
  const errorMessage = ref<string | null>(null)

  const isIdle = computed(() => step.value === 'intro')
  const isVerifying = computed(() => ['pending', 'showKey', 'showQr', 'scanQr'].includes(step.value))
  const isFinished = computed(() => ['success', 'rejected', 'cancelled', 'failed'].includes(step.value))

  const refreshPendingRequests = async (): Promise<void> => {
    try {
      const list = (await matrixVerificationService.getPendingVerifications?.()) as unknown as PendingRequest[]
      pendingRequests.value = list ?? []
    } catch (err) {
      logger.warn('Failed to load pending verifications', err)
    }
  }

  const startSas = async (userId?: string, deviceId?: string): Promise<boolean> => {
    const uid = userId ?? targetUserId.value
    const did = deviceId ?? targetDeviceId.value
    if (!uid || !did) {
      showFeedback(t('verification.errors.start_failed'), 'error')
      return false
    }

    loading.value = true
    step.value = 'pending'
    errorMessage.value = null

    try {
      const txnId = await matrixVerificationService.startSasVerification(uid, did)
      currentTransactionId.value = txnId
      targetUserId.value = uid
      targetDeviceId.value = did
      step.value = 'showKey'
      return true
    } catch (err) {
      logger.error('startSas failed', err)
      errorMessage.value = t('verification.errors.start_failed')
      step.value = 'failed'
      showFeedback(errorMessage.value, 'error')
      return false
    } finally {
      loading.value = false
    }
  }

  const acceptVerification = async (transactionId: string): Promise<boolean> => {
    loading.value = true
    try {
      await matrixVerificationService.acceptVerification(transactionId)
      currentTransactionId.value = transactionId
      step.value = 'showKey'
      return true
    } catch (err) {
      logger.error('acceptVerification failed', err)
      showFeedback(t('verification.errors.accept_failed'), 'error')
      step.value = 'failed'
      return false
    } finally {
      loading.value = false
    }
  }

  const confirmSas = async (match: boolean): Promise<boolean> => {
    if (!currentTransactionId.value) {
      return false
    }
    loading.value = true
    try {
      if (match) {
        // SDK confirmSas 仅表示"已确认匹配",无 match 参数
        await matrixVerificationService.confirmSas(currentTransactionId.value)
        step.value = 'success'
      } else {
        // 不匹配时以 mismatch 原因取消
        await matrixVerificationService.cancelVerification(currentTransactionId.value, 'mismatch')
        step.value = 'rejected'
      }
      return true
    } catch (err) {
      logger.error('confirmSas failed', err)
      showFeedback(t('verification.errors.confirm_failed'), 'error')
      step.value = 'failed'
      return false
    } finally {
      loading.value = false
    }
  }

  const cancelVerification = async (reason: string = 'user_cancelled'): Promise<void> => {
    if (!currentTransactionId.value) {
      step.value = 'cancelled'
      return
    }
    try {
      await matrixVerificationService.cancelVerification(currentTransactionId.value, reason)
    } catch (err) {
      logger.warn('cancelVerification failed', err)
    } finally {
      step.value = 'cancelled'
      currentTransactionId.value = null
    }
  }

  const reset = (): void => {
    step.value = 'intro'
    emojis.value = []
    errorMessage.value = null
    currentTransactionId.value = options.transactionId ?? null
    targetUserId.value = options.userId ?? ''
    targetDeviceId.value = options.deviceId ?? ''
  }

  onUnmounted(() => {
    if (isVerifying.value && currentTransactionId.value) {
      void cancelVerification('component_unmounted').catch(() => {
        /* swallow */
      })
    }
  })

  return {
    // state
    step,
    loading,
    emojis,
    pendingRequests,
    currentTransactionId,
    targetUserId,
    targetDeviceId,
    errorMessage,
    // getters
    isIdle,
    isVerifying,
    isFinished,
    // actions
    refreshPendingRequests,
    startSas,
    acceptVerification,
    confirmSas,
    cancelVerification,
    reset
  }
}
