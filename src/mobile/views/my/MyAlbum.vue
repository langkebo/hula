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

            <MobileAsyncState
              v-else-if="isAlbumEmpty"
              state="empty"
              :empty-text="t('mobile_photo.empty')"
              min-height="200px" />

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
      :message="previewMessage"
      :show-forward="false"
      :show-save="true"
      :show-more="false" />
  </div>
</template>

<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import { useActionFeedback } from '@/composables/common/useActionFeedback'
import MobileAsyncState from '@/mobile/components/common/MobileAsyncState.vue'
import ImagePreview from '@/mobile/components/ImagePreview.vue'
import { scanLocalAlbum } from '@/mobile/services/localAlbumScanner'
import { useUserStore } from '@/stores/domains/user/user'
import { useFileStore } from '@/stores/domains/widget/file'
import { useGlobalStore } from '@/stores/domains/widget/global'
import { extractFileName } from '@/utils/Formatting'
import { createLogger } from '@/utils/Logger'

const logger = createLogger('MyAlbum')

const { t } = useI18n()
const { showFeedback } = useActionFeedback()
const fileStore = useFileStore()
const globalStore = useGlobalStore()
const userStore = useUserStore()

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

/** 相册无图片：交给 MobileAsyncState 统一渲染 */
const isAlbumEmpty = computed(() => allImages.value.length === 0)

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
        // 扫描器只在移动端模块里（本页即移动端专属入口），store 不再判平台
        await scanLocalAlbum(globalStore.currentSessionRoomId, {
          getUserRoomDir: () => userStore.getUserRoomDir(),
          addFile: (file) => fileStore.addFile(file)
        })
      }
    }

    const roomFilesMap = fileStore.roomFilesMap
    const imagesList: Array<{ displayUrl: string; originalUrl: string; id: string; roomId: string }> = []

    for (const roomId in roomFilesMap) {
      const files = await fileStore.getRoomFilesForDisplay(roomId)

      const images = files.filter((file) => file.type === 'image')

      imagesList.push(
        ...images.map((img) => ({
          displayUrl: img.displayUrl,
          originalUrl: img.originalUrl,
          id: img.id,
          roomId: img.roomId
        }))
      )
    }

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
  activeImage.value = image
  showImagePreviewRef.value = true
}

onMounted(() => {
  getAllImages()
})
</script>

<style scoped></style>
