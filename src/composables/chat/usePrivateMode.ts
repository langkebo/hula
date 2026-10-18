import { computed, ref } from 'vue'
import { useMitt } from '@/composables/common/useMitt'
import { MittEnum } from '@/enums'
import { useScreenshotDetection } from './useScreenshotDetection'

// 模块级单例状态：所有 usePrivateMode() 调用者共享同一份响应式状态
// 与同一个截屏检测实例，避免多实例导致状态不一致或重复注册监听器。
const privateModeActive = ref(false)
const showPrivateConfirm = ref(false)
const burnEnabled = ref(false)
const burnDuration = ref(60)
const currentRoomId = ref<string>('')

// 截屏检测实例仅在模块加载时创建一次，确保全局唯一。
const { startWatch, stopWatch } = useScreenshotDetection()

/**
 * 私密模式的能力清单。
 *
 * ⚠️ 这里每条都必须**只描述已实现的行为**：
 * 早先版本宣称「服务器不存储消息内容，仅传输」与「防截屏」，两者都无任何实现——
 * 后端从不因该模式删除消息（房间消息按保留策略存储），截屏检测在 Rust 侧仍是
 * 始终返回 false 的占位实现。假承诺比没有承诺更糟，故整条移除并改写措辞。
 *
 * 返回 i18n key 而非文案：composable 层没有可靠的响应式 i18n 上下文，
 * 硬编码中文会在英文界面漏出中文（与 `useMessageTrust` 的处理一致）。
 */
const privateModeFeatures = computed(() => [
  { textKey: 'chat.header.private_mode_feature_e2ee', icon: '#lock', iconClass: 'text-[--tjg-color-primary-500]' },
  { textKey: 'chat.header.private_mode_feature_burn', icon: '#fire', iconClass: 'text-[--tjg-color-danger-500]' },
  {
    textKey: 'chat.header.private_mode_feature_screenshot',
    icon: '#shield',
    iconClass: 'text-[--tjg-color-warning-500]'
  }
])

export function usePrivateMode() {
  function setRoomId(roomId: string) {
    currentRoomId.value = roomId
  }

  function togglePrivateMode() {
    if (privateModeActive.value) {
      privateModeActive.value = false
      burnEnabled.value = false
      useMitt.emit(MittEnum.PRIVATE_MODE_CHANGED, false)
      stopWatch()
    } else {
      showPrivateConfirm.value = true
    }
  }

  function confirmPrivateMode() {
    privateModeActive.value = true
    showPrivateConfirm.value = false
    useMitt.emit(MittEnum.PRIVATE_MODE_CHANGED, true)
    if (currentRoomId.value) {
      startWatch(currentRoomId.value)
    }
  }

  function cancelPrivateMode() {
    showPrivateConfirm.value = false
  }

  return {
    privateModeActive,
    showPrivateConfirm,
    burnEnabled,
    burnDuration,
    privateModeFeatures,
    currentRoomId,
    setRoomId,
    togglePrivateMode,
    confirmPrivateMode,
    cancelPrivateMode
  }
}
