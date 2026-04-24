<template>
  <n-flex vertical :size="40">
    <n-flex vertical class="text-(14px [--text-color])" :size="16">
      <span class="pl-10px">{{ t('setting.voice_video.audio') }}</span>

      <n-flex class="item p-12px" :size="12" vertical>
        <n-flex align="center" justify="space-between">
          <n-flex vertical :size="4">
            <span>{{ t('setting.voice_video.microphone') }}</span>
          </n-flex>
          <n-select
            v-model:value="microphone"
            class="w-200px"
            size="small"
            :options="audioInputOptions"
            :placeholder="t('setting.voice_video.select_device')" />
        </n-flex>

        <span class="w-full h-1px bg-[--line-color]"></span>

        <n-flex align="center" justify="space-between">
          <n-flex vertical :size="4">
            <span>{{ t('setting.voice_video.speaker') }}</span>
          </n-flex>
          <n-select
            v-model:value="speaker"
            class="w-200px"
            size="small"
            :options="audioOutputOptions"
            :placeholder="t('setting.voice_video.select_device')" />
        </n-flex>

        <span class="w-full h-1px bg-[--line-color]"></span>

        <n-flex align="center" justify="space-between">
          <n-flex vertical :size="4">
            <span>{{ t('setting.voice_video.test_microphone') }}</span>
          </n-flex>
          <n-button size="small" secondary @click="handleTestMicrophone">
            {{ t('setting.voice_video.test') }}
          </n-button>
        </n-flex>

        <span class="w-full h-1px bg-[--line-color]"></span>

        <n-flex align="center" justify="space-between">
          <n-flex vertical :size="4">
            <span>{{ t('setting.voice_video.test_speaker') }}</span>
          </n-flex>
          <n-button size="small" secondary @click="handleTestSpeaker">
            {{ t('setting.voice_video.test') }}
          </n-button>
        </n-flex>

        <span class="w-full h-1px bg-[--line-color]"></span>

        <n-flex align="center" justify="space-between">
          <n-flex vertical :size="4">
            <span>{{ t('setting.voice_video.noise_suppression') }}</span>
          </n-flex>
          <n-switch size="small" v-model:value="noiseSuppression" />
        </n-flex>

        <span class="w-full h-1px bg-[--line-color]"></span>

        <n-flex align="center" justify="space-between">
          <n-flex vertical :size="4">
            <span>{{ t('setting.voice_video.echo_cancellation') }}</span>
          </n-flex>
          <n-switch size="small" v-model:value="echoCancellation" />
        </n-flex>

        <span class="w-full h-1px bg-[--line-color]"></span>

        <n-flex align="center" justify="space-between" class="gap-12px flex-wrap">
          <n-flex vertical :size="4" class="min-w-160px flex-1">
            <span>{{ t('setting.voice_video.volume') }}</span>
          </n-flex>
          <n-flex align="center" :size="12">
            <n-slider class="flex-1 min-w-160px" v-model:value="volume" :step="1" :max="100" :min="0" />
            <n-input-number v-model:value="volume" size="small" class="w-80px" :min="0" :max="100" />
          </n-flex>
        </n-flex>
      </n-flex>
    </n-flex>

    <n-flex vertical class="text-(14px [--text-color])" :size="16">
      <span class="pl-10px">{{ t('setting.voice_video.video') }}</span>

      <n-flex class="item p-12px" :size="12" vertical>
        <n-flex align="center" justify="space-between">
          <n-flex vertical :size="4">
            <span>{{ t('setting.voice_video.camera') }}</span>
          </n-flex>
          <n-select
            v-model:value="camera"
            class="w-200px"
            size="small"
            :options="videoOptions"
            :placeholder="t('setting.voice_video.select_device')" />
        </n-flex>

        <span class="w-full h-1px bg-[--line-color]"></span>

        <n-flex align="center" justify="space-between">
          <n-flex vertical :size="4">
            <span>{{ t('setting.voice_video.hd_video') }}</span>
          </n-flex>
          <n-switch size="small" v-model:value="hdVideo" />
        </n-flex>

        <span class="w-full h-1px bg-[--line-color]"></span>

        <n-flex align="center" justify="space-between">
          <n-flex vertical :size="4">
            <span>{{ t('setting.voice_video.preview') }}</span>
          </n-flex>
          <n-button size="small" secondary @click="handlePreview">
            {{ t('setting.voice_video.start_preview') }}
          </n-button>
        </n-flex>
      </n-flex>
    </n-flex>
  </n-flex>
</template>

<script setup lang="ts">
import { NButton, NSwitch, NSelect, NSlider, NInputNumber, NFlex, useMessage } from 'naive-ui'
import { useI18n } from 'vue-i18n'

const { t } = useI18n()
const message = useMessage()

const microphone = ref<string | null>(null)
const speaker = ref<string | null>(null)
const camera = ref<string | null>(null)
const volume = ref(80)
const noiseSuppression = ref(true)
const echoCancellation = ref(true)
const hdVideo = ref(true)

const audioInputOptions = ref([
  { label: '内置麦克风', value: 'builtin_mic' },
  { label: '外接麦克风', value: 'external_mic' }
])

const audioOutputOptions = ref([
  { label: '内置扬声器', value: 'builtin_speaker' },
  { label: '外接扬声器', value: 'external_speaker' }
])

const videoOptions = ref([
  { label: '内置摄像头', value: 'builtin_camera' },
  { label: '外接摄像头', value: 'external_camera' }
])

const handleTestMicrophone = () => {
  message.info(t('setting.voice_video.testing_microphone'))
}

const handleTestSpeaker = () => {
  message.info(t('setting.voice_video.testing_speaker'))
}

const handlePreview = () => {
  message.info(t('setting.voice_video.starting_preview'))
}
</script>

<style scoped lang="scss">
.item {
  @apply bg-[--bg-setting-item] rounded-12px size-full p-12px box-border border-(solid 1px [--line-color]) custom-shadow;
}
</style>
