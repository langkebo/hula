<template>
  <div class="call-controls">
    <div class="controls-row">
      <!-- 静音 -->
      <van-button
        round
        :class="muted ? 'btn-active-toggled' : 'btn-control'"
        :aria-label="t('voip.call.mute')"
        @click="emit('toggle-mute')">
        <van-icon :name="muted ? 'warning-o' : 'volume-o'" size="22" />
      </van-button>

      <!-- 扬声器 -->
      <van-button
        round
        :class="speakerOn ? 'btn-control' : 'btn-active-toggled'"
        :aria-label="t('voip.call.speaker')"
        @click="emit('toggle-speaker')">
        <van-icon :name="speakerOn ? 'volume' : 'volume-o'" size="22" />
      </van-button>

      <!-- 摄像头切换（仅视频通话） -->
      <van-button
        v-if="cameraEnabled"
        round
        class="btn-control"
        :aria-label="t('voip.call.switch_camera')"
        @click="emit('toggle-camera')">
        <van-icon name="revoke" size="22" />
      </van-button>
    </div>

    <div class="hangup-row">
      <!-- 挂断 -->
      <van-button
        round
        type="danger"
        size="large"
        class="btn-hangup"
        :aria-label="t('voip.call.hangup')"
        @click="emit('hangup')">
        <van-icon name="phone-o" size="28" />
      </van-button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useI18n } from 'vue-i18n'

defineProps<{
  muted: boolean
  cameraEnabled: boolean
  speakerOn: boolean
  callState?: string | null
}>()

const emit = defineEmits<{
  (e: 'toggle-mute'): void
  (e: 'toggle-camera'): void
  (e: 'toggle-speaker'): void
  (e: 'hangup'): void
}>()

const { t } = useI18n()
</script>

<style scoped lang="scss">
.call-controls {
  @apply flex flex-col items-center gap-24px pb-32px w-full;
  padding-bottom: calc(32px + env(safe-area-inset-bottom));

  .controls-row {
    @apply flex items-center justify-center gap-20px;
  }

  .hangup-row {
    @apply mt-8px;
  }

  .btn-control {
    @apply size-48px;
    background: var(--tjg-surface-subtle);
    color: var(--tjg-text-primary);
    border: none;
  }

  .btn-active-toggled {
    @apply size-48px;
    background: var(--tjg-color-danger-500);
    color: var(--tjg-text-inverse);
    border: none;

    @supports (color: color-mix(in srgb, red, blue)) {
      background: color-mix(in srgb, var(--tjg-color-danger-500) 60%, transparent);
    }
  }

  .btn-hangup {
    @apply size-64px;
    border: none;
    transform: rotate(135deg);
  }
}
</style>
