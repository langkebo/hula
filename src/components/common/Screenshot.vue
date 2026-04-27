<script setup lang="ts">
import ScreenshotComponent from './Screenshot/ScreenshotRoot.vue'

defineOptions({
  name: 'Screenshot',
  inheritAttrs: true
})
</script>

<template>
  <ScreenshotComponent v-bind="$attrs" />
</template>
