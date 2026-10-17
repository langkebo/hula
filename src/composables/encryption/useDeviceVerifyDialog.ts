import { computed, ref, type WritableComputedRef, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useActionFeedback } from '@/composables/common/useActionFeedback'
import { useEncryption } from '@/composables/encryption'
import { useDeviceVerifySasState } from '@/composables/encryption/useDeviceVerifySasState'
import type { VerificationTransaction } from '@/services/matrix/crypto/MatrixVerificationService'
import { matrixDeviceService } from '@/services/matrix/user/MatrixDeviceService'
import { createLogger } from '@/utils/Logger'

const logger = createLogger('DeviceVerify')

/** 设备验证对话框步骤状态机 */
export type DeviceVerifyStep = 'intro' | 'pendingList' | 'showKey' | 'success' | 'rejected'

/** 供 UI 选择的目标设备（跨用户验证时由 keys/query 拉取） */
export interface DeviceOption {
  deviceId: string
  displayName?: string | undefined
}

export interface DeviceVerifyDialogProps {
  show: boolean
  /**
   * 目标用户 MXID。
   *
   * - 缺省：验证**本账号**的其它设备（历史语义，`targetUserId` 取当前会话用户）
   * - 指定：验证**该用户**的设备（例如从消息锁徽章进入，验证发送方设备）
   */
  userId?: string
  deviceId?: string
  deviceName?: string
  inboundRequest?: VerificationTransaction | null
  initialMode?: 'sas'
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
 * 封装 SAS 验证流程：request → accept → show SAS → confirm → done
 * 通过 useEncryption 服务层调用 Matrix，不直接依赖 SDK
 */
export function useDeviceVerifyDialog({ props, emit, visible }: UseDeviceVerifyDialogOptions) {
  const { t } = useI18n()
  const { showFeedback } = useActionFeedback()
  const encryption = useEncryption()

  const step = ref<DeviceVerifyStep>('intro')
  const loading = ref(false)
  const sas = useDeviceVerifySasState({
    waitForSasView: (transactionId, options) => encryption.waitForSasView(transactionId, options),
    onUnavailable: () => {
      logger.error('SAS unavailable; abort (no fingerprint fallback)')
      showFeedback(t('setting.encryption.device_verify_dialog.sas_unavailable'), 'error')
      step.value = 'rejected'
    }
  })
  const { sasReady, sasEmojis, sasDecimal, sasConfirmed } = sas
  const transactionId = ref<string | null>(null)
  const targetUserId = ref<string>('')
  const targetDeviceId = ref<string>('')
  const cancelReason = ref('')
  const showCancelReason = ref(false)
  const pendingVerifications = ref<VerificationTransaction[]>([])
  /** 目标用户的可选设备（仅跨用户验证时填充） */
  const targetDevices = ref<DeviceOption[]>([])

  /**
   * 是否在验证「别人」的设备。
   *
   * 判定依据是目标用户与会话用户不同。该布尔量有两个必须生效的消费点：
   * 1. `resetState` 不能把本机 deviceId 兜底给他人（否则会向对方发出
   *    「用我的 deviceId 验证你」的无效事务）；
   * 2. 跨用户时必须先拉设备列表并让用户选，不能拿空 deviceId 发起请求。
   */
  const isVerifyingOtherUser = computed(() => {
    const selfUserId = encryption.getCurrentSessionContext().userId ?? ''
    return !!targetUserId.value && !!selfUserId && targetUserId.value !== selfUserId
  })

  const currentStepIndex = computed(() => {
    switch (step.value) {
      case 'intro':
      case 'pendingList':
        return 1
      case 'showKey':
        return 2
      case 'success':
      case 'rejected':
        return 3
      default:
        return 1
    }
  })

  function resetState(initialInboundRequest: VerificationTransaction | null = null) {
    step.value = 'intro'
    sas.reset()
    loading.value = false
    cancelReason.value = ''
    showCancelReason.value = false
    pendingVerifications.value = []
    targetDevices.value = []

    if (initialInboundRequest) {
      transactionId.value = initialInboundRequest.transactionId
      targetUserId.value = initialInboundRequest.userId
      targetDeviceId.value = initialInboundRequest.deviceId
      return
    }

    transactionId.value = null
    const sessionContext = encryption.getCurrentSessionContext()
    // props.userId 优先：调用方可显式指定「验证谁」，缺省才回到「验证本账号其它设备」
    targetUserId.value = props.userId || sessionContext.userId || ''
    // 跨用户时**不得**回退到本机 deviceId：那会拼出 (对方 userId, 我的 deviceId)
    // 这种 SDK 侧并不存在的事务。此处置空，等设备列表选好再发起。
    targetDeviceId.value = props.deviceId || (isVerifyingOtherUser.value ? '' : sessionContext.deviceId || '')
  }

  watch(
    () => props.inboundRequest,
    (newVal) => {
      resetState(newVal ?? null)
    },
    { immediate: true }
  )

  watch(
    () => [props.show, props.initialMode, props.userId, props.deviceId] as const,
    async ([show]) => {
      if (show) {
        resetState(props.inboundRequest || null)
        await loadTargetDevices()
        await loadPendingVerifications()
      }
    },
    { immediate: true }
  )

  /**
   * 拉取目标用户的设备列表（仅跨用户需要）。必须走 `keys/query`：`GET /devices` 无 `{user_id}` 段，查他人恒空。
   * 恰好一台自动选中，多台留空强制显式选择。
   */
  async function loadTargetDevices() {
    targetDevices.value = []
    if (!isVerifyingOtherUser.value) return

    try {
      const devices = await matrixDeviceService.getUserDevices(targetUserId.value)
      targetDevices.value = devices.map((device) => ({
        deviceId: device.device_id,
        displayName: device.display_name || undefined
      }))

      if (!targetDeviceId.value && targetDevices.value.length === 1) {
        targetDeviceId.value = targetDevices.value[0].deviceId
      }
    } catch (err) {
      // getUserDevices 自身已经吞异常返回空数组，这里只兜底并保留诊断痕迹
      logger.error('Failed to load target user devices:', err)
      targetDevices.value = []
    }
  }

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

  async function acceptPendingRequest(req: VerificationTransaction) {
    loading.value = true
    try {
      await encryption.acceptVerification(req.transactionId)
      transactionId.value = req.transactionId
      targetUserId.value = req.userId
      targetDeviceId.value = req.deviceId
      step.value = 'showKey'
      showFeedback(t('setting.encryption.device_verify_dialog.accepted_success'), 'success')
      await loadPendingVerifications()
    } catch (error) {
      logger.error('Failed to accept verification request:', error)
      showFeedback(t('setting.encryption.device_verify_dialog.accepted_failed'), 'error')
    } finally {
      loading.value = false
    }
    if (step.value === 'showKey' && transactionId.value) {
      const txId = transactionId.value
      await sas.load(txId, () => transactionId.value === txId)
    }
  }

  async function declinePendingRequest(txId: string) {
    loading.value = true
    try {
      await encryption.cancelVerification(txId, 'declined')
      showFeedback(t('setting.encryption.device_verify_dialog.declined_success'), 'success')
      await loadPendingVerifications()
    } catch (error) {
      logger.error('Failed to decline verification request:', error)
      showFeedback(t('setting.encryption.device_verify_dialog.declined_failed'), 'error')
    } finally {
      loading.value = false
    }
  }

  async function handleDecline() {
    if (!props.inboundRequest) return
    loading.value = true
    try {
      await encryption.cancelVerification(props.inboundRequest.transactionId, 'declined')
      showFeedback(t('setting.encryption.device_verify_dialog.declined_success'), 'success')
      visible.value = false
      resetState()
    } catch (error) {
      logger.error('Failed to decline verification request:', error)
      showFeedback(t('setting.encryption.device_verify_dialog.declined_failed'), 'error')
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
      showFeedback(t('setting.encryption.device_verify_dialog.cancel_success'), 'success')
      visible.value = false
      resetState()
    } catch (error) {
      logger.error('Failed to cancel verification:', error)
      showFeedback(t('setting.encryption.device_verify_dialog.cancel_failed'), 'error')
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

  /** 本机会话上下文是否可用（区分「没选设备」与「crypto 未就绪」，设备守卫仅在前者生效）。 */
  function hasLocalDeviceContext(): boolean {
    try {
      const sessionContext = encryption.getCurrentSessionContext()
      return !!sessionContext.userId && !!sessionContext.deviceId
    } catch {
      return false
    }
  }

  async function startVerification() {
    // 出站验证必须指名设备：跨用户时 deviceId 来自设备列表选择，
    // 未选就发起会得到 (对方 userId, 空 deviceId) 的无效事务。
    if (!transactionId.value && !targetDeviceId.value && hasLocalDeviceContext()) {
      showFeedback(t('setting.encryption.device_verify_dialog.select_device_required'), 'warning')
      return
    }

    loading.value = true

    try {
      const sessionContext = encryption.getCurrentSessionContext()
      const currentUserId = sessionContext.userId
      const currentDeviceId = sessionContext.deviceId

      if (!currentUserId || !currentDeviceId) {
        throw new Error('Device context unavailable')
      }

      if (transactionId.value) {
        // 入站请求：接受后才有 SAS
        await encryption.acceptVerification(transactionId.value)
      } else {
        // 出站请求：`startSasVerification` 只是发出请求，SAS 要等对端接受
        transactionId.value = await encryption.startSasVerification(targetUserId.value, targetDeviceId.value)
      }
      step.value = 'showKey'
    } catch (error) {
      logger.warn('Failed to start/accept verification:', error)
      showFeedback(t('setting.encryption.device_verify_dialog.load_fingerprint_failed'), 'error')
      step.value = 'rejected'
    } finally {
      loading.value = false
    }

    // 等待 SAS 不占 loading：让用户在等待期间看到「等待对方接受」并能取消
    if (step.value === 'showKey' && transactionId.value) {
      const txId = transactionId.value
      await sas.load(txId, () => transactionId.value === txId)
    }
  }

  async function handleConfirm() {
    // 唯一的安全信号：用户明确勾选过「emoji 一致」且 SAS 确实已就绪。
    // 缺任一条件直接拒绝，绝不发送确认（历史实现无此守卫，无比对也能完成验证）。
    if (!sasReady.value || !sasConfirmed.value) {
      logger.warn('忽略确认请求：SAS 未就绪或用户未勾选一致性')
      return
    }

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
      showFeedback(t('setting.encryption.device_verify_dialog.verify_failed'), 'error')
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
    sasReady,
    sasEmojis,
    sasDecimal,
    sasConfirmed,
    transactionId,
    targetUserId,
    targetDeviceId,
    cancelReason,
    showCancelReason,
    pendingVerifications,
    targetDevices,
    // getters
    currentStepIndex,
    isVerifyingOtherUser,
    // actions
    resetState,
    loadPendingVerifications,
    loadTargetDevices,
    openPendingList,
    backToIntro,
    acceptPendingRequest,
    declinePendingRequest,
    handleDecline,
    handleCancel,
    handleCancelWithReason,
    hideCancelReason,
    handleClose,
    startVerification,
    handleConfirm,
    handleReject
  }
}
