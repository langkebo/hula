import { computed, ref } from 'vue'
import { useMitt } from '@/composables/common/useMitt'
import { MittEnum } from '@/enums'
import { PRIVATE_MODE_STATE_EVENT_TYPE, roomOperations } from '@/services/matrix/room/RoomOperations'
import { createLogger } from '@/utils/Logger'

const logger = createLogger('usePrivateMode')

// 模块级单例状态：所有 usePrivateMode() 调用者共享同一份响应式状态，
// 避免多实例导致状态不一致。
const privateModeActive = ref(false)
const showPrivateConfirm = ref(false)
const burnEnabled = ref(false)
const burnDuration = ref(60)
const currentRoomId = ref<string>('')

// 状态版本号：异步读取/写入返回时若版本已变化，说明用户已切房间或手动切换，
// 丢弃过期结果，避免「刚关掉又被旧房间的回填重新打开」。
let stateVersion = 0

/**
 * 私密模式的能力清单。
 *
 * ⚠️ 这里每条都必须**只描述已实现的行为**：
 * 早先版本宣称「服务器不存储消息内容，仅传输」与「防截屏」，两者都无任何实现——
 * 后端从不因该模式删除消息（房间消息按保留策略存储），截屏检测在 Rust 侧只是
 * 始终返回 false 的占位实现，已连同命令与 UI 一并移除。假承诺比没有承诺更糟。
 *
 * 返回 i18n key 而非文案：composable 层没有可靠的响应式 i18n 上下文，
 * 硬编码中文会在英文界面漏出中文（与 `useMessageTrust` 的处理一致）。
 */
const privateModeFeatures = computed(() => [
  { textKey: 'chat.header.private_mode_feature_e2ee', icon: '#lock', iconClass: 'text-[--tjg-color-primary-500]' },
  { textKey: 'chat.header.private_mode_feature_burn', icon: '#fire', iconClass: 'text-[--tjg-color-danger-500]' }
])

/**
 * 把私密模式开关同步到房间状态事件，保证重进房间后能恢复。
 *
 * 无写权限（普通成员 PL 0）时不写服务端，降级为「仅本次会话生效」，
 * 不阻塞用户切换；其他异常只记日志，避免打断会话。
 */
async function persistPrivateMode(roomId: string, enabled: boolean) {
  try {
    if (!roomOperations.canWriteStateEvent(roomId, PRIVATE_MODE_STATE_EVENT_TYPE)) return
    await roomOperations.setPrivateMode(roomId, enabled)
  } catch (error) {
    logger.warn('同步私密模式状态失败', error)
  }
}

function deactivatePrivateMode() {
  stateVersion++
  privateModeActive.value = false
  burnEnabled.value = false
  useMitt.emit(MittEnum.PRIVATE_MODE_CHANGED, false)
}

export function usePrivateMode() {
  /**
   * 同步当前房间号，并按房间状态事件恢复私密模式。
   *
   * `privateModeActive` 是模块级单例，keepAlive 下的聊天页实例会被复用。
   * 切房间时必须先复位本地状态（否则顶栏仍显示私密态），
   * 但不写旧房间的状态事件——私密模式是按房间持久化的，离开不应抹掉该房间的开关。
   */
  async function setRoomId(roomId: string) {
    if (roomId === currentRoomId.value) return
    const version = ++stateVersion
    if (privateModeActive.value) {
      privateModeActive.value = false
      burnEnabled.value = false
      useMitt.emit(MittEnum.PRIVATE_MODE_CHANGED, false)
    }
    currentRoomId.value = roomId
    if (!roomId) return
    try {
      const enabled = await roomOperations.getPrivateMode(roomId)
      if (!enabled || version !== stateVersion) return
      privateModeActive.value = true
      useMitt.emit(MittEnum.PRIVATE_MODE_CHANGED, true)
    } catch (error) {
      logger.warn('读取私密模式状态失败', error)
    }
  }

  function togglePrivateMode() {
    if (privateModeActive.value) {
      const roomId = currentRoomId.value
      deactivatePrivateMode()
      if (roomId) void persistPrivateMode(roomId, false)
    } else {
      showPrivateConfirm.value = true
    }
  }

  function confirmPrivateMode() {
    stateVersion++
    privateModeActive.value = true
    showPrivateConfirm.value = false
    useMitt.emit(MittEnum.PRIVATE_MODE_CHANGED, true)
    const roomId = currentRoomId.value
    if (roomId) {
      void persistPrivateMode(roomId, true)
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
