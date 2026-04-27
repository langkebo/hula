<template>
  <div
    class="voice-container select-none cursor-pointer"
    :class="{ playing: audioPlayback.isPlaying.value, loading: audioPlayback.loading.value }"
    @click="audioPlayback.togglePlayback">
    <!-- 语音图标 -->
    <div class="voice-icon select-none cursor-pointer">
      <img
        v-if="audioPlayback.loading.value"
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
        @mousedown.stop="dragControl.handleDragStart"
        @touchstart.stop="dragControl.handleDragStart"
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
        {{ formatTime(dragControl.previewTime.value) }}
      </div>
    </div>

    <!-- 语音时长 -->
    <div class="voice-second select-none cursor-pointer" :style="{ color: voiceIconColor }">
      {{ formatTime(second) }}
    </div>
  </div>
</template>

<script setup lang="ts">
import { useAudioFileManager } from '@/hooks/useAudioFileManager'
import { useAudioPlayback } from '@/hooks/useAudioPlayback'
import { useVoiceDragControl } from '@/hooks/useVoiceDragControl'
import { useWaveformRenderer } from '@/hooks/useWaveformRenderer'
import { matrixVoiceService } from '@/services/matrix/media/MatrixVoiceService'
import type { VoiceBody } from '@/services/types'
import { useSettingStore } from '@/stores/domains/settings/setting'
import { useUserStore } from '@/stores/domains/user/user'

import { createLogger } from '@/utils/Logger'
const logger = createLogger('Voice')

const props = defineProps<{
  body: VoiceBody
  fromUserUid: string
}>()

const settingStore = useSettingStore()
const userStore = useUserStore()

// 使用messageId作为音频ID，确保唯一性
const rawAudioUrl = computed(() => props.body.mxcUrl || props.body.url)
const playableAudioUrl = computed(() => {
  return matrixVoiceService.getPlayableUrl(props.body.mxcUrl, props.body.url)
})
const audioId = rawAudioUrl.value || props.body.url
const waveformCanvas = ref<HTMLCanvasElement | null>(null)

// 判断是否为当前用户发送的消息
const isCurrentUser = computed(() => {
  return props.fromUserUid === userStore.userInfo?.uid
})

// 计算语音图标颜色
const voiceIconColor = computed(() => {
  return isCurrentUser.value ? 'var(--hula-text-inverse)' : 'var(--hula-text-primary)'
})

const timePreviewStyle = computed(() => {
  if (isCurrentUser.value) {
    return {
      color: 'var(--hula-text-inverse)',
      backgroundColor: 'var(--hula-overlay-inverse-strong)',
      border: 'none'
    }
  }

  return {
    color: 'var(--hula-text-primary)',
    backgroundColor: 'var(--hula-surface-panel)',
    border: '1px solid var(--hula-border-strong)'
  }
})

// 音频时长
const second = computed(() => props.body.second || 0)
// 音频文件管理
const fileManager = useAudioFileManager(userStore.userInfo?.uid as string)
// 音频播放控制
const audioPlayback = useAudioPlayback(audioId, (_currentTime: number, _progress: number) => {
  // 时间更新回调，用于重绘波形
  waveformRenderer.drawWaveformThrottled()
})

// 拖拽控制
const dragControl = useVoiceDragControl(
  waveformCanvas,
  second,
  audioPlayback.isPlaying,
  (time: number) => {
    audioPlayback.seekToTime(time)
    waveformRenderer.drawWaveformImmediate()
  },
  async (shouldPlay: boolean) => {
    if (shouldPlay) {
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

// 计算波形颜色状态
const getWaveformColors = () => {
  const baseColor = isCurrentUser.value ? 'var(--hula-text-inverse)' : 'var(--hula-text-primary)'

  // 已播放区域颜色（始终完全不透明）
  const playedColor = baseColor

  // 未播放区域颜色（根据播放状态调整透明度）
  if (audioPlayback.isPlaying.value || dragControl.isDragging.value) {
    return {
      playedColor,
      unplayedColor: isCurrentUser.value
        ? 'color-mix(in srgb, var(--hula-text-inverse) 30%, transparent)'
        : 'color-mix(in srgb, var(--hula-text-primary) 30%, transparent)'
    }
  }

  return { playedColor, unplayedColor: baseColor }
}

// 格式化时间
const formatTime = (seconds: number) => {
  const mins = Math.floor(seconds / 60)
  const secs = Math.floor(seconds % 60)
  return `${mins}:${secs.toString().padStart(2, '0')}`
}

// 点击波形跳转到指定位置
const handleSeekToPosition = (event: MouseEvent) => {
  if (!audioPlayback.audioElement.value || !waveformCanvas.value || dragControl.isDragging.value) return

  const rect = waveformCanvas.value.getBoundingClientRect()
  const clickX = event.clientX - rect.left
  const progress = Math.max(0, Math.min(1, clickX / rect.width))
  const targetTime = progress * audioPlayback.audioElement.value.duration

  audioPlayback.seekToTime(targetTime)
  waveformRenderer.drawWaveformImmediate()
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

// 组件挂载
onMounted(async () => {
  try {
    // 设置Canvas引用
    waveformRenderer.waveformCanvas.value = waveformCanvas.value

    // 加载音频波形数据
    const audioBuffer = await fileManager.loadAudioWaveform(playableAudioUrl.value)
    await waveformRenderer.generateWaveformData(audioBuffer)

    // 创建音频元素
    const audioUrl = await fileManager.getAudioUrl(playableAudioUrl.value)
    await audioPlayback.createAudioElement(audioUrl, audioId, second.value)
  } catch (error) {
    logger.error('组件初始化失败:', error)
  }
})
onUnmounted(() => {
  audioPlayback.cleanup()
  dragControl.cleanup()
  fileManager.cleanup()
})
</script>

<style scoped lang="scss">
.voice-container {
  display: flex;
  align-items: center;
  gap: 12px;
  border-radius: 18px;
  cursor: pointer;
  transition: all 0.2s ease;
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
  color: var(--hula-text-primary);

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
    transition: all 0.1s ease;
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
    box-shadow: var(--hula-shadow-sm);
    animation: fadeIn 0.2s ease;
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
