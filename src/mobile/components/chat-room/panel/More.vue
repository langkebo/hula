<template>
  <div class="more-panel h-15rem w-full">
    <div class="more-grid">
      <div
        v-for="item in options"
        :key="item.type"
        v-show="item.isShow()"
        class="more-item"
        role="button"
        :aria-label="t(item.labelKey)"
        @click="handleClickIcon(item)">
        <span class="more-item__icon">
          <!-- 文件：原生选择器 -->
          <van-uploader v-if="item.type === 'file'" accept="*/*" multiple :after-read="afterReadFile">
            <svg class="h-24px w-24px iconpark-icon">
              <use :href="`#${item.icon}`"></use>
            </svg>
          </van-uploader>

          <!-- 图片：原生选择器 -->
          <van-uploader v-else-if="item.type === 'image'" accept="image/*" multiple :after-read="afterReadImage">
            <svg class="h-24px w-24px iconpark-icon">
              <use :href="`#${item.icon}`"></use>
            </svg>
          </van-uploader>

          <!-- 位置：触发位置选择 -->
          <svg v-else class="h-24px w-24px iconpark-icon">
            <use :href="`#${item.icon}`"></use>
          </svg>
        </span>

        <span class="more-item__label">{{ t(item.labelKey) }}</span>
      </div>
    </div>

    <van-popup v-model:show="pickRtcCall" position="bottom" round class="rtc-sheet">
      <div class="rtc-sheet__list">
        <button type="button" class="rtc-sheet__item" @click="startVideoCall">
          {{ t('mobile_chat.input_panel.video_call') }}
        </button>
        <button type="button" class="rtc-sheet__item" @click="startAudioCall">
          {{ t('mobile_chat.input_panel.audio_call') }}
        </button>
        <button type="button" class="rtc-sheet__item rtc-sheet__item--cancel" @click="pickRtcCall = false">
          {{ t('common.cancel') }}
        </button>
      </div>
    </van-popup>
  </div>
</template>

<script setup lang="ts">
import type { UploaderFileListItem } from 'vant'
import { useI18n } from 'vue-i18n'
import { useActionFeedback } from '@/composables/common/useActionFeedback'
import type { CallTypeEnum } from '@/enums'
import { CallTypeEnum as CallTypeEnumValue } from '@/enums'
import router from '@/router'
import { useServerCapability } from '@/services/matrix/MatrixCapabilityService'
import { useSettingStore } from '@/stores/domains/settings/setting'
import { useGlobalStore } from '@/stores/domains/widget/global'
import { createLogger } from '@/utils/Logger'

const logger = createLogger('More')
const { t } = useI18n()
const { showFeedback } = useActionFeedback()

const globalStore = useGlobalStore()
const settingStore = useSettingStore()

// 语音/视频通话入口依赖服务端 voip 能力
const canUseVoip = useServerCapability().canUseVoip

const pickRtcCall = ref(false)

// 对齐原型《移动端聊天输入栏》九宫格：图片 / 文件 / 语音 / 视频 / 位置
const options = ref([
  { type: 'image', labelKey: 'mobile_chat.input_panel.image', icon: 'photo', onClick: () => {}, isShow: () => true },
  { type: 'file', labelKey: 'mobile_chat.input_panel.file', icon: 'file', onClick: () => {}, isShow: () => true },
  {
    type: 'voice',
    labelKey: 'mobile_chat.input_panel.voice',
    icon: 'voice',
    onClick: () => {
      pickRtcCall.value = true
    },
    isShow: () => canUseVoip.value
  },
  {
    type: 'video',
    labelKey: 'mobile_chat.input_panel.video',
    icon: 'video-one',
    onClick: () => {
      pickRtcCall.value = true
    },
    isShow: () => canUseVoip.value
  },
  {
    type: 'link',
    labelKey: 'mobile_chat.input_panel.link_preview',
    icon: 'link',
    onClick: () => {
      emit('linkPreview')
    },
    isShow: () => settingStore.linkPreviewEnabled
  },
  {
    type: 'location',
    labelKey: 'mobile_chat.input_panel.location',
    icon: 'location',
    onClick: () => {
      emit('location')
    },
    isShow: () => true
  }
])

type PanelOption = (typeof options.value)[number]

const handleClickIcon = (item: PanelOption) => {
  item.onClick()
}

const startCall = (callType: CallTypeEnum) => {
  const currentSession = globalStore.currentSession
  if (!currentSession?.detailId) {
    pickRtcCall.value = false
    return
  }
  router.push({
    path: `/mobile/rtcCall`,
    query: {
      remoteUserId: currentSession.detailId,
      roomId: globalStore.currentSessionRoomId,
      callType: callType
    }
  })
}

const startVideoCall = () => {
  startCall(CallTypeEnumValue.VIDEO)
}

const startAudioCall = () => {
  startCall(CallTypeEnumValue.AUDIO)
}

const emit = defineEmits<{
  (e: 'sendFiles', files: File[]): void
  (e: 'location'): void
  (e: 'linkPreview'): void
}>()

const selectedFiles = ref<File[]>([])

const uploadFileList = ref<
  {
    url: string
    status: 'uploading' | 'failed' | 'done'
    message: string
  }[]
>([])

