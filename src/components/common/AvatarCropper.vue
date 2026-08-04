<template>
  <n-modal
    :show="props.show"
    @update:show="$emit('update:show', $event)"
    :mask-closable="false"
    class="rounded-8px"
    transform-origin="center">
    <div class="bg-[--tjg-border-muted] w-560px h-480px box-border flex flex-col items-center justify-between">
      <!-- 标题栏 -->
      <n-flex :size="6" vertical class="w-full">
        <MacCloseButton v-if="isMac()" class="mt-6px absolute left-6px" @click="closeWindow" />

        <n-flex class="text-(14px [--tjg-text-primary]) select-none pt-6px" justify="center">
          {{ t('components.avatarCropper.title') }}
        </n-flex>

        <svg
          v-if="isWindows()"
          class="size-14px cursor-pointer pt-6px select-none absolute right-6px"
          @click="closeWindow">
          <use href="#close"></use>
        </svg>
        <span class="h-1px w-full bg-[--tjg-border-default]"></span>
      </n-flex>

      <!-- 主体内容 - 仅在模态框可见且有图片时渲染 VueCropperComp -->
      <n-flex align="center">
        <!-- 裁剪区域 -->
        <div class="w-320px h-320px p-10px mr-20px">
          <VueCropperComp
            v-if="cropperReady"
            ref="cropperRef"
            :img="localImageUrl"
            :outputSize="1"
            :outputType="'png'"
            :autoCrop="true"
            :fixedBox="true"
            :fixed="true"
            :centerBox="true"
            :autoCropWidth="320"
            :autoCropHeight="320"
            :fixedNumber="[1, 1]"
            @realTime="handleRealTime" />
        </div>

        <!-- 预览区域 -->
        <n-flex vertical class="px-20px">
          <!-- 圆形预览 -->
          <div class="mb-20px">
            <div class="text-14px text-[--tjg-text-primary] mb-8px">
              {{ t('components.avatarCropper.preview.round') }}
            </div>
            <div class="preview-wrapper preview-round">
              <div
                class="preview-content"
                :style="{
                  width: previewUrl?.w + 'px',
                  height: previewUrl?.h + 'px',
                  overflow: 'hidden',
                  transform: previewScaleTransform,
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  transformOrigin: '0 0'
                }">
                <img v-if="previewUrl?.url" :src="previewUrl.url" :style="previewUrl?.img" />
              </div>
            </div>
          </div>

          <!-- 方形预览 -->
          <div>
            <div class="text-14px text-[--tjg-text-primary] mb-8px w-120px">
              {{ t('components.avatarCropper.preview.square') }}
            </div>
            <div class="preview-wrapper preview-square">
              <div
                class="preview-content"
                :style="{
                  width: previewUrl?.w + 'px',
                  height: previewUrl?.h + 'px',
                  overflow: 'hidden',
                  transform: previewScaleTransform,
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  transformOrigin: '0 0'
                }">
                <img v-if="previewUrl?.url" :src="previewUrl.url" :style="previewUrl?.img" />
              </div>
            </div>
          </div>
        </n-flex>
      </n-flex>
      <n-flex class="p-12px" align="center" justify="center" :size="12">
        <n-button quaternary @click="closeWindow" :disabled="loading">{{ t('components.common.cancel') }}</n-button>
        <n-button secondary type="primary" @click="handleCrop" :loading="loading">{{ loadingText }}</n-button>
      </n-flex>
    </div>
  </n-modal>
</template>

<script setup lang="ts">
import type { CSSProperties } from 'vue'
// biome-ignore lint/style/useImportType: used as component in template
import { VueCropper as VueCropperComp } from 'vue-cropper'
import { useI18n } from 'vue-i18n'
import 'vue-cropper/dist/index.css'
import MacCloseButton from '@/components/common/MacCloseButton.vue'
import { isMac, isWindows } from '@/utils/PlatformConstants'

const { t } = useI18n()
const localImageUrl = ref('')
const cropperReady = ref(false)

type CropPreview = {
  url: string
  img: CSSProperties | null
  w: number
  h: number
}

type VueCropperInstance = InstanceType<typeof VueCropperComp> & {
  getCropBlob: (callback: (blob: Blob) => void) => void
}

const cropperRef = ref<HTMLElement | null>(null)
const loading = ref(false)
const loadingText = computed(() =>
  loading.value ? t('components.avatarCropper.uploading') : t('components.common.confirm')
)
const previewUrl = ref<CropPreview | null>(null)

// Calculate scale factor to fit preview into the wrapper (128px)
const PREVIEW_SIZE = 128
const previewScaleTransform = computed(() => {
  if (!previewUrl.value?.w || !previewUrl.value?.h) return 'scale(1)'
  const scale = PREVIEW_SIZE / Math.max(previewUrl.value.w, previewUrl.value.h)
  return `scale(${scale})`
})

const emit = defineEmits<{
  'update:show': [value: boolean]
  crop: [data: Blob]
}>()

const props = defineProps<{
  show: boolean
  imageUrl: string
}>()

// 监听 show 和 imageUrl，在模态框可见且有图片时延迟渲染 VueCropperComp
watch(
  [() => props.show, () => props.imageUrl],
  ([show, imageUrl]) => {
    if (show && imageUrl) {
      // 等待模态框 DOM 渲染完成后再初始化裁剪组件
      nextTick(() => {
        localImageUrl.value = imageUrl
        cropperReady.value = true
      })
    } else {
      cropperReady.value = false
      localImageUrl.value = ''
      previewUrl.value = null
    }
  },
  { immediate: true }
)

const handleRealTime = (data: CropPreview) => {
  previewUrl.value = data
}

const handleCrop = () => {
  loading.value = true

  const cropper = cropperRef.value as unknown as VueCropperInstance | null
  if (!cropper?.getCropBlob) {
    loading.value = false
    return
  }

  cropper.getCropBlob((blob: Blob) => {
    emit('crop', blob)
  })
}

/** 关闭裁剪窗口 */
const closeWindow = () => {
  if (!loading.value) {
    emit('update:show', false)
  }
}

/** 结束加载状态 */
const finishLoading = () => {
  loading.value = false
}

// 定义组件实例类型
export interface AvatarCropperInstance {
  finishLoading: () => void
}
defineExpose<AvatarCropperInstance>({
  finishLoading
})

// 确保在组件卸载时清理预览
onUnmounted(() => {
  previewUrl.value = {
    url: '',
    img: null,
    w: 0,
    h: 0
  }
})
</script>

<style scoped>
/* 修改裁剪框样式 */
:deep(.cropper-view-box) {
  border-radius: 50%;
  outline: none;
  outline-color: transparent;
}

:deep(.cropper-face) {
  background-color: transparent;
  border-radius: 50%;
}

:deep(.cropper-dashed) {
  display: none;
}

/* 添加预览图片的过渡效果 */
img {
  transition: opacity 0.2s ease-in-out;
}

.preview-wrapper {
  position: relative;
  width: 128px;
  height: 128px;
  overflow: hidden;
}

.preview-round {
  border-radius: 50%;
}

.preview-square {
  border-radius: 36px;
}

.preview-content {
  transform-origin: left top;
}
</style>
