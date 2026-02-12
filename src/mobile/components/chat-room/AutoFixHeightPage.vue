<template>
  <div class="flex flex-col flex-1 min-h-0 relative">
    <img v-if="bgmURL" :src="bgmURL" class="absolute fixed top-0 left-0 w-full h-full z-0 dark:opacity-20" />
    <!-- 页面容器 -->
    <div class="flex w-full items-start flex-col flex-1 min-h-0 z-1">
      <div class="w-full">
        <slot name="header"></slot>
      </div>
      <!-- 消息内容区 -->
      <div class="w-full flex-1 overflow-y-hidden min-h-0">
        <slot name="container"></slot>
      </div>
    </div>

    <slot v-if="showFooter" name="footer" class="z-1"></slot>
  </div>
</template>

<script setup lang="ts">
import bgImg from '@/assets/mobile/chat-home/background.webp'

const { showFooter = true, background = true } = defineProps<{ showFooter?: boolean; background?: string | boolean }>()

const bgmURL = computed(() => {
  return typeof background === 'boolean' && background ? bgImg : background
})
</script>

<style lang="scss"></style>