const afterReadFile = (fileList: UploaderFileListItem | UploaderFileListItem[]) => {
  const imageTypes = ['image/jpeg', 'image/png', 'image/gif']
  const files = Array.isArray(fileList) ? fileList : [fileList]

  logger.debug('Selected files:', files)

  for (const file of files) {
    const rawFile = file.file

    if (!rawFile) {
      logger.debug('File not found:', file)
      continue
    }

    if (imageTypes.includes(rawFile.type)) {
      logger.debug('Filtered image file:', file)
      continue
    }

    selectedFiles.value.push(rawFile)
    uploadFileList.value.push({
      url: file.url as string,
      status: 'done',
      message: 'pending-upload-non-image'
    })

    logger.debug('Selected file:', file)
  }

  if (selectedFiles.value.length > 0) {
    emit('sendFiles', [...selectedFiles.value])
    selectedFiles.value = []
    uploadFileList.value = []
  }
}

const afterReadImage = (fileList: UploaderFileListItem | UploaderFileListItem[]) => {
  const validTypes = ['image/jpeg', 'image/png', 'image/gif']
  const files = Array.isArray(fileList) ? fileList : [fileList]

  logger.debug('Selected files:', files)

  for (const file of files) {
    const rawFile = file.file

    if (!rawFile) {
      logger.debug('File not found:', file)
      continue
    }

    if (!validTypes.includes(rawFile.type)) {
      logger.debug('Filtered non-image file:', file)
      if (!Array.isArray(fileList)) {
        showFeedback(t('mobile_chat.input_panel.only_image'), 'warning')
      }
      continue
    }

    selectedFiles.value.push(rawFile)
    uploadFileList.value.push({
      url: file.url as string,
      status: 'done',
      message: 'pending-upload'
    })

    logger.debug('Added file:', file)
  }

  if (selectedFiles.value.length > 0) {
    emit('sendFiles', [...selectedFiles.value])
    selectedFiles.value = []
    uploadFileList.value = []
  }
}
</script>

<style scoped lang="scss">
@use '@/styles/scss/mixins/liquid-glass' as *;

/* 功能面板九宫格：每格是独立玻璃卡片，热区不小于 44px */
.more-panel {
  color: var(--tjg-text-primary);
}

.more-grid {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 12px;
  padding: 14px 14px 18px;
}

.more-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 8px;
  min-height: 88px;
  padding: 10px 4px;
  border-radius: var(--tjg-radius-xl);
  background: var(--tjg-glass-row-bg);
  border: var(--tjg-glass-border-soft);
  box-shadow: var(--tjg-glass-inner-highlight);
  cursor: pointer;
  -webkit-tap-highlight-color: transparent;
  transition:
    background-color var(--tjg-motion-duration-fast) var(--tjg-motion-ease-standard),
    transform var(--tjg-motion-duration-fast) var(--tjg-motion-ease-standard);
}

.more-item:active {
  background: var(--tjg-glass-row-bg-pressed);
  transform: scale(var(--tjg-glass-press-scale));
}

.more-item__icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 44px;
  height: 44px;
  border-radius: var(--tjg-radius-full);
  color: var(--tjg-color-primary-500);
  background: var(--tjg-glass-tint-soft);
  box-shadow: var(--tjg-glass-inner-highlight);
}

.more-item__icon :deep(.van-uploader__wrapper),
.more-item__icon :deep(.van-uploader),
.more-item__icon :deep(.van-uploader__input-wrapper) {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 44px;
  height: 44px;
  border-radius: var(--tjg-radius-full);
}

.more-item__label {
  font-size: var(--tjg-font-size-2xs);
  line-height: 1.2;
  color: var(--tjg-text-secondary);
  text-align: center;
}

/* 通话选择弹层：底部玻璃抽屉 + 44px 行高 */
.rtc-sheet {
  background: var(--tjg-glass-sheet-bg);
  -webkit-backdrop-filter: blur(var(--tjg-glass-blur-strong)) saturate(var(--tjg-glass-saturate-soft));
  backdrop-filter: blur(var(--tjg-glass-blur-strong)) saturate(var(--tjg-glass-saturate-soft));
  border-top: var(--tjg-glass-border-soft);
  box-shadow: var(--tjg-glass-inner-highlight), var(--tjg-glass-shadow-strong);

  /* 低性能设备关闭模糊 */
  @include backdrop-blur-fallback;
}

@supports not ((backdrop-filter: blur(1px)) or (-webkit-backdrop-filter: blur(1px))) {
  .rtc-sheet {
    background: var(--tjg-surface-panel);
    -webkit-backdrop-filter: none;
    backdrop-filter: none;
  }
}

.rtc-sheet__list {
  display: flex;
  flex-direction: column;
  padding: 8px 0 calc(8px + env(safe-area-inset-bottom));
}

.rtc-sheet__item {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  min-height: 52px;
  padding: 0 16px;
  border: none;
  background: transparent;
  color: var(--tjg-text-primary);
  font-size: var(--tjg-font-size-md);
  cursor: pointer;
  -webkit-tap-highlight-color: transparent;
  transition: background-color var(--tjg-motion-duration-fast) var(--tjg-motion-ease-standard);
}

.rtc-sheet__item:active {
  background: var(--tjg-glass-row-bg-pressed);
}

.rtc-sheet__item--cancel {
  margin-top: 6px;
  color: var(--tjg-text-secondary);
}

@media (max-width: 360px) {
  .more-grid {
    gap: 10px;
    padding: 12px 10px 16px;
  }

  .more-item {
    min-height: 80px;
  }
}

@media (prefers-reduced-motion: reduce) {
  .more-item,
  .rtc-sheet__item {
    transition: none;
  }

  .more-item:active {
    transform: none;
  }
}
</style>
