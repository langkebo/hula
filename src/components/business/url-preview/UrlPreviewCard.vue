<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import {
  matrixUrlPreviewService,
  type UrlPreview,
  simplifyUrl,
  getDomain
} from '@/services/matrix/media/MatrixUrlPreviewService'

interface Props {
  url: string
  showImage?: boolean
  maxWidth?: number
}

const props = withDefaults(defineProps<Props>(), {
  showImage: true,
  maxWidth: 400
})

const loading = ref(true)
const preview = ref<UrlPreview | null>(null)
const error = ref(false)

const displayUrl = computed(() => simplifyUrl(props.url))
const domain = computed(() => getDomain(props.url))

onMounted(async () => {
  try {
    preview.value = await matrixUrlPreviewService.getPreview({ url: props.url })
  } catch (e) {
    error.value = true
  } finally {
    loading.value = false
  }
})

const handleClick = () => {
  window.open(props.url, '_blank')
}
</script>

<template>
  <div class="url-preview-card" :style="{ maxWidth: `${maxWidth}px` }" @click="handleClick">
    <!-- 加载状态 -->
    <div v-if="loading" class="url-preview-loading">
      <div class="loading-spinner"></div>
      <span>加载预览...</span>
    </div>

    <!-- 错误状态 -->
    <div v-else-if="error || !preview" class="url-preview-error">
      <div class="link-icon">🔗</div>
      <span class="url-text">{{ displayUrl }}</span>
    </div>

    <!-- 预览内容 -->
    <template v-else>
      <!-- 图片 -->
      <div v-if="showImage && preview.imageUrl" class="url-preview-image">
        <img :src="preview.imageUrl" :alt="preview.title" />
      </div>

      <!-- 文本内容 -->
      <div class="url-preview-content">
        <div v-if="preview.siteName" class="site-name">
          {{ preview.siteName }}
        </div>
        <div v-if="preview.title" class="preview-title">
          {{ preview.title }}
        </div>
        <div v-if="preview.description" class="preview-description">
          {{ preview.description }}
        </div>
        <div class="preview-url">
          {{ displayUrl }}
        </div>
      </div>
    </template>
  </div>
</template>

<style scoped lang="scss">
.url-preview-card {
  border: 1px solid var(--border-color, #e0e0e0);
  border-radius: 8px;
  overflow: hidden;
  cursor: pointer;
  background: var(--bg-color, #fff);
  transition: box-shadow 0.2s;

  &:hover {
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  }
}

.url-preview-loading {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 12px;
  color: var(--text-secondary, #999);

  .loading-spinner {
    width: 16px;
    height: 16px;
    border: 2px solid var(--border-color, #e0e0e0);
    border-top-color: var(--primary-color, #007aff);
    border-radius: 50%;
    animation: spin 0.8s linear infinite;
  }
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

.url-preview-error {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 12px;

  .link-icon {
    font-size: 16px;
  }

  .url-text {
    color: var(--primary-color, #007aff);
    word-break: break-all;
  }
}

.url-preview-image {
  width: 100%;
  max-height: 200px;
  overflow: hidden;

  img {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }
}

.url-preview-content {
  padding: 12px;
}

.site-name {
  font-size: 12px;
  color: var(--text-secondary, #999);
  margin-bottom: 4px;
}

.preview-title {
  font-size: 14px;
  font-weight: 600;
  color: var(--text-primary, #333);
  margin-bottom: 4px;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.preview-description {
  font-size: 13px;
  color: var(--text-secondary, #666);
  margin-bottom: 8px;
  display: -webkit-box;
  -webkit-line-clamp: 3;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.preview-url {
  font-size: 12px;
  color: var(--text-secondary, #999);
}
</style>
