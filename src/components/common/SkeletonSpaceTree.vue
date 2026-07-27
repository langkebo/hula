<template>
  <div class="skeleton-space-tree" role="status" aria-label="Loading">
    <div
      v-for="i in rows"
      :key="i"
      class="skeleton-space-tree__row"
      :class="`skeleton-space-tree__row--level-${getLevel(i)}`">
      <SkeletonBase variant="rect" :width="20" :height="20" />
      <SkeletonBase variant="text" :width="getTextWidth(i)" height="14px" />
    </div>
  </div>
</template>

<script setup lang="ts">
import SkeletonBase from './SkeletonBase.vue'

defineOptions({ name: 'SkeletonSpaceTree' })

withDefaults(
  defineProps<{
    rows?: number
  }>(),
  {
    rows: 4
  }
)

const textWidths = ['100%', '80%', '70%', '90%', '60%']

function getLevel(rowIndex: number): number {
  // 模拟空间树层级：每两行交替 level 0 / level 1
  return Math.floor((rowIndex - 1) / 2) % 2
}

function getTextWidth(rowIndex: number): string {
  return textWidths[(rowIndex - 1) % textWidths.length] ?? '80%'
}
</script>

<style scoped lang="scss">
.skeleton-space-tree {
  display: flex;
  flex-direction: column;
  gap: 16px;
  padding: 12px;

  &__row {
    display: flex;
    align-items: center;
    gap: 12px;

    &--level-0 {
      padding-left: 0;
    }

    &--level-1 {
      padding-left: 24px;
    }
  }
}
</style>
