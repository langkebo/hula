<template>
  <div
    ref="container"
    class="voice-container select-none cursor-pointer"
    :class="{ playing: audioPlayback.isPlaying.value, loading: playbackBusy }"
    @click="handleContainerClick">
    <!-- 语音图标 -->
    <div class="voice-icon select-none cursor-pointer">
      <img
        v-if="playbackBusy"
        class="loading-icon"
        :style="{ color: voiceIconColor }"
        src="@/assets/img/loading.svg"
        alt="loading" />
      <svg v-else-if="audioPlayback.isPlaying.value" :style="{ color: voiceIconColor }">
        <use href="#pause-one"></use>
      </svg>
      <svg v-else :style="{ color: voiceIconColor }">
        <use href="#play"></use>
      </svg>
    </div>

    <!-- 音浪波形 -->
    <div
      class="waveform-container select-none cursor-pointer"
      :style="{ width: `${waveformRenderer.waveformWidth.value}px` }">
      <canvas
        ref="waveformCanvas"
        class="waveform-canvas"
        :style="{ color: voiceIconColor }"
        :width="waveformRenderer.waveformWidth.value"
        height="24"
        @click.stop="handleSeekToPosition"
        @mousedown.stop="handleDragStart"
        @touchstart.stop="handleDragStart"
        @pointerdown.stop></canvas>
      <div
        class="scan-line"
        :class="{ active: audioPlayback.isPlaying.value, dragging: dragControl.isDragging.value }"
        :style="{
          left: `${waveformRenderer.scanLinePosition.value}px`,
          background: `linear-gradient(to bottom, transparent, ${voiceIconColor}, transparent)`,
          boxShadow:
            audioPlayback.isPlaying.value || dragControl.isDragging.value ? `0 0 8px ${voiceIconColor}50` : 'none'
        }"></div>

      <!-- 时间预览提示 -->
      <div
        v-if="dragControl.showTimePreview.value"
        class="time-preview"
        :style="{
          left: `${waveformRenderer.scanLinePosition.value}px`,
          ...timePreviewStyle
        }">
        {{ formatDuration(dragControl.previewTime.value) }}
      </div>
    </div>

    <!-- 语音时长 -->
    <div class="voice-second select-none cursor-pointer" :style="{ color: voiceIconColor }">
      {{ formatDuration(second) }}
    </div>
  </div>
</template>

<script setup lang="ts">
import { useVoiceAudioLoader } from '@/composables/chat/useVoiceAudioLoader'
import { useVoiceDragControl } from '@/composables/chat/useVoiceDragControl'
import { useWaveformRenderer } from '@/composables/chat/useWaveformRenderer'
import { useAudioPlayback } from '@/composables/common/useAudioPlayback'
import type { MsgType, VoiceBody } from '@/services/types'
import { useSettingStore } from '@/stores/domains/settings/setting'
import { useUserStore } from '@/stores/domains/user/user'
import { formatDuration } from '@/utils/Formatting'

const props = defineProps<{
  body: VoiceBody
  fromUserUid: string
  message?: MsgType
}>()

const settingStore = useSettingStore()
const userStore = useUserStore()

// 使用messageId作为音频ID，确保唯一性
const rawAudioUrl = computed(() => props.body.mxcUrl || props.body.url)
const audioId = rawAudioUrl.value || props.body.url
const waveformCanvas = ref<HTMLCanvasElement | null>(null)
const container = ref<HTMLElement | null>(null)

// 判断是否为当前用户发送的消息
const isCurrentUser = computed(() => {
  return props.fromUserUid === userStore.userInfo?.uid
})

// 语音主色：对方气泡浅底用主文本色，自己发送的深色气泡用反色
const voiceIconColor = computed(() => (isCurrentUser.value ? 'var(--tjg-text-inverse)' : 'var(--tjg-text-primary)'))

const timePreviewStyle = computed(() => {
  const self = isCurrentUser.value
  return {
    color: self ? 'var(--tjg-text-inverse)' : 'var(--tjg-text-primary)',
    backgroundColor: self ? 'var(--tjg-overlay-inverse-strong)' : 'var(--tjg-surface-panel)',
    border: self ? 'none' : '1px solid var(--tjg-border-strong)'
  }
})

// 音频时长
const second = computed(() => props.body.second || 0)
// 音频播放控制
const audioPlayback = useAudioPlayback(audioId, () => {
  // 时间更新回调，用于重绘波形
  waveformRenderer.drawWaveformThrottled()
})

// 拖拽控制
const dragControl = useVoiceDragControl(
  waveformCanvas,
  second,
  audioPlayback.isPlaying,
  (time: number) => {
    // 首次拖拽时音频可能还没创建，先按需准备再 seek
    void audioLoader.preparePlayer().then(() => {
      audioPlayback.seekToTime(time)
      waveformRenderer.drawWaveformImmediate()
    })
  },
  async (shouldPlay: boolean) => {
    if (shouldPlay) {
      await audioLoader.preparePlayer()
      await audioPlayback.togglePlayback()
    } else {
      if (audioPlayback.audioElement.value) {
        audioPlayback.audioElement.value.pause()
        audioPlayback.isPlaying.value = false
      }
    }
  }
)

// 波形渲染
const waveformRenderer = useWaveformRenderer(
  second,
  audioPlayback.playbackProgress,
  dragControl.isDragging,
  dragControl.previewTime,
  () => getWaveformColors()
)

// 语音文件的惰性加载：进入视口只加载波形，首次播放才创建音频元素
const audioLoader = useVoiceAudioLoader({
  body: () => props.body,
  duration: second,
  renderer: waveformRenderer,
  playback: audioPlayback
})

