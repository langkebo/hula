<template>
  <div>
    <AutoFixHeightPage :show-footer="false">
      <template #header>
        <HeaderBar
          :isOfficial="false"
          class="bg-white border-b border-[--tjg-border-default]"
          :hidden-right="true"
          :room-name="t('mobile_photo.title')" />
      </template>

      <template #container>
        <div class="flex flex-col overflow-auto h-full">
          <div class="flex flex-col p-20px gap-20px">
            <div v-if="loading" class="flex justify-center items-center py-40px">
              <van-loading size="24px" />
            </div>

            <div v-else-if="allImages.length === 0" class="flex flex-col justify-center items-center py-40px gap-10px">
              <svg class="iconpark-icon w-60px h-60px text-gray" aria-hidden="true">
                <use href="#xiangce"></use>
              </svg>
              <div class="text-gray text-14px">{{ t('mobile_photo.empty') }}</div>
            </div>

            <div v-else class="grid grid-cols-4 gap-1">
              <div
                v-for="image in visibleImages"
                :key="image.id"
                class="overflow-hidden bg-gray-100 aspect-square cursor-pointer"
                @click="handleImageClick(image)">
                <img
                  :src="image.displayUrl"
                  class="w-full h-full object-cover"
                  loading="lazy"
                  :alt="t('mobile_photo.image_alt')" />
              </div>
            </div>

            <div v-if="hasMore" class="flex justify-center pb-16px">
              <van-button size="small" plain @click="loadMore">{{ t('common.load_more') }}</van-button>
            </div>
          </div>
        </div>
      </template>
    </AutoFixHeightPage>

    <ImagePreview
      v-model:visible="showImagePreviewRef"
      :image-url="previewUrl"
      v-bind="previewMessage ? { message: previewMessage } : {}"
      :show-forward="false"
      :show-save="true"
      :show-more="false" />
  </div>
</template>

<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import { useActionFeedback } from '@/composables/common/useActionFeedback'
import ImagePreview from '@/mobile/components/ImagePreview.vue'
import { useFileStore } from '@/stores/domains/widget/file'
import { useGlobalStore } from '@/stores/domains/widget/global'
import { extractFileName } from '@/utils/Formatting'
import { createLogger } from '@/utils/Logger'

const logger = createLogger('MyAlbum')

const { t } = useI18n()
const { showFeedback } = useActionFeedback()
const fileStore = useFileStore()
const globalStore = useGlobalStore()

const PAGE_SIZE = 40

interface AlbumImage {
  displayUrl: string
  originalUrl: string
  id: string
  roomId: string
}

const showImagePreviewRef = ref(false)
const activeImage = ref<AlbumImage | null>(null)
const loading = ref(true)
const visibleCount = ref(PAGE_SIZE)

const allImages = ref<AlbumImage[]>([])

/** 分页渲染，避免一次性挂载全部图片导致首屏卡顿（Y-10） */
const visibleImages = computed(() => allImages.value.slice(0, visibleCount.value))
const hasMore = computed(() => visibleCount.value < allImages.value.length)

const loadMore = () => {
  visibleCount.value += PAGE_SIZE
}

/** 远程原图直接用原始 URL；本地文件用 asset 协议地址（本身就是原图） */
const previewUrl = computed(() => {
  const image = activeImage.value
  if (!image) return ''
  return image.originalUrl.startsWith('http') ? image.originalUrl : image.displayUrl
})

/** ImagePreview 的保存链路需要消息体：远程传原图 URL，本地文件传 localPath（Y-10） */
const previewMessage = computed(() => {
  const image = activeImage.value
  if (!image) return undefined
  const isRemote = image.originalUrl.startsWith('http')
  const body = isRemote
    ? { url: image.originalUrl, fileName: extractFileName(image.originalUrl) }
    : { localPath: image.originalUrl }
  return {
    id: image.id,
    roomId: image.roomId,
    body
  }
})

const getAllImages = async () => {
  loading.value = true
  try {
    if (Object.keys(fileStore.roomFilesMap).length === 0) {
      if (globalStore.currentSessionRoomId) {
        logger.debug('Scanning local files for room:', globalStore.currentSessionRoomId)
        await fileStore.scanLocalFiles(globalStore.currentSessionRoomId)
      }
    }

    const roomFilesMap = fileStore.roomFilesMap
    logger.debug('roomFilesMap:', roomFilesMap)
    const imagesList: Array<{ displayUrl: string; originalUrl: string; id: string; roomId: string }> = []

    for (const roomId in roomFilesMap) {
      const files = await fileStore.getRoomFilesForDisplay(roomId)
      logger.debug('roomId:', roomId, 'files:', files)

      const images = files.filter((file) => file.type === 'image')
      logger.debug('roomId:', roomId, 'images:', images)

      imagesList.push(
        ...images.map((img) => ({
          displayUrl: img.displayUrl,
          originalUrl: img.originalUrl,
          id: img.id,
          roomId: img.roomId
        }))
      )
    }

    logger.debug('Final image list:', imagesList)
    allImages.value = imagesList
    visibleCount.value = PAGE_SIZE
  } catch (error) {
    logger.error('Failed to load images', error)
    showFeedback(t('mobile_photo.image_load_failed'), 'error')
  } finally {
    loading.value = false
  }
}

const handleImageClick = (image: AlbumImage) => {
  logger.debug('Image clicked:', image)
  activeImage.value = image
  showImagePreviewRef.value = true
}

onMounted(() => {
  logger.debug('MyAlbum mounted')
  getAllImages()
})
</script>

<style scoped></style>
