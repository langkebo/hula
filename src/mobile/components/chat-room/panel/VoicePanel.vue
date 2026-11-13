<template>
  <div class="h-40 w-full flex flex-col">
    <VoiceRecorder
      v-show="isVoiceMode"
      @cancel="handleVoiceCancel"
      @send="handleVoiceSend"
      @permission-denied="showPermissionGuide = true" />
  </div>

  <van-dialog
    v-model:show="showPermissionGuide"
    :title="t('message.voice_recorder.permission_denied_title')"
    :message="t('message.voice_recorder.permission_denied_guide')"
    :confirm-button-text="t('common.confirm')" />
</template>

<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import type { VoiceRecordPayload } from '@/components/rightBox/VoiceRecorder.vue'

const emit = defineEmits<{
  cancel: []
  send: [voiceData: VoiceRecordPayload]
}>()

const { t } = useI18n()

const isVoiceMode = ref(true)
const showPermissionGuide = ref(false)

const handleVoiceCancel = () => {
  emit('cancel')
}

const handleVoiceSend = async (voiceData: VoiceRecordPayload) => {
  emit('send', voiceData)
}
</script>

<style lang="scss" scoped></style>