const playbackBusy = computed(() => audioLoader.preparing.value || audioPlayback.loading.value)

// 计算波形颜色状态
const getWaveformColors = () => {
  const baseColor = voiceIconColor.value

  // 已播放区域颜色（始终完全不透明）
  const playedColor = baseColor

  // 未播放区域颜色（根据播放状态调整透明度）
  if (audioPlayback.isPlaying.value || dragControl.isDragging.value) {
    return {
      playedColor,
      unplayedColor: isCurrentUser.value
        ? 'color-mix(in srgb, var(--tjg-text-inverse) 30%, transparent)'
        : 'color-mix(in srgb, var(--tjg-text-primary) 30%, transparent)'
    }
  }

  return { playedColor, unplayedColor: baseColor }
}

// 点击波形跳转到指定位置
const handleSeekToPosition = async (event: MouseEvent) => {
  if (dragControl.isDragging.value) return
  if (!audioPlayback.audioElement.value) {
    const ready = await audioLoader.preparePlayer()
    if (!ready) return
  }
  if (!audioPlayback.audioElement.value || !waveformCanvas.value) return

  const rect = waveformCanvas.value.getBoundingClientRect()
  const clickX = event.clientX - rect.left
  const progress = Math.max(0, Math.min(1, clickX / rect.width))
  const targetTime = progress * audioPlayback.audioElement.value.duration

  audioPlayback.seekToTime(targetTime)
  waveformRenderer.drawWaveformImmediate()
}

// 首次拖拽时音频元素可能还没创建，先按需准备（预览仍基于消息时长，不阻塞手势）
const handleDragStart = (event: MouseEvent | TouchEvent) => {
  void audioLoader.preparePlayer()
  dragControl.handleDragStart(event)
}

const handleContainerClick = async () => {
  if (!audioPlayback.audioElement.value) {
    const ready = await audioLoader.preparePlayer()
    if (!ready) return
  }
  await audioPlayback.togglePlayback()
}

watch(
  () => settingStore.themeContent,
  () => {
    waveformRenderer.shouldUpdateCache.value = true
    waveformRenderer.drawWaveform()
  }
)

watch(audioPlayback.isPlaying, () => {
  waveformRenderer.shouldUpdateCache.value = true
  waveformRenderer.drawWaveform()
})

// 组件挂载：只绑定 canvas 并注册可见性监听，重 I/O 交给 audioLoader 按需执行
onMounted(() => {
  waveformRenderer.waveformCanvas.value = waveformCanvas.value
  audioLoader.observeVisibility(container.value)
})

onUnmounted(() => {
  audioPlayback.cleanup()
  dragControl.cleanup()
  audioLoader.cleanup()
})
</script>

<style scoped lang="scss">
.voice-container {
  display: flex;
  align-items: center;
  gap: 12px;
  border-radius: var(--tjg-radius-surface);
  cursor: pointer;
  transition:
    color var(--tjg-motion-duration-normal) ease,
    background-color var(--tjg-motion-duration-normal) ease,
    border-color var(--tjg-motion-duration-normal) ease,
    box-shadow var(--tjg-motion-duration-normal) ease,
    opacity var(--tjg-motion-duration-normal) ease,
    transform var(--tjg-motion-duration-normal) ease;
  &.loading {
    cursor: wait;
    opacity: 0.7;
  }
}

.voice-icon {
  width: 24px;
  height: 24px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--tjg-text-primary);

  svg {
    width: 18px;
    height: 18px;

    &.loading-icon {
      animation: spin 1s linear infinite;
    }
  }
}

.waveform-container {
  position: relative;
  height: 24px;
  display: flex;
  align-items: center;
  cursor: pointer;
  // 扩展触摸区域（移动端优化）
  padding: 4px 0;
  margin: -4px 0;

  .waveform-canvas {
    width: 100%;
    height: 100%;
    border-radius: 4px;
    user-select: none;
    -webkit-user-select: none;
  }

  .scan-line {
    position: absolute;
    top: 0;
    width: 2px;
    height: 100%;
    border-radius: 1px;
    opacity: 0;
    transition:
      color var(--tjg-motion-duration-fast) ease,
      background-color var(--tjg-motion-duration-fast) ease,
      border-color var(--tjg-motion-duration-fast) ease,
      box-shadow var(--tjg-motion-duration-fast) ease,
      opacity var(--tjg-motion-duration-fast) ease,
      transform var(--tjg-motion-duration-fast) ease;
    pointer-events: none;
    z-index: 1;

    &.active {
      opacity: 0.8;
    }

    &.dragging {
      opacity: 1;
      width: 4px; // 拖拽时加宽
      transition: none; // 禁用过渡效果，实现即时响应
    }
  }

  .time-preview {
    position: absolute;
    top: -28px;
    transform: translateX(-50%);
    padding: 4px 8px;
    border-radius: 4px;
    font-size: 12px;
    white-space: nowrap;
    pointer-events: none;
    z-index: 2;
    box-shadow: var(--tjg-shadow-sm);
    animation: fadeIn var(--tjg-motion-duration-normal) ease;
  }
}

.voice-second {
  font-size: 12px;
  white-space: nowrap;
}

@keyframes spin {
  0% {
    transform: rotate(0deg);
  }
  100% {
    transform: rotate(360deg);
  }
}

@keyframes fadeIn {
  0% {
    opacity: 0;
    transform: translateX(-50%) translateY(-4px);
  }
  100% {
    opacity: 1;
    transform: translateX(-50%) translateY(0);
  }
}
</style>
