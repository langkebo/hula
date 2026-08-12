import { computed, ref, type WritableComputedRef, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useActionFeedback } from '@/composables/common/useActionFeedback'
import { useEncryption } from '@/composables/encryption'
import type { VerificationRequest } from '@/services/matrix/crypto/MatrixVerificationService'
import { createLogger } from '@/utils/Logger'

const logger = createLogger('DeviceVerify')

/** 设备验证对话框步骤状态机 */
export type DeviceVerifyStep = 'intro' | 'pendingList' | 'showKey' | 'showQr' | 'scanQr' | 'success' | 'rejected'

export interface DeviceVerifyDialogProps {
  show: boolean
  deviceId?: string
  deviceName?: string
  inboundRequest?: VerificationRequest | null
  initialMode?: 'sas' | 'qr_show' | 'qr_scan'
}

export type DeviceVerifyDialogEmit = {
  (e: 'update:show', value: boolean): void
  (e: 'success'): void
}

interface UseDeviceVerifyDialogOptions {
  props: Readonly<DeviceVerifyDialogProps>
  emit: DeviceVerifyDialogEmit
  visible: WritableComputedRef<boolean>
}

/**
 * PC 端 DeviceVerifyDialog 状态机 composable
 * 封装 SAS / QR 验证流程：request → accept → show SAS → confirm → done
 * 通过 useEncryption 服务层调用 Matrix，不直接依赖 SDK
 */
