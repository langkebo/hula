<template>
  <main class="link-preview-message" @click.stop="handleLinkClick">
    <!-- 原文链接或内容展示 -->
    <div
      v-if="showUrl"
      class="text-14px color-[--tjg-text-tertiary] mb-8px break-words whitespace-pre-wrap leading-relaxed">
      <a
        :href="body?.url"
        target="_blank"
        rel="noopener noreferrer"
        class="color-[--tjg-color-primary-500] hover:underline"
        @click.prevent.stop="handleLinkClick">
        {{ body?.url }}
      </a>
    </div>

    <!-- 预览卡片 -->
    <div class="preview-card" :class="{ 'has-image': !!body?.imageUrl }">
      <!-- 图片部分 -->
      <div v-if="body?.imageUrl" class="preview-image-wrapper">
        <n-image
          :src="avatarUrl"
          fallback-src="/default-image.png"
          class="preview-image"
          object-fit="cover"
          preview-disabled />
      </div>

      <!-- 内容部分 -->
      <div class="preview-content">
        <h3 class="preview-title line-clamp-2" :title="body?.title">
          {{ body?.title || t('chat.link_preview.unknown_link') }}
        </h3>

        <p v-if="body?.description" class="preview-desc line-clamp-3" :title="body?.description">
          {{ body?.description }}
        </p>

        <div class="preview-footer flex-y-center mt-auto pt-6px">
          <svg class="size-12px color-[--tjg-text-quaternary] mr-4px">
            <use href="#link"></use>
          </svg>
          <span class="text-11px color-[--tjg-text-quaternary] truncate">
            {{ body?.siteName || domainName }}
          </span>
        </div>
      </div>
    </div>
  </main>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { openExternalUrl } from '@/composables/common/useLinkSegments'
import { matrixMediaService } from '@/services/matrix/media/MatrixMediaService'
import type { LinkPreviewBody } from '@/services/types'

defineOptions({
  inheritAttrs: false
})

const { t } = useI18n()

const props = withDefaults(
  defineProps<{
    body?: LinkPreviewBody
    showUrl?: boolean
  }>(),
  {
    body: undefined,
    showUrl: true
  }
)

// 提取域名用于显示来源
const domainName = computed(() => {
  if (!props.body?.url) return '未知来源'
  try {
    const url = new URL(props.body.url)
    return url.hostname
  } catch (e) {
    return '未知来源'
  }
})

// 将 Matrix 协议的 mxc:// 图片 URL 转换为 HTTP URL
const avatarUrl = computed(() => {
  if (!props.body?.imageUrl) return ''

  if (props.body.imageUrl.startsWith('mxc://')) {
    return matrixMediaService.getMediaUrl(props.body.imageUrl, 90, 90) || ''
  }

  return props.body.imageUrl
})

const handleLinkClick = () => {
  if (props.body?.url) {
    void openExternalUrl(props.body.url)
  }
}
</script>

<style scoped lang="scss">
.link-preview-message {
  @apply: w-fit max-w-320px flex flex-col;
}

.preview-card {
  cursor: pointer;
  @apply: flex flex-col bg-[--tjg-surface-muted]
  border-(1px solid [--tjg-border-default])
  hover:bg-[--tjg-fill-hover] rounded-8px overflow-hidden box-border
  custom-shadow transition-colors duration-200;

  &.has-image {
    @apply: flex-row h-90px;

    .preview-image-wrapper {
      @apply: w-90px h-full flex-shrink-0 bg-[--tjg-surface-app];
    }

    .preview-image {
      @apply: w-full h-full;
      :deep(img) {
        @apply: w-full h-full object-cover;
      }
    }

    .preview-content {
      @apply: flex-1 p-8px flex flex-col min-w-0;
    }

    .preview-title {
      @apply: text-13px font-medium color-[--tjg-text-primary] leading-tight mb-4px;
    }

    .preview-desc {
      @apply: text-12px color-[--tjg-text-secondary] leading-snug;
      /* 在水平模式下描述最多显示两行 */
      -webkit-line-clamp: 2 !important;
    }
  }

  &:not(.has-image) {
    @apply: p-10px;

    .preview-title {
      @apply: text-14px font-medium color-[--tjg-text-primary] leading-tight mb-6px;
    }

    .preview-desc {
      @apply: text-12px color-[--tjg-text-secondary] leading-normal;
    }
  }
}
</style>
