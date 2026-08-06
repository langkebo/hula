<template>
  <span
    class="tjg-avatar"
    :class="{ 'tjg-avatar--round': round }"
    :style="{ width: `${size}px`, height: `${size}px` }"
    role="img"
    :aria-label="ariaLabel || name">
    <!-- Primary image -->
    <img
      v-if="!hasError"
      :src="resolvedSrc"
      :alt="ariaLabel || name"
      loading="lazy"
      decoding="async"
      class="tjg-avatar__img"
      @error="handleError" />
    <!-- Fallback image -->
    <img
      v-else-if="!fallbackFailed"
      :src="resolvedFallback"
      :alt="ariaLabel || name"
      class="tjg-avatar__img tjg-avatar__img--fallback"
      decoding="async"
      @error="handleFallbackError" />
    <!-- Text initials fallback -->
    <span v-else class="tjg-avatar__initials" :style="{ background: initialsColor, fontSize: `${size * 0.4}px` }">
      {{ initials }}
    </span>
  </span>
</template>

<script setup lang="ts">
/**
 * 统一头像组件（需求文档 16.1）
 *
 * Fallback chain:
 * 1. Primary src (via AvatarUtils.getAvatarUrl)
 * 2. Theme-aware fallback image (/logoL.png or /logoD.png)
 * 3. Text initials with deterministic color (when name is provided)
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
    /** 用户名称，用于文字头像 fallback */
    name?: string
  }>(),
  {
    src: '',
    size: 44,
    round: true,
    fallbackSrc: '',
    ariaLabel: '',
    name: ''
  }
)

const settingStore = useSettingStore()
const hasError = ref(false)
const fallbackFailed = ref(false)

const resolvedSrc = computed(() => AvatarUtils.getAvatarUrl(props.src, props.size))

const resolvedFallback = computed(() => {
  if (props.fallbackSrc) return props.fallbackSrc
  return settingStore.themeContent === ThemeEnum.DARK ? '/logoL.png' : '/logoD.png'
})

/** Generate 1-2 character initials from name */
const initials = computed(() => {
  if (!props.name) return '?'
  const parts = props.name.trim().split(/\s+/)
  if (parts.length >= 2) {
    return (parts[0][0] + parts[1][0]).toUpperCase()
  }
  return props.name.slice(0, 2).toUpperCase()
})

/** Deterministic color from name hash */
const initialsColor = computed(() => {
  if (!props.name) return 'var(--tjg-surface-panel)'
  let hash = 0
  for (let i = 0; i < props.name.length; i++) {
    hash = props.name.charCodeAt(i) + ((hash << 5) - hash)
  }
  const hue = Math.abs(hash) % 360
  return `hsl(${hue}, 45%, 35%)`
})

const handleError = () => {
  hasError.value = true
}

const handleFallbackError = () => {
  fallbackFailed.value = true
}
</script>

<style scoped lang="scss">
.tjg-avatar {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
  background: var(--tjg-surface-panel);
  flex-shrink: 0;

  &--round {
    border-radius: 50%;
  }
}

.tjg-avatar__img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}

.tjg-avatar__initials {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  height: 100%;
  color: var(--tjg-text-inverse);
  font-weight: 600;
  user-select: none;
  line-height: 1;
}
</style>
