<template>
  <div class="voice-video-settings">
    <div class="settings-section">
      <h3 class="section-title">{{ t('setting.voice_video.audio_section') }}</h3>

      <div class="setting-item">
        <div class="setting-info">
          <span class="setting-label">{{ t('setting.voice_video.audio_input_label') }}</span>
          <span class="setting-desc">{{ t('setting.voice_video.audio_input_desc') }}</span>
        </div>
        <n-select
          v-model:value="audioInputId"
          :options="audioInputOptions"
          :loading="devicesLoading"
          :placeholder="t('setting.voice_video.select_microphone')"
          class="device-select-width"
          @update:value="selectAudioInput" />
      </div>

      <div class="setting-item">
        <div class="setting-info">
          <span class="setting-label">{{ t('setting.voice_video.audio_test_label') }}</span>
          <span class="setting-desc">{{ t('setting.voice_video.audio_test_desc') }}</span>
        </div>
        <n-button :type="isRecording ? 'error' : 'default'" @click="handleTestAudio">
          {{ isRecording ? t('setting.voice_video.stop_test') : t('setting.voice_video.test_microphone') }}
        </n-button>
      </div>

      <div v-if="audioLevel > 0" class="audio-level-display">
        <div class="level-bar">
          <div class="level-fill" :style="{ width: `${audioLevel}%` }"></div>
        </div>
        <span class="level-text">
          {{ t('setting.voice_video.audio_level', { value: String(Math.round(audioLevel)) }) }}
        </span>
      </div>
    </div>

    <n-divider />

    <div class="settings-section">
      <h3 class="section-title">{{ t('setting.voice_video.video_section') }}</h3>

      <div class="setting-item">
        <div class="setting-info">
          <span class="setting-label">{{ t('setting.voice_video.video_input_label') }}</span>
          <span class="setting-desc">{{ t('setting.voice_video.video_input_desc') }}</span>
        </div>
        <n-select
          v-model:value="videoInputId"
          :options="videoInputOptions"
          :loading="devicesLoading"
          :placeholder="t('setting.voice_video.select_camera')"
          class="device-select-width"
          @update:value="selectVideoInput" />
      </div>

      <div class="setting-item">
        <div class="setting-info">
          <span class="setting-label">{{ t('setting.voice_video.preview_label') }}</span>
          <span class="setting-desc">{{ t('setting.voice_video.preview_desc') }}</span>
        </div>
        <n-button :type="isPreviewing ? 'error' : 'default'" @click="handleTogglePreview">
          {{ isPreviewing ? t('setting.voice_video.stop_preview') : t('setting.voice_video.start_preview') }}
        </n-button>
      </div>

      <div v-if="isPreviewing" class="video-preview">
        <video ref="videoPreviewRef" autoplay muted playsinline class="preview-video"></video>
      </div>
    </div>

    <n-divider />

    <div class="settings-section">
      <h3 class="section-title">{{ t('setting.voice_video.call_section') }}</h3>

      <div class="setting-item">
        <div class="setting-info">
          <span class="setting-label">{{ t('setting.voice_video.echo_cancellation_label') }}</span>
          <span class="setting-desc">{{ t('setting.voice_video.echo_cancellation_desc') }}</span>
        </div>
        <n-switch v-model:value="echoCancellation" @update:value="handleEchoCancellationChange" />
      </div>

      <div class="setting-item">
        <div class="setting-info">
          <span class="setting-label">{{ t('setting.voice_video.noise_suppression_label') }}</span>
          <span class="setting-desc">{{ t('setting.voice_video.noise_suppression_desc') }}</span>
        </div>
        <n-switch v-model:value="noiseSuppression" @update:value="handleNoiseSuppressionChange" />
      </div>

      <div class="setting-item">
        <div class="setting-info">
          <span class="setting-label">{{ t('setting.voice_video.auto_gain_label') }}</span>
          <span class="setting-desc">{{ t('setting.voice_video.auto_gain_desc') }}</span>
        </div>
        <n-switch v-model:value="autoGainControl" @update:value="handleAutoGainChange" />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { NButton, NDivider, NSelect, NSwitch } from 'naive-ui'
import { ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useActionFeedback } from '@/composables/common/useActionFeedback'
import { useMediaDeviceSettings } from '@/composables/settings/useMediaDeviceSettings'

defineOptions({
  name: 'VoiceVideoSettings'
})

const { showFeedback } = useActionFeedback()
const { t } = useI18n()

const videoPreviewRef = ref<HTMLVideoElement>()

// 设备枚举、偏好持久化、麦克风测试与预览统一走共享 composable，桌面只保留 Naive UI 呈现
const {
  devicesLoading,
  isRecording,
  isPreviewing,
  audioLevel,
  audioInputId,
  videoInputId,
  echoCancellation,
  noiseSuppression,
  autoGainControl,
  audioInputOptions,
  videoInputOptions,
  selectAudioInput,
  selectVideoInput,
  handleEchoCancellationChange,
  handleNoiseSuppressionChange,
  handleAutoGainChange,
  handleTestAudio,
  handleTogglePreview
} = useMediaDeviceSettings({
  audioFallbackLabel: (deviceId) => t('setting.voice_video.microphone_fallback', { id: deviceId.slice(0, 8) }),
  videoFallbackLabel: (deviceId) => t('setting.voice_video.camera_fallback', { id: deviceId.slice(0, 8) }),
  emptyDeviceLabel: t('setting.voice_video.select_microphone'),
  videoPreviewRef,
  feedback: {
    devicesFailed: () => showFeedback(t('setting.voice_video.load_devices_failed'), 'error'),
    microphoneTestStarted: () => showFeedback(t('setting.voice_video.microphone_test_started'), 'success'),
    microphoneTestFailed: () => showFeedback(t('setting.voice_video.microphone_access_failed'), 'error'),
    previewStarted: () => showFeedback(t('setting.voice_video.preview_started'), 'success'),
    previewFailed: () => showFeedback(t('setting.voice_video.camera_access_failed'), 'error')
  }
})
</script>

<style scoped>
.voice-video-settings {
  padding: 0 var(--tjg-space-2);
}

.settings-section {
  margin-bottom: var(--tjg-space-4);
}

.section-title {
  font-size: var(--tjg-font-size-lg);
  font-weight: var(--tjg-font-weight-medium);
  margin: 0 0 var(--tjg-space-4) 0;
  color: var(--tjg-text-primary);
}

.setting-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: var(--tjg-space-3) 0;
  border-bottom: 1px solid var(--tjg-settings-divider);
}

.setting-info {
  flex: 1;
  min-width: 0;
}

.setting-label {
  display: block;
  font-size: var(--tjg-font-size-base);
  color: var(--tjg-text-primary);
}

.setting-desc {
  display: block;
  font-size: var(--tjg-font-size-sm);
  color: var(--tjg-text-quaternary);
  margin-top: var(--tjg-space-1);
}

.audio-level-display {
  margin-top: var(--tjg-space-3);
  padding: var(--tjg-space-3);
  background-color: var(--tjg-settings-card-bg);
  border-radius: var(--tjg-radius-sm);
}

.level-bar {
  height: 8px;
  background-color: var(--tjg-settings-meter-bg);
  border-radius: var(--tjg-radius-xs);
  overflow: hidden;
}

.level-fill {
  height: 100%;
  background-color: var(--tjg-color-success-500);
  border-radius: var(--tjg-radius-xs);
  transition: width 0.1s ease;
}

.level-text {
  display: block;
  font-size: var(--tjg-font-size-sm);
  color: var(--tjg-text-quaternary);
  margin-top: var(--tjg-space-2);
  text-align: center;
}

.video-preview {
  margin-top: var(--tjg-space-4);
  border-radius: var(--tjg-radius-sm);
  overflow: hidden;
  background-color: var(--tjg-surface-media-preview);
}

.preview-video {
  width: 100%;
  max-height: 240px;
  object-fit: cover;
}

/* 统一选择器宽度（避免每个 select 都内联 style） */
.device-select-width {
  width: 200px;
}
</style>
