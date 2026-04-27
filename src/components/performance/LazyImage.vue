<template>
  <div ref="containerRef" class="lazy-image-container" :style="containerStyle">
    <div v-if="loading || !loaded" class="image-placeholder">
      <n-spin v-if="loading" size="small" />
      <n-icon v-else size="24" color="#ccc">
        <svg><use href="#image" /></svg>
      </n-icon>
    </div>

    <img
      v-show="loaded"
      ref="imgRef"
      :src="currentSrc"
      :alt="alt"
      :style="imageStyle"
      class="lazy-image"
      :class="{ loaded, error }"
      @load="handleLoad"
      @error="handleError"
      @click="handlePreview" />

    <div v-if="error" class="image-error">
      <n-icon size="24" color="#e74c3c">
        <svg><use href="#error" /></svg>
      </n-icon>
      <span>{{ t('image.load_failed') }}</span>
      <n-button size="tiny" @click="retry">{{ t('common.retry') }}</n-button>
    </div>

    <div v-if="showProgress && loading" class="loading-progress">
      <n-progress type="line" :percentage="progress" :show-indicator="false" :height="2" />
    </div>
  </div>
</template>

<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import { useIntersectionObserver } from '@vueuse/core'

const { t } = useI18n()

const props = withDefaults(
  defineProps<{
    src: string
    thumbnail?: string
    alt?: string
    width?: number | string
    height?: number | string
    fit?: 'fill' | 'contain' | 'cover' | 'none' | 'scale-down'
    lazy?: boolean
    showProgress?: boolean
    preview?: boolean
  }>(),
  {
    fit: 'cover',
    lazy: true,
    showProgress: false,
    preview: true
  }
)

const emit = defineEmits<{
  (e: 'load'): void
  (e: 'error', err: Error): void
  (e: 'preview'): void
}>()

const containerRef = ref<HTMLElement | null>(null)
const imgRef = ref<HTMLImageElement | null>(null)

const loading = ref(false)
const loaded = ref(false)
const error = ref(false)
const progress = ref(0)
const isInView = ref(false)

const currentSrc = computed(() => {
  if (props.lazy && !isInView.value) {
    return ''
  }
  return props.thumbnail || props.src
})

const containerStyle = computed(() => ({
  width: typeof props.width === 'number' ? `${props.width}px` : props.width,
  height: typeof props.height === 'number' ? `${props.height}px` : props.height
}))

const imageStyle = computed(() => ({
  objectFit: props.fit
}))

const handleLoad = () => {
  loaded.value = true
  loading.value = false
  error.value = false
  emit('load')

  if (props.thumbnail && props.src !== props.thumbnail && imgRef.value) {
    const hdImg = new Image()
    hdImg.src = props.src
    hdImg.onload = () => {
      if (imgRef.value) {
        imgRef.value.src = props.src
      }
    }
  }
}

const handleError = () => {
  loading.value = false
  error.value = true
  emit('error', new Error('Image load failed'))
}

const handlePreview = () => {
  if (props.preview && loaded.value) {
    emit('preview')
  }
}

const retry = () => {
  error.value = false
  loaded.value = false
  loading.value = true

  if (imgRef.value) {
    imgRef.value.src = ''
    nextTick(() => {
      if (imgRef.value) {
        imgRef.value.src = props.src
      }
    })
  }
}

const loadImage = () => {
  if (!props.lazy || isInView.value) {
    loading.value = true
  }
}

if (props.lazy) {
  useIntersectionObserver(
    containerRef,
    ([{ isIntersecting }]) => {
      if (isIntersecting && !isInView.value) {
        isInView.value = true
        loadImage()
      }
    },
    { rootMargin: '100px' }
  )
} else {
  onMounted(loadImage)
}
</script>

<style scoped lang="scss">
.lazy-image-container {
  position: relative;
  display: inline-block;
  overflow: hidden;
  background: var(--bg-color);
  border-radius: 8px;
}

.image-placeholder {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--bg-color);
}

.lazy-image {
  display: block;
  width: 100%;
  height: 100%;
  opacity: 0;
  transition: opacity 0.3s ease;

  &.loaded {
    opacity: 1;
  }

  &.error {
    opacity: 0;
  }
}

.image-error {
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 8px;
  background: var(--bg-color);
  font-size: 12px;
  color: var(--hula-text-tertiary);
}

.loading-progress {
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  padding: 4px;
  background: linear-gradient(transparent, rgba(0, 0, 0, 0.5));
}
</style>