export function useDeviceVerifyDialog({ props, emit, visible }: UseDeviceVerifyDialogOptions) {
  const { t } = useI18n()
  const { showFeedback } = useActionFeedback()
  const encryption = useEncryption()

  const step = ref<DeviceVerifyStep>('intro')
  const loading = ref(false)
  const fingerprint = ref('')
  const transactionId = ref<string | null>(null)
  const targetUserId = ref<string>('')
  const targetDeviceId = ref<string>('')
  const qrCodeData = ref('')
  const qrCodeToScan = ref('')
  const cancelReason = ref('')
  const showCancelReason = ref(false)
  const pendingVerifications = ref<VerificationRequest[]>([])

  const currentStepIndex = computed(() => {
    switch (step.value) {
      case 'intro':
      case 'pendingList':
        return 1
      case 'showKey':
      case 'showQr':
      case 'scanQr':
        return 2
      case 'success':
      case 'rejected':
        return 3
      default:
        return 1
    }
  })

  const fingerprintChunks = computed(() => {
    if (!fingerprint.value) return []
    return fingerprint.value.match(/.{1,4}/g) || []
  })

  function resetState(initialInboundRequest: VerificationRequest | null = null) {
    step.value = 'intro'
    fingerprint.value = ''
    loading.value = false
    qrCodeData.value = ''
    qrCodeToScan.value = ''
    cancelReason.value = ''
    showCancelReason.value = false
    pendingVerifications.value = []

    if (initialInboundRequest) {
      transactionId.value = initialInboundRequest.transactionId
      targetUserId.value = initialInboundRequest.userId
      targetDeviceId.value = initialInboundRequest.deviceId
    } else {
      transactionId.value = null
      targetUserId.value = encryption.getCurrentSessionContext().userId ?? ''
      targetDeviceId.value = props.deviceId || encryption.getCurrentSessionContext().deviceId || ''
    }
  }

  watch(
    () => props.inboundRequest,
    (newVal) => {
      resetState(newVal ?? null)
    },
    { immediate: true }
  )

  watch(
    () => [props.show, props.initialMode] as const,
    async ([show]) => {
      if (show) {
        resetState(props.inboundRequest || null)
        await loadPendingVerifications()
        if (props.initialMode === 'qr_show') {
          await openQrShow()
        } else if (props.initialMode === 'qr_scan') {
          openQrScan()
        }
      }
    },
    { immediate: true }
  )

  async function loadPendingVerifications() {
    try {
      pendingVerifications.value = await encryption.getPendingVerifications()
    } catch (err) {
      logger.error('Failed to load pending verifications:', err)
      pendingVerifications.value = []
    }
  }

  function openPendingList() {
    step.value = 'pendingList'
    loadPendingVerifications()
  }

  function backToIntro() {
    step.value = 'intro'
  }

  async function acceptPendingRequest(req: VerificationRequest) {
    loading.value = true
    try {
      await encryption.acceptVerification(req.transactionId)
      transactionId.value = req.transactionId
      targetUserId.value = req.userId
      targetDeviceId.value = req.deviceId
      fingerprint.value =
        (await encryption.getDeviceFingerprint(req.userId, req.deviceId)) ||
        t('setting.device_verify_dialog.fingerprint_unavailable')
      step.value = 'showKey'
      showFeedback(t('setting.device_verify_dialog.accepted_success'), 'success')
      await loadPendingVerifications()
    } catch (error) {
      logger.error('Failed to accept verification request:', error)
      showFeedback(t('setting.device_verify_dialog.accepted_failed'), 'error')
    } finally {
      loading.value = false
    }
  }

  async function declinePendingRequest(txId: string) {
    loading.value = true
    try {
      await encryption.cancelVerification(txId, 'declined')
      showFeedback(t('setting.device_verify_dialog.declined_success'), 'success')
      await loadPendingVerifications()
    } catch (error) {
      logger.error('Failed to decline verification request:', error)
      showFeedback(t('setting.device_verify_dialog.declined_failed'), 'error')
    } finally {
      loading.value = false
    }
  }

  async function handleDecline() {
    if (!props.inboundRequest) return
    loading.value = true
    try {
      await encryption.cancelVerification(props.inboundRequest.transactionId, 'declined')
      showFeedback(t('setting.device_verify_dialog.declined_success'), 'success')
      visible.value = false
      resetState()
    } catch (error) {
      logger.error('Failed to decline verification request:', error)
      showFeedback(t('setting.device_verify_dialog.declined_failed'), 'error')
    } finally {
      loading.value = false
    }
  }

  async function cancelActiveVerification(reason: string) {
    if (transactionId.value) {
      try {
        await encryption.cancelVerification(transactionId.value, reason)
      } catch (err) {
        logger.error('Failed to cancel verification:', err)
      }
    }
  }

  async function handleCancel() {
    await cancelActiveVerification('User cancelled verification')
    visible.value = false
    resetState()
  }

  async function handleCancelWithReason() {
    const reason = cancelReason.value.trim() || 'User cancelled verification'
    loading.value = true
    try {
      await cancelActiveVerification(reason)
      showFeedback(t('setting.device_verify_dialog.cancel_success'), 'success')
      visible.value = false
      resetState()
    } catch (error) {
      logger.error('Failed to cancel verification:', error)
      showFeedback(t('setting.device_verify_dialog.cancel_failed'), 'error')
    } finally {
      loading.value = false
    }
  }

  function hideCancelReason() {
    showCancelReason.value = false
    cancelReason.value = ''
  }

  function handleClose() {
    visible.value = false
    resetState()
  }

  async function openQrShow() {
    loading.value = true

    try {
      const qrPayload = await encryption.getQrCodeShow()
      if (!qrPayload?.qr_code) {
        throw new Error('QR code unavailable')
      }

      qrCodeData.value = qrPayload.qr_code
      transactionId.value = qrPayload.transaction_id || transactionId.value
      step.value = 'showQr'
    } catch (error) {
      logger.warn('Failed to load QR verification payload:', error)
      showFeedback(t('setting.device_verify_dialog.qr_load_failed'), 'error')
    } finally {
      loading.value = false
    }
  }

  function openQrScan() {
    step.value = 'scanQr'
  }

  async function startVerification() {
    loading.value = true

    try {
      const sessionContext = encryption.getCurrentSessionContext()
      const currentUserId = sessionContext.userId
      const currentDeviceId = sessionContext.deviceId

      if (!currentUserId || !currentDeviceId) {
        throw new Error('Device context unavailable')
      }

      // If it's an inbound request, accept it and get the fingerprint
      if (transactionId.value) {
        await encryption.acceptVerification(transactionId.value)
        fingerprint.value =
          (await encryption.getDeviceFingerprint(targetUserId.value, targetDeviceId.value)) ||
          t('setting.device_verify_dialog.fingerprint_unavailable')
        step.value = 'showKey'
      } else {
        const txId = await encryption.startSasVerification(targetUserId.value, targetDeviceId.value)
        transactionId.value = txId
        fingerprint.value =
          (await encryption.getDeviceFingerprint(targetUserId.value, targetDeviceId.value)) ||
          t('setting.device_verify_dialog.fingerprint_unavailable')
        step.value = 'showKey'
      }
    } catch (error) {
      logger.warn('Failed to start/accept verification:', error)
      showFeedback(t('setting.device_verify_dialog.load_fingerprint_failed'), 'error')
      step.value = 'rejected'
    } finally {
      loading.value = false
    }
  }

  async function submitQrScan() {
    const rawQrCode = qrCodeToScan.value.trim()
    if (!rawQrCode) {
      showFeedback(t('setting.device_verify_dialog.scan_qr_required'), 'warning')
      return
    }

    loading.value = true

    try {
      const success = await encryption.scanQrCode(rawQrCode)
      if (!success) {
        throw new Error('QR scan was not accepted')
      }

      step.value = 'success'
      emit('success')
      showFeedback(t('setting.device_verify_dialog.qr_scan_success'), 'success')
    } catch (error) {
      logger.error('QR verification failed:', error)
      showFeedback(t('setting.device_verify_dialog.qr_scan_failed'), 'error')
      step.value = 'rejected'
    } finally {
      loading.value = false
    }
  }

  async function handleConfirm() {
    loading.value = true

    try {
      if (!transactionId.value) {
        throw new Error('No active verification transaction to confirm.')
      }

      await encryption.confirmSas(transactionId.value)

      step.value = 'success'
      emit('success')
      showFeedback(t('setting.encryption.verify_success'), 'success')
    } catch (error) {
      logger.error('Device verification failed:', error)
      showFeedback(t('setting.device_verify_dialog.verify_failed'), 'error')
      step.value = 'rejected'
    } finally {
      loading.value = false
    }
  }

  async function handleReject() {
    await cancelActiveVerification('User rejected verification')
    step.value = 'rejected'
  }

  return {
    // state
    step,
    loading,
    fingerprint,
    transactionId,
    targetUserId,
    targetDeviceId,
    qrCodeData,
    qrCodeToScan,
    cancelReason,
    showCancelReason,
    pendingVerifications,
    // getters
    currentStepIndex,
    fingerprintChunks,
    // actions
    resetState,
    loadPendingVerifications,
    openPendingList,
    backToIntro,
    acceptPendingRequest,
    declinePendingRequest,
    handleDecline,
    handleCancel,
    handleCancelWithReason,
    hideCancelReason,
    handleClose,
    openQrShow,
    openQrScan,
    startVerification,
    submitQrScan,
    handleConfirm,
    handleReject
  }
}
