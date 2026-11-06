<template>
  <div class="window-chat-container">
    <!-- 顶部窗口栏（独立窗口自治，附录 C.2） -->
    <header class="window-chat-container__header" data-tauri-drag-region>
      <ActionBar :shrink="false" />
    </header>

    <!-- 聊天主体（复用 ChatBox，独立 EventEmitter 订阅） -->
    <main class="window-chat-container__main">
      <!-- 路由缺失 roomId：先于会话恢复暴露，属窗口被错误创建（不是会话问题） -->
      <n-empty
        v-if="!roomId"
        class="size-full"
        :description="t('chat.window.no_room_id')"
        data-test="window-chat-no-room-id" />

      <!-- 会话恢复中 -->
      <n-spin v-else-if="initializing" class="size-full" data-test="window-chat-initializing" />

      <!-- 本地无可用会话：如实告知，不做「空聊天」假象 -->
      <div
        v-else-if="sessionState === 'no-session'"
        class="window-chat-container__state"
        data-test="window-chat-no-session">
        <n-icon size="28" color="var(--tjg-text-tertiary)">
          <svg><use href="#warning" /></svg>
        </n-icon>
        <p class="window-chat-container__state-text">{{ t('matrix_error.common.user_not_logged_in') }}</p>
      </div>

      <!-- 会话恢复失败：给出原因 + 重试（error 不落终态，重试真的会再跑一次） -->
      <div
        v-else-if="sessionState === 'error'"
        class="window-chat-container__state"
        data-test="window-chat-session-error">
        <p class="window-chat-container__state-text">{{ t('chat.window.session_restore_failed') }}</p>
        <p v-if="sessionError" class="window-chat-container__state-detail">{{ sessionError.message }}</p>
        <n-button size="small" type="primary" data-test="window-chat-retry" @click="handleRetry">
          {{ t('common.retry') }}
        </n-button>
      </div>

      <ChatBox v-else />
    </main>
  </div>
</template>

<script setup lang="ts">
import { NButton, NEmpty, NIcon, NSpin } from 'naive-ui'
import { computed, onMounted, onUnmounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRoute } from 'vue-router'
import ChatBox from '@/components/rightBox/chatBox/index.vue'
import { useIndependentChatWindow } from '@/composables/chat/useIndependentChatWindow'
import { usePlatformClose } from '@/composables/common/usePlatformClose'
import { useWindowSessionReady } from '@/composables/common/useWindowSessionReady'
import { useGlobalStore } from '@/stores/domains/widget/global'
import { createLogger } from '@/utils/Logger'

const logger = createLogger('WindowChatView')

const route = useRoute()
const globalStore = useGlobalStore()
const { t } = useI18n()

const roomId = computed(() => {
  const param = route.params.roomId
  if (Array.isArray(param)) return param[0] ?? ''
  return param ?? ''
})

// 独立聊天窗口此前完全不做会话恢复（图谱 §8.5 B3）：本窗口的 matrixClientService 是新实例，
// getClient() 恒为 null，ChatBox 拿不到任何消息。现走统一入口（幂等、每窗口一次）。
const {
  state: sessionState,
  error: sessionError,
  pending: sessionPending,
  ensureSessionReady
} = useWindowSessionReady()

const initializing = computed(() => sessionState.value === null || sessionPending.value)

const { notifyUnreadUpdate, listenChatClosed } = useIndependentChatWindow()
const { closeCurrentWindow } = usePlatformClose()

let unlistenClosed: (() => void) | null = null

/** error 态下重试会话恢复（成功后模板自动切到 ChatBox）。 */
async function handleRetry(): Promise<void> {
  const state = await ensureSessionReady()
  logger.info(`Standalone chat window retry session restore result=${state}`)
}

onMounted(async () => {
  logger.info(`Standalone chat window mounted, roomId=${roomId.value}`)

  // 附录 C.2：独立窗口初始化时设置当前会话
  if (roomId.value) {
    // 通过 currentSessionRoomId 让 ChatBox 渲染对应会话
    // 注意：独立窗口拥有独立的 store 实例，与主窗口隔离
    globalStore.updateCurrentSessionRoomId(roomId.value)
  }

  // 监听主窗口发来的关闭信号：与会话恢复**并行**注册，
  // 避免恢复过程较慢时窗口关闭按钮失效。
  const unlisten = await listenChatClosed(async ({ roomId: closedRoomId }) => {
    if (closedRoomId === roomId.value) {
      logger.info('Received close notification from main window, closing standalone window')
      await closeCurrentWindow()
    }
  })
  unlistenClosed = unlisten

  const sessionStateValue = await ensureSessionReady()
  logger.info(`Standalone chat window session state=${sessionStateValue}`)

  // 附录 C.3：通知主窗口未读数清零（窗口已打开）。会话没就绪时不通知，
  // 否则会在「窗口其实看不到消息」的情况下把未读清掉。
  if (roomId.value && sessionStateValue === 'ready') {
    await notifyUnreadUpdate(roomId.value, 0)
  }
})

onUnmounted(() => {
  logger.info(`Standalone chat window unmounted, roomId=${roomId.value}`)
  // 通知主窗口已关闭（emit chat:closed 由 useIndependentChatWindow 的 destroyed 监听处理）
  unlistenClosed?.()
})
</script>

<style scoped lang="scss">
.window-chat-container {
  display: flex;
  flex-direction: column;
  height: 100vh;
  height: 100dvh;
  width: 100vw;
  background: var(--tjg-surface-panel);
  overflow: hidden;
}

.window-chat-container__header {
  flex-shrink: 0;
  height: 32px;
  display: flex;
  align-items: center;
  background: var(--tjg-surface-panel);
}

.window-chat-container__main {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
}

.window-chat-container__state {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: var(--tjg-space-3);
  padding: var(--tjg-space-6);
  color: var(--tjg-text-secondary);
  text-align: center;

  &-text {
    font-size: var(--tjg-font-size-md);
  }

  &-detail {
    max-width: 420px;
    font-size: var(--tjg-font-size-sm);
    color: var(--tjg-text-tertiary);
    word-break: break-all;
  }
}
</style>
