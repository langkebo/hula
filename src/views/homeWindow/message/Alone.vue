<template>
  <main class="flex-1 rounded-8px bg-[--right-bg-color] h-full w-100vw" :aria-label="currentWindowLabel || '聊天'">
    <div style="background: var(--right-theme-bg-color); height: 100%" role="region" aria-label="聊天区域">
      <ActionBar :shrink="false" :current-label="currentWindowLabel" />

      <ChatBox />
    </div>
  </main>
</template>
<script setup lang="ts">
import { emit } from '@tauri-apps/api/event'
import { getCurrentWebviewWindow, WebviewWindow } from '@tauri-apps/api/webviewWindow'
import { EventEnum } from '@/enums'
import { hasTauriRuntime } from '@/utils/AppHarness'

const appWindow = hasTauriRuntime() ? WebviewWindow.getCurrent() : null
const currentWindowLabel = computed(() => appWindow?.label ?? '')

/**! 创建新窗口然后需要通信传递数据时候需要进行提交一次页面创建成功的事件，否则会接收不到数据 */
onMounted(async () => {
  await getCurrentWebviewWindow().show()
  await emit(EventEnum.ALONE)
})
</script>
