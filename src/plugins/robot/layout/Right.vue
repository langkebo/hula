<template>
  <n-flex
    vertical
    :size="0"
    class="flex-1 truncate border-l-(1px solid [--tjg-border-default]) custom-shadow select-none text-[--tjg-text-primary]">
    <!-- 右上角操作栏 -->
    <ActionBar :shrink="false" :current-label="currentWindowLabel" :top-win-label="currentWindowLabel" />

    <!-- ✅ 使用 keep-alive 缓存 Chat.vue，避免重复挂载 -->
    <RouterView v-slot="{ Component }">
      <keep-alive :max="5">
        <component :is="Component" />
      </keep-alive>
    </RouterView>
  </n-flex>
</template>
<script setup lang="ts">
import { WebviewWindow } from '@tauri-apps/api/webviewWindow'
import { hasTauriRuntime } from '@/utils/AppHarness'

const currentWindowLabel = computed(() => (hasTauriRuntime() ? WebviewWindow.getCurrent().label : ''))
</script>
