<template>
  <div class="h-40 w-full flex flex-col">
    <VoiceRecorder v-show="isVoiceMode" @cancel="handleVoiceCancel" @send="handleVoiceSend" />
  </div>
</template>

<script setup lang="ts">
import type { VoiceRecordPayload } from '@/components/rightBox/VoiceRecorder.vue'

const emit = defineEmits<{
  cancel: []
  send: [voiceData: VoiceRecordPayload]
}>()

const isVoiceMode = ref(true)

const handleVoiceCancel = () => {
  emit('cancel')
}

const handleVoiceSend = async (voiceData: VoiceRecordPayload) => {
  emit('send', voiceData)
}
</script>

<style lang="scss" scoped></style>
