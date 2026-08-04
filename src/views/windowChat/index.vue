<template>
  <div class="window-chat-container">
    <!-- 顶部窗口栏（独立窗口自治，附录 C.2） -->
    <header class="window-chat-container__header" data-tauri-drag-region>
      <ActionBar :shrink="false" />
    </header>

    <!-- 聊天主体（复用 ChatBox，独立 EventEmitter 订阅） -->
    <main class="window-chat-container__main">
      <n-spin v-if="initializing" class="size-full" />
      <ChatBox v-else-if="roomId" />
      <n-empty v-else description="未提供 roomId" class="size-full" />
    </main>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { useRoute } from 'vue-router'
import ChatBox from '@/components/rightBox/chatBox/index.vue'
import { useIndependentChatWindow } from '@/composables/chat/useIndependentChatWindow'
import { useGlobalStore } from '@/stores/domains/widget/global'
import { createLogger } from '@/utils/Logger'

const logger = createLogger('WindowChatView')

const route = useRoute()
const globalStore = useGlobalStore()

const initializing = ref(true)
const roomId = computed(() => {
  const param = route.params.roomId
  if (Array.isArray(param)) return param[0] ?? ''
  return param ?? ''
})

const { notifyUnreadUpdate, listenChatClosed } = useIndependentChatWindow()

let unlistenClosed: (() => void) | null = null

onMounted(async () => {
  logger.info(`独立聊天窗口挂载，roomId=${roomId.value}`)

  // 附录 C.2：独立窗口初始化时设置当前会话
  if (roomId.value) {
    // 通过 currentSessionRoomId 让 ChatBox 渲染对应会话
    // 注意：独立窗口拥有独立的 store 实例，与主窗口隔离
    globalStore.updateCurrentSessionRoomId(roomId.value)
  }

  // 监听主窗口发来的关闭信号
  const unlisten = await listenChatClosed(({ roomId: closedRoomId }) => {
    if (closedRoomId === roomId.value) {
      logger.info('收到主窗口关闭通知，关闭独立窗口')
      window.close()
    }
  })
  unlistenClosed = unlisten

  initializing.value = false

  // 附录 C.3：通知主窗口未读数清零（窗口已打开）
  await notifyUnreadUpdate(roomId.value, 0)
})

onUnmounted(() => {
  logger.info(`独立聊天窗口卸载，roomId=${roomId.value}`)
  // 通知主窗口已关闭（emit chat:closed 由 useIndependentChatWindow 的 destroyed 监听处理）
  unlistenClosed?.()
})
</script>

<style scoped lang="scss">
.window-chat-container {
  display: flex;
  flex-direction: column;
  height: 100vh;
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
</style>
