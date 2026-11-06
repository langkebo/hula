<template>
  <AutoFixHeightPage :show-footer="false">
    <template #header>
      <HeaderBar border :isOfficial="false" :hidden-right="true" :room-name="t('mobile_voice_video.title')" />
    </template>

    <template #container>
      <div class="flex flex-col overflow-auto h-full">
        <div class="flex flex-col p-16px gap-12px">
          <div class="text-14px text-[var(--tjg-text-secondary)] mb-8px">
            {{ t('mobile_voice_video.audio_section') }}
          </div>

          <van-cell-group inset>
            <van-cell :title="t('mobile_voice_video.audio_input')">
              <template #icon>
                <div
                  class="w-40px h-40px rounded-full bg-[var(--tjg-color-info-100)] mr-12px flex items-center justify-center">
                  <Icon icon="mdi:microphone" :width="20" color="var(--tjg-color-info-500)" />
                </div>
              </template>
              <template #right-icon>
                <van-picker-group>
                  <van-field v-model="audioInputName" readonly is-link @click="showAudioInputPicker = true" />
                </van-picker-group>
              </template>
            </van-cell>
          </van-cell-group>

          <van-cell-group inset>
            <van-cell :title="t('mobile_voice_video.test_microphone')">
              <template #right-icon>
                <van-button :type="isRecording ? 'danger' : 'default'" size="small" @click="handleTestAudio">
                  {{ isRecording ? t('mobile_voice_video.stop') : t('mobile_voice_video.test') }}
                </van-button>
              </template>
            </van-cell>
          </van-cell-group>

          <div v-if="audioLevel > 0" class="px-16px">
            <div class="h-8px bg-[var(--tjg-border-color)] rounded-full overflow-hidden">
              <div
                class="h-full bg-[var(--tjg-color-success-500)] rounded-full transition-[width,transform,opacity,color,background-color,border-color,box-shadow] duration-100"
                :style="{ width: `${audioLevel}%` }"></div>
            </div>
            <div class="text-12px text-[var(--tjg-text-secondary)] text-center mt-4px">
              {{ t('mobile_voice_video.level') }}: {{ Math.round(audioLevel) }}%
            </div>
          </div>

          <div class="text-14px text-[var(--tjg-text-secondary)] mt-16px mb-8px">
            {{ t('mobile_voice_video.video_section') }}
          </div>

          <van-cell-group inset>
            <van-cell :title="t('mobile_voice_video.video_input')">
              <template #icon>
                <div
                  class="w-40px h-40px rounded-full bg-[var(--tjg-color-primary-100)] mr-12px flex items-center justify-center">
                  <Icon icon="mdi:video" :width="20" color="var(--tjg-color-primary-500)" />
                </div>
              </template>
              <template #right-icon>
                <van-field v-model="videoInputName" readonly is-link @click="showVideoInputPicker = true" />
              </template>
            </van-cell>

            <van-cell :title="t('mobile_voice_video.video_preview')">
              <template #right-icon>
                <van-button :type="isPreviewing ? 'danger' : 'default'" size="small" @click="handleTogglePreview">
                  {{ isPreviewing ? t('mobile_voice_video.stop') : t('mobile_voice_video.preview') }}
                </van-button>
              </template>
            </van-cell>
          </van-cell-group>

          <div v-if="isPreviewing" class="px-16px">
            <video ref="videoPreviewRef" autoplay muted playsinline class="w-full rounded-lg bg-black"></video>
          </div>

          <div class="text-14px text-[var(--tjg-text-secondary)] mt-16px mb-8px">
            {{ t('mobile_voice_video.call_section') }}
          </div>

          <van-cell-group inset>
            <van-cell :title="t('mobile_voice_video.echo_cancellation')">
              <template #right-icon>
                <van-switch v-model="echoCancellation" @change="handleEchoCancellationChange" />
              </template>
            </van-cell>

            <van-cell :title="t('mobile_voice_video.noise_suppression')">
              <template #right-icon>
                <van-switch v-model="noiseSuppression" @change="handleNoiseSuppressionChange" />
              </template>
            </van-cell>

            <van-cell :title="t('mobile_voice_video.auto_gain')">
              <template #right-icon>
                <van-switch v-model="autoGainControl" @change="handleAutoGainChange" />
              </template>
            </van-cell>
          </van-cell-group>
        </div>
      </div>

      <van-popup v-model:show="showAudioInputPicker" position="bottom" round>
        <van-picker
          :columns="audioInputColumns"
          @confirm="onAudioInputConfirm"
          @cancel="showAudioInputPicker = false" />
      </van-popup>

      <van-popup v-model:show="showVideoInputPicker" position="bottom" round>
        <van-picker
          :columns="videoInputColumns"
          @confirm="onVideoInputConfirm"
          @cancel="showVideoInputPicker = false" />
      </van-popup>
    </template>
  </AutoFixHeightPage>
</template>

<script setup lang="ts">
import { Icon } from '@iconify/vue'
import { showToast } from 'vant'
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useMediaDeviceSettings } from '@/composables/settings/useMediaDeviceSettings'

const { t } = useI18n()

const videoPreviewRef = ref<HTMLVideoElement>()
const showAudioInputPicker = ref(false)
const showVideoInputPicker = ref(false)

// 设备枚举、偏好持久化、麦克风测试与预览统一走共享 composable，移动端只保留 Vant 呈现
const {
  isRecording,
  isPreviewing,
  audioLevel,
  echoCancellation,
  noiseSuppression,
  autoGainControl,
  audioInputOptions,
  videoInputOptions,
  audioInputName,
  videoInputName,
  selectAudioInput,
  selectVideoInput,
  handleEchoCancellationChange,
  handleNoiseSuppressionChange,
  handleAutoGainChange,
  handleTestAudio,
  handleTogglePreview
} = useMediaDeviceSettings({
  audioFallbackLabel: (deviceId) => `${t('mobile_voice_video.microphone')} ${deviceId.slice(0, 8)}`,
  videoFallbackLabel: (deviceId) => `${t('mobile_voice_video.camera')} ${deviceId.slice(0, 8)}`,
  emptyDeviceLabel: t('mobile_voice_video.select_device'),
  videoPreviewRef,
  feedback: {
    devicesFailed: () => showToast({ type: 'fail', message: t('mobile_voice_video.device_error') }),
    microphoneTestStarted: () => showToast({ type: 'success', message: t('mobile_voice_video.test_started') }),
    microphoneTestFailed: () => showToast({ type: 'fail', message: t('mobile_voice_video.mic_error') }),
    previewStarted: () => showToast({ type: 'success', message: t('mobile_voice_video.preview_started') }),
    previewFailed: () => showToast({ type: 'fail', message: t('mobile_voice_video.camera_error') })
  }
})

// Vant Picker 需要 text 字段，共享层统一输出 label/value
const audioInputColumns = computed(() =>
  audioInputOptions.value.map((option) => ({ text: option.label, value: option.value }))
)
const videoInputColumns = computed(() =>
  videoInputOptions.value.map((option) => ({ text: option.label, value: option.value }))
)

function onAudioInputConfirm({ selectedOptions }: { selectedOptions: Array<{ value: string }> }) {
  selectAudioInput(selectedOptions[0].value)
  showAudioInputPicker.value = false
}

function onVideoInputConfirm({ selectedOptions }: { selectedOptions: Array<{ value: string }> }) {
  selectVideoInput(selectedOptions[0].value)
  showVideoInputPicker.value = false
}
</script>

<style scoped></style>
