<template>
  <div class="flex flex-col h-full">
    <div class="flex justify-between items-center p-16px">
      <div @click="() => router.back()">
        <svg class="iconpark-icon w-24px h-24px"><use href="#fanhui"></use></svg>
      </div>
      <van-dropdown-menu>
        <van-dropdown-item v-model="mediaType" :options="typeOptions" />
      </van-dropdown-menu>
    </div>
    <div class="flex-1 p-16px overflow-auto">
      <div class="grid grid-cols-4 gap-4px">
        <div
          v-for="(image, index) in imageList"
          :key="index"
          class="overflow-hidden bg-gray-100 aspect-square"
          @click="
            () => {
              activeImage = image
              showImagePreviewRef = true
            }
          ">
          <img :src="image.url" class="w-full h-full" />
        </div>
      </div>
    </div>

    <component
      :is="ImagePreview"
      v-if="ImagePreview"
      v-model:visible="showImagePreviewRef"
      :image-url="activeImage?.url || ''" />
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, defineAsyncComponent } from 'vue'
import { useRouter } from 'vue-router'
import { useFileStore } from '@/stores/domains/widget/file'
import { useGlobalStore } from '@/stores/domains/widget/global'
import { isMobile } from '@/utils/PlatformConstants'

const ImagePreview = isMobile() ? defineAsyncComponent(() => import('@/mobile/components/ImagePreview.vue')) : void 0

const router = useRouter()
const fileStore = useFileStore()
const globalStore = useGlobalStore()

const showImagePreviewRef = ref(false)
const activeImage = ref<{ url: string }>()
const mediaType = ref(0)

const typeOptions = [
  { text: '图片与视频', value: 0 },
  { text: '图片', value: 1 },
  { text: '视频', value: 2 }
]

const imageList = ref<{ url: string }[]>([])

const getImageList = async () => {
  const data = await fileStore.getRoomFilesForDisplay(globalStore.currentSessionRoomId)
  const filteredImages = data.filter((item) => {
    if (mediaType.value === 0) return item.type === 'image' || item.type === 'video'
    if (mediaType.value === 1) return item.type === 'image'
    if (mediaType.value === 2) return item.type === 'video'
    return true
  })
  imageList.value = filteredImages.map((item) => ({ url: item.displayUrl }))
}

onMounted(() => {
  getImageList()
})
</script>
