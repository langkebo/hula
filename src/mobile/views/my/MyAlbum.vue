<template>
  <div>
    <AutoFixHeightPage :show-footer="false">
      <template #header>
        <HeaderBar
          :isOfficial="false"
          class="bg-white"
          style="border-bottom: 1px solid; border-color: var(--hula-border-default)"
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
              <svg class="iconpark-icon w-60px h-60px text-gray">
                <use href="#xiangce"></use>
              </svg>
              <div class="text-gray text-14px">{{ t('mobile_photo.empty') }}</div>
            </div>

            <div v-else class="grid grid-cols-4 gap-1">
              <div
                v-for="(image, index) in allImages"
                :key="index"
                class="overflow-hidden bg-gray-100 aspect-square cursor-pointer"
                @click="handleImageClick(image)">
                <img :src="image.displayUrl" class="w-full h-full object-cover" :alt="t('mobile_photo.image_alt')" />
              </div>
            </div>
          </div>
        </div>
      </template>
    </AutoFixHeightPage>

    <ImagePreview
      v-model:visible="showImagePreviewRef"
      :image-url="activeImageUrl"
      :show-forward="false"
      :show-save="false"
      :show-more="false" />
  </div>
</template>

<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import { useActionFeedback } from '@/composables/common/useActionFeedback'
import ImagePreview from '@/mobile/components/ImagePreview.vue'
import { useFileStore } from '@/stores/domains/widget/file'
import { useGlobalStore } from '@/stores/domains/widget/global'
import { createLogger } from '@/utils/Logger'

const logger = createLogger('MyAlbum')

const { t } = useI18n()
const { showFeedback } = useActionFeedback()
const fileStore = useFileStore()
const globalStore = useGlobalStore()

const showImagePreviewRef = ref(false)
const activeImageUrl = ref('')
const loading = ref(true)

const allImages = ref<Array<{ displayUrl: string; originalUrl: string; id: string; roomId: string }>>([])

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
  } catch (error) {
    logger.error('Failed to load images', error)
    showFeedback(t('mobile_photo.image_load_failed'), 'error')
  } finally {
    loading.value = false
  }
}

const handleImageClick = (image: { displayUrl: string; originalUrl: string; id: string; roomId: string }) => {
  logger.debug('Image clicked:', image)
  activeImageUrl.value = image.displayUrl
  showImagePreviewRef.value = true
}

onMounted(() => {
  logger.debug('MyAlbum mounted')
  getAllImages()
})
</script>

<style scoped></style>
