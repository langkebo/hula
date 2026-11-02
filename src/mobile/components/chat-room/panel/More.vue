<template>
  <div class="h-15rem w-full">
    <div class="px-15px pt-15px pb-20px flex flex-wrap justify-around gap-4">
      <div
        v-for="item in options"
        :key="item.type"
        v-show="item.isShow()"
        class="flex flex-col gap-8px items-center justify-center w-16"
        @click="handleClickIcon(item)">
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

        <div class="text-10px">{{ t(item.labelKey) }}</div>
      </div>
    </div>

    <van-popup v-model:show="pickRtcCall" position="bottom">
      <div class="flex flex-col items-center justify-center">
        <div class="w-full text-center py-3" @click="startVideoCall">{{ t('mobile_chat.input_panel.video_call') }}</div>
        <div class="w-full text-center py-3" @click="startAudioCall">{{ t('mobile_chat.input_panel.audio_call') }}</div>
        <div class="w-full text-center py-3" @click="pickRtcCall = false">{{ t('common.cancel') }}</div>
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
import { useGlobalStore } from '@/stores/domains/widget/global'
import { createLogger } from '@/utils/Logger'

const logger = createLogger('More')
const { t } = useI18n()
const { showFeedback } = useActionFeedback()

const globalStore = useGlobalStore()

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

<style scoped></style>
