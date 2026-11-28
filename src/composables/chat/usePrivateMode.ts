import { computed, ref } from 'vue'
import { useMitt } from '@/composables/common/useMitt'
import { useBurnAfterRead } from '@/composables/useBurnAfterRead'
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

/**
 * 进入/恢复私密模式时，从服务端回填房间级阅后即焚状态。
 *
 * 阅后即焚开关只在私密模式内可见（`BurnAfterReadBar`）。若回填缺失，
 * 重进房间后开关会显示「关闭」，而服务端策略仍在生效，形成隐形焚毁。
 */
async function hydrateBurnState(roomId: string, version: number) {
  try {
    const burnAfterRead = useBurnAfterRead()
    await burnAfterRead.refreshBurnSettings(roomId)
    if (version !== stateVersion) return
    burnEnabled.value = burnAfterRead.isRoomBurnEnabled(roomId)
    const duration = burnAfterRead.getRoomBurnDuration(roomId)
    if (duration > 0) burnDuration.value = duration
  } catch (error) {
    logger.warn('回填阅后即焚状态失败', error)
  }
}

/**
 * 退出私密模式时同步关闭房间级阅后即焚策略。
 *
 * 仅复位本地 `burnEnabled` 会让服务端策略在 UI 之外继续生效：
 * 用户以为已退出私密聊天，后续消息却仍会被焚毁。
 */
async function disableBurnOnExit(roomId: string) {
  try {
    const burnAfterRead = useBurnAfterRead()
    const ok = await burnAfterRead.disableBurn(roomId)
    if (!ok) logger.warn('退出私密模式时关闭阅后即焚失败', roomId)
  } catch (error) {
    logger.warn('退出私密模式时关闭阅后即焚异常', error)
  }
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
      if (version !== stateVersion) return
      if (!enabled) return
      privateModeActive.value = true
      useMitt.emit(MittEnum.PRIVATE_MODE_CHANGED, true)
      await hydrateBurnState(roomId, version)
    } catch (error) {
      logger.warn('读取私密模式状态失败', error)
    }
  }

  function togglePrivateMode() {
    if (privateModeActive.value) {
      const roomId = currentRoomId.value
      // deactivatePrivateMode 会复位 burnEnabled，需先捕获，否则无法判断是否要同步关闭服务端策略
      const shouldDisableBurn = burnEnabled.value
      deactivatePrivateMode()
      if (roomId) {
        void persistPrivateMode(roomId, false)
        if (shouldDisableBurn) void disableBurnOnExit(roomId)
      }
    } else {
      showPrivateConfirm.value = true
    }
  }

  function confirmPrivateMode() {
    const version = ++stateVersion
    privateModeActive.value = true
    showPrivateConfirm.value = false
    useMitt.emit(MittEnum.PRIVATE_MODE_CHANGED, true)
    const roomId = currentRoomId.value
    if (roomId) {
      void persistPrivateMode(roomId, true)
      void hydrateBurnState(roomId, version)
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
