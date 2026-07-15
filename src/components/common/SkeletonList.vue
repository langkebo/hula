<template>
  <div class="skeleton-list" :class="{ 'skeleton-list--compact': compact }" role="status" aria-label="Loading">
    <div v-for="i in count" :key="i" class="skeleton-list__row">
      <SkeletonBase v-if="hasAvatar" variant="avatar" :compact="compact" :width="avatarSize" :height="avatarSize" />
      <div class="skeleton-list__lines">
        <SkeletonBase
          v-for="j in lines"
          :key="j"
          variant="text"
          :compact="compact"
          :width="getLineWidth(i, j)"
          :height="compact ? '10px' : '14px'" />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import SkeletonBase from './SkeletonBase.vue'

defineOptions({ name: 'SkeletonList' })

withDefaults(
  defineProps<{
    count?: number
    lines?: number
    hasAvatar?: boolean
    avatarSize?: number
    compact?: boolean
  }>(),
  {
    count: 5,
    lines: 2,
    hasAvatar: false,
    avatarSize: 40,
    compact: false
  }
)

const lineWidthVariants = ['100%', '75%', '60%', '85%', '50%']

function getLineWidth(rowIndex: number, lineIndex: number): string {
  return lineIndex === 0 ? '100%' : (lineWidthVariants[(rowIndex + lineIndex) % lineWidthVariants.length] ?? '75%')
}
</script>

<style scoped lang="scss">
.skeleton-list {
  display: flex;
  flex-direction: column;
  gap: 16px;
  padding: 12px;

  &--compact {
    gap: 10px;
    padding: 8px;
  }

  &__row {
    display: flex;
    align-items: flex-start;
    gap: 12px;
  }

  &__lines {
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: 8px;
    min-width: 0;
  }
}
</style>
