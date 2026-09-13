<template>
  <div class="h-15rem w-full">
    <div class="px-15px pt-15px pb-20px flex flex-wrap justify-around gap-4">
      <div
        v-for="item in options"
        :key="item.label"
        v-show="item.isShow()"
        class="flex flex-col gap-8px items-center justify-center w-16"
        @click="handleClickIcon(item)">
        <!-- 文件：原生选择器 -->
        <van-uploader v-if="item.label === '文件'" accept="*/*" multiple :after-read="afterReadFile">
          <svg class="h-24px w-24px iconpark-icon">
            <use :href="`#${item.icon}`"></use>
          </svg>
        </van-uploader>

        <!-- 图片：原生选择器 -->
        <van-uploader v-else-if="item.label === '图片'" accept="image/*" multiple :after-read="afterReadImage">
          <svg class="h-24px w-24px iconpark-icon">
            <use :href="`#${item.icon}`"></use>
          </svg>
        </van-uploader>

        <!-- 位置：触发位置选择 -->
        <svg v-else class="h-24px w-24px iconpark-icon">
          <use :href="`#${item.icon}`"></use>
        </svg>

        <div class="text-10px">{{ item.label }}</div>
      </div>
    </div>

    <van-popup v-model:show="pickRtcCall" position="bottom">
      <div class="flex flex-col items-center justify-center">
        <div class="w-full text-center py-3" @click="startVideoCall">视频通话</div>
        <div class="w-full text-center py-3" @click="startAudioCall">语音通话</div>
        <div class="w-full text-center py-3" @click="pickRtcCall = false">取消</div>
      </div>
    </van-popup>
  </div>
</template>

<script setup lang="ts">
import type { UploaderFileListItem } from 'vant'
import { useActionFeedback } from '@/composables/common/useActionFeedback'
import type { CallTypeEnum } from '@/enums'
import { CallTypeEnum as CallTypeEnumValue } from '@/enums'
import router from '@/router'
import { useGlobalStore } from '@/stores/domains/widget/global'
import { createLogger } from '@/utils/Logger'

const logger = createLogger('More')
const { showFeedback } = useActionFeedback()

const globalStore = useGlobalStore()

const pickRtcCall = ref(false)

// 对齐原型《移动端聊天输入栏》九宫格：图片 / 文件 / 语音 / 视频 / 位置
const options = ref([
  { label: '图片', icon: 'photo', onClick: () => {}, isShow: () => true },
  { label: '文件', icon: 'file', onClick: () => {}, isShow: () => true },
  {
    label: '语音',
    icon: 'voice',
    onClick: () => {
      pickRtcCall.value = true
    },
    isShow: () => true
  },
  {
    label: '视频',
    icon: 'video-one',
    onClick: () => {
      pickRtcCall.value = true
    },
    isShow: () => true
  },
  {
    label: '位置',
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

  logger.debug('选择的文件：', files)

  for (const file of files) {
    const rawFile = file.file

    if (!rawFile) {
      logger.debug('文件不存在:', file)
      continue
    }

    if (imageTypes.includes(rawFile.type)) {
      logger.debug('已过滤图片文件:', file)
      continue
    }

    selectedFiles.value.push(rawFile)
    uploadFileList.value.push({
      url: file.url as string,
      status: 'done',
      message: '待上传（非图片）'
    })

    logger.debug('已选择文件：', file)
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

  logger.debug('选择的文件：', files)

  for (const file of files) {
    const rawFile = file.file

    if (!rawFile) {
      logger.debug('文件不存在:', file)
      continue
    }

    if (!validTypes.includes(rawFile.type)) {
      logger.debug('已过滤非图片文件:', file)
      if (!Array.isArray(fileList)) {
        showFeedback('只能选择图片哦~', 'warning')
      }
      continue
    }

    selectedFiles.value.push(rawFile)
    uploadFileList.value.push({
      url: file.url as string,
      status: 'done',
      message: '待上传'
    })

    logger.debug('已添加文件：', file)
  }

  if (selectedFiles.value.length > 0) {
    emit('sendFiles', [...selectedFiles.value])
    selectedFiles.value = []
    uploadFileList.value = []
  }
}
</script>

<style scoped></style>
