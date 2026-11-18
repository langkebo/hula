import { onMounted, onUnmounted, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { usePrivateMode } from '@/composables/chat/usePrivateMode'
import { useActionFeedback } from '@/composables/common/useActionFeedback'
import { useMitt } from '@/composables/common/useMitt'
import { useBurnAfterRead } from '@/composables/useBurnAfterRead'
import { MittEnum } from '@/enums'
import { useServerCapability } from '@/services/matrix/MatrixCapabilityService'
import { useGlobalStore } from '@/stores/domains/widget/global'

/**
 * 私密模式与阅后即焚的会话级控制。
 *
 * - 私密模式属于单个房间：跟随当前会话切换，切房间即退出，避免状态泄漏
 * - 阅后即焚开关以服务端写入结果为准，失败时回滚本地状态
 * - 响应移动端/其它窗口发来的 PRIVATE_MODE_TOGGLE_REQUEST
 */
export function useChatPrivateModeControls() {
  const { t } = useI18n()
  const { showFeedback } = useActionFeedback()
  const globalStore = useGlobalStore()

  const {
    privateModeActive,
    showPrivateConfirm,
    burnEnabled,
    burnDuration,
    privateModeFeatures,
    setRoomId,
    togglePrivateMode,
    confirmPrivateMode,
    cancelPrivateMode
  } = usePrivateMode()

  watch(
    () => globalStore.currentSessionRoomId,
    (roomId) => void setRoomId(roomId || ''),
    { immediate: true }
  )

  const burnAfterRead = useBurnAfterRead()
  const capability = useServerCapability()

  const handleBurnToggle = async (val: boolean) => {
    const roomId = globalStore.currentSessionRoomId
    if (!roomId) return
    const ok = val
      ? await burnAfterRead.enableBurn(roomId, burnDuration.value * 1000)
      : await burnAfterRead.disableBurn(roomId)
    // 服务失败时不更新本地状态，避免开关与实际配置不一致
    if (!ok) {
      showFeedback(t('room.burn.update_failed'), 'error')
      return
    }
    burnEnabled.value = val
  }

  const handleBurnDurationChange = async (seconds: number) => {
    const roomId = globalStore.currentSessionRoomId
    if (!roomId || !burnEnabled.value) {
      burnDuration.value = seconds
      return
    }
    const previousSeconds = burnDuration.value
    const ok = await burnAfterRead.enableBurn(roomId, seconds * 1000)
    if (!ok) {
      burnDuration.value = previousSeconds
      showFeedback(t('room.burn.update_failed'), 'error')
      return
    }
    burnDuration.value = seconds
  }

  const onPrivateModeToggleRequest = (payload?: { confirmed: boolean }) => {
    // 服务端不支持阅后即焚时忽略切换请求，避免进入无法工作的私密模式
    if (!capability.canUseBurnAfterRead.value) return
    if (payload?.confirmed) {
      // 移动端已确认，直接进入私密模式（不弹 PC 对话框）
      confirmPrivateMode()
    } else {
      // 退出私密模式或 PC 端切换
      togglePrivateMode()
    }
  }

  onMounted(() => {
    useMitt.on(MittEnum.PRIVATE_MODE_TOGGLE_REQUEST, onPrivateModeToggleRequest)
  })
  onUnmounted(() => {
    useMitt.off(MittEnum.PRIVATE_MODE_TOGGLE_REQUEST, onPrivateModeToggleRequest)
  })

  return {
    privateModeActive,
    showPrivateConfirm,
    burnEnabled,
    privateModeFeatures,
    togglePrivateMode,
    confirmPrivateMode,
    cancelPrivateMode,
    handleBurnToggle,
    handleBurnDurationChange
  }
}
