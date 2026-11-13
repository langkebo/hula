<template>
  <div class="flex flex-col h-full">
    <div class="flex justify-between items-center p-16px">
      <div v-clickable @click="() => router.back()">
        <svg class="iconpark-icon w-24px h-24px" aria-hidden="true"><use href="#fanhui"></use></svg>
      </div>
      <van-dropdown-menu>
        <van-dropdown-item v-model="mediaType" :options="typeOptions" />
      </van-dropdown-menu>
    </div>
    <div ref="scrollContainerRef" class="flex-1 p-16px overflow-auto">
      <div class="grid grid-cols-4 gap-4px">
        <div
          v-for="image in visibleImages"
          :key="image.url"
          class="overflow-hidden bg-gray-100 aspect-square"
          @click="
            () => {
              activeImage = image
              showImagePreviewRef = true
            }
          ">
          <img
            :src="image.url"
            class="w-full h-full"
            loading="lazy"
            decoding="async"
            :alt="t('mobile_chat.media_viewer.image_alt')" />
        </div>
      </div>
      <div ref="sentinelRef" class="h-1px" aria-hidden="true"></div>
    </div>

    <component
      :is="ImagePreview"
      v-if="ImagePreview"
      v-model:visible="showImagePreviewRef"
      :image-url="activeImage?.url || ''" />
  </div>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'
import { mobileOnlyAsyncComponent } from '@/composables/usePlatform'
import { useFileStore } from '@/stores/domains/widget/file'
import { useGlobalStore } from '@/stores/domains/widget/global'
import { MEDIA_BATCH_SIZE, nextMediaBatchCount, sliceMediaBatch } from './mediaBatch'

const ImagePreview = mobileOnlyAsyncComponent(() => import('@/mobile/components/ImagePreview.vue'))

const router = useRouter()
const { t } = useI18n()
const fileStore = useFileStore()
const globalStore = useGlobalStore()

const showImagePreviewRef = ref(false)
const activeImage = ref<{ url: string }>()
const mediaType = ref(0)

const typeOptions = [
  { text: t('mobile_chat.media_viewer.all'), value: 0 },
  { text: t('mobile_chat.media_viewer.image'), value: 1 },
  { text: t('mobile_chat.media_viewer.video'), value: 2 }
]

const imageList = ref<{ url: string }[]>([])
const renderCount = ref(MEDIA_BATCH_SIZE)
const visibleImages = computed(() => sliceMediaBatch(imageList.value, renderCount.value))

const scrollContainerRef = ref<HTMLElement>()
const sentinelRef = ref<HTMLElement>()
let observer: IntersectionObserver | null = null

const hasMore = () => renderCount.value < imageList.value.length

const loadMore = () => {
  if (!hasMore()) return
  renderCount.value = nextMediaBatchCount(renderCount.value, imageList.value.length)
}

const observeSentinel = () => {
  if (typeof IntersectionObserver === 'undefined') {
    // 不支持交叉观察的旧 WebView 直接全量渲染，避免无法继续加载
    renderCount.value = imageList.value.length
    return
  }
  observer?.disconnect()
  observer = new IntersectionObserver(
    (entries) => {
      if (entries.some((entry) => entry.isIntersecting)) loadMore()
    },
    { root: scrollContainerRef.value ?? null, rootMargin: '0px 0px 200px 0px' }
  )
  if (sentinelRef.value) observer.observe(sentinelRef.value)
}

const getImageList = async () => {
  const data = await fileStore.getRoomFilesForDisplay(globalStore.currentSessionRoomId)
  const filteredImages = data.filter((item) => {
    if (mediaType.value === 0) return item.type === 'image' || item.type === 'video'
    if (mediaType.value === 1) return item.type === 'image'
    if (mediaType.value === 2) return item.type === 'video'
    return true
  })
  imageList.value = filteredImages.map((item) => ({ url: item.displayUrl }))
  renderCount.value = typeof IntersectionObserver === 'undefined' ? imageList.value.length : MEDIA_BATCH_SIZE
}

onMounted(() => {
  observeSentinel()
  getImageList()
})

onBeforeUnmount(() => {
  observer?.disconnect()
  observer = null
})
</script>
