<template>
  <div
    class="skeleton-base"
    :class="[variantClass, { 'skeleton-base--compact': compact }]"
    aria-hidden="true"
    :style="skeletonStyle" />
</template>

<script setup lang="ts">
defineOptions({ name: 'SkeletonBase' })

const props = withDefaults(
  defineProps<{
    width?: string | number
    height?: string | number
    compact?: boolean
    variant?: 'text' | 'avatar' | 'card' | 'rect'
  }>(),
  {
    width: '100%',
    height: '14px',
    compact: false,
    variant: 'text'
  }
)

const variantClass = computed(() => `skeleton-base--${props.variant ?? 'text'}`)

const skeletonStyle = computed(() => ({
  width: typeof props.width === 'number' ? `${props.width}px` : props.width,
  height: typeof props.height === 'number' ? `${props.height}px` : props.height
}))
</script>

<style scoped lang="scss">
.skeleton-base {
  position: relative;
  overflow: hidden;
  background: color-mix(in srgb, var(--hula-text-tertiary) 12%, transparent);
  border-radius: 4px;

  &::after {
    content: '';
    position: absolute;
    inset: 0;
    background: linear-gradient(
      90deg,
      transparent 0%,
      color-mix(in srgb, var(--hula-text-tertiary) 8%, transparent) 40%,
      color-mix(in srgb, var(--hula-text-tertiary) 12%, transparent) 60%,
      transparent 100%
    );
    animation: skeleton-shimmer 1.8s ease-in-out infinite;
  }

  &--compact {
    height: 10px;
  }

  &--text {
    border-radius: 4px;
  }

  &--avatar {
    border-radius: 999px;
    width: 40px;
    height: 40px;
  }

  &--card {
    border-radius: 8px;
    min-height: 60px;
  }

  &--rect {
    border-radius: 6px;
  }
}

@keyframes skeleton-shimmer {
  0% {
    transform: translateX(-100%);
  }
  60% {
    transform: translateX(100%);
  }
  100% {
    transform: translateX(100%);
  }
}
</style>
