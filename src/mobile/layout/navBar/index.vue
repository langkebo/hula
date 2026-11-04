<template>
  <nav class="safe-area-nav">
    <div class="flex items-center justify-between w-full box-border px-16px h-full">
      <!-- 左侧插槽 -->
      <div class="flex-1 min-w-0">
        <slot name="left"></slot>
      </div>

      <!-- 中间内容 -->
      <div v-if="$slots.center" class="flex-1 flex justify-center">
        <div class="flex justify-center">
          <slot name="center"></slot>
        </div>
      </div>

      <!-- 右侧插槽 -->
      <div class="flex-1 min-w-0 flex justify-end">
        <div class="ml-auto">
          <slot name="right"></slot>
        </div>
      </div>
    </div>
  </nav>
</template>

<script setup lang="ts"></script>
<style scoped lang="scss">
@use '@/styles/scss/mixins/liquid-glass' as *;

.safe-area-nav {
  @apply z-998 w-full;
  /* 模糊：显式双声明，不用 @apply backdrop-blur-md —— 工具类不带 -webkit- 前缀，
     旧 iOS/Android WebView 会丢弃整条声明。值同 blur-md = 12px */
  -webkit-backdrop-filter: blur(12px);
  backdrop-filter: blur(12px);
  height: 44px;
  /* 低性能设备关闭 @apply 生成的模糊；选择器优先级高于原规则 */
  @include backdrop-blur-fallback;
}
</style>
