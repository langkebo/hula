<template>
  <div class="sr-only" aria-hidden="false">
    <div v-for="msg in politeMessages" :key="msg.id" role="status" aria-live="polite" aria-atomic="true">
      {{ msg.text }}
    </div>
    <div v-for="msg in assertiveMessages" :key="msg.id" role="alert" aria-live="assertive" aria-atomic="true">
      {{ msg.text }}
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useAriaLive } from '../../composables/common/useAriaLive'

const { messages } = useAriaLive()

const politeMessages = computed(() => messages.value.filter((message) => message.politeness === 'polite'))
const assertiveMessages = computed(() => messages.value.filter((message) => message.politeness === 'assertive'))
</script>

<style scoped>
.sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border-width: 0;
}
</style>
