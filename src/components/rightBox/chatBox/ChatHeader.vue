<script setup lang="ts">
import ChatHeaderComponent from './ChatHeader/ChatHeaderRoot.vue'

defineOptions({
  name: 'ChatHeader',
  inheritAttrs: true
})
</script>

<template>
  <ChatHeaderComponent v-bind="$attrs" />
</template>
