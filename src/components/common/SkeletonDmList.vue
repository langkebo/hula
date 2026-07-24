<template>
  <SkeletonList :count="rows" :has-avatar="true" :lines="2" :avatar-size="40" />
</template>

<script setup lang="ts">
import SkeletonList from './SkeletonList.vue'

defineOptions({ name: 'SkeletonDmList' })

withDefaults(
  defineProps<{
    rows?: number
  }>(),
  {
    rows: 5
  }
)
</script>
