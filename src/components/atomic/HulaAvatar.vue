<template>
  <span
    class="hula-avatar"
    :class="{ 'hula-avatar--round': round }"
    :style="{ width: `${size}px`, height: `${size}px` }"
    role="img"
    :aria-label="ariaLabel">
    <img
      v-if="!hasError"
      :src="resolvedSrc"
      :alt="ariaLabel"
      loading="lazy"
      decoding="async"
      class="hula-avatar__img"
      @error="handleError" />
    <img
      v-else
      :src="resolvedFallback"
      :alt="ariaLabel"
      class="hula-avatar__img hula-avatar__img--fallback"
      decoding="async" />
  </span>
</template>

<script setup lang="ts">
/**
 * 统一头像组件（需求文档 16.1）
 *
 * 默认行为：
 * - 原生 `loading="lazy"` 实现懒加载（视口外不下载图片）
 * - `decoding="async"` 避免阻塞主线程解码
 * - 主题感知 fallback：暗色主题用 `/logoL.png`，亮色用 `/logoD.png`
 * - 主图加载失败时自动切换到 fallback
 *
 * 通过 `v-bind="$attrs"` 透传所有外部属性。
 */
import { computed, ref } from 'vue'
import { ThemeEnum } from '@/enums'
import { useSettingStore } from '@/stores/domains/settings/setting'
import { AvatarUtils } from '@/utils/AvatarUtils'

defineOptions({ inheritAttrs: false })

const props = withDefaults(
  defineProps<{
    src?: string | null
    size?: number
    round?: boolean
    /** 自定义 fallback，不传则按主题自动选择 */
    fallbackSrc?: string
    /** 无障碍标签，默认空字符串 */
    ariaLabel?: string
  }>(),
  {
    src: '',
    size: 44,
    round: true,
    fallbackSrc: '',
    ariaLabel: ''
  }
)

const settingStore = useSettingStore()
const hasError = ref(false)

const resolvedSrc = computed(() => AvatarUtils.getAvatarUrl(props.src))

const resolvedFallback = computed(() => {
  if (props.fallbackSrc) return props.fallbackSrc
  return settingStore.themeContent === ThemeEnum.DARK ? '/logoL.png' : '/logoD.png'
})

const handleError = () => {
  hasError.value = true
}
</script>

<style scoped lang="scss">
.hula-avatar {
  display: inline-block;
  overflow: hidden;
  background: var(--hula-surface-panel);
  flex-shrink: 0;

  &--round {
    border-radius: 50%;
  }
}

.hula-avatar__img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}
</style>
