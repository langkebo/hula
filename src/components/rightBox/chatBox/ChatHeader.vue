<script setup lang="ts">
import ChatHeaderComponent from './ChatHeader/index.vue'

defineOptions({
  name: 'ChatHeader',
  inheritAttrs: true
})
</script>

<template>
  <ChatHeaderComponent v-bind="$attrs" />
</template>
