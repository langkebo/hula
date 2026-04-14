<template>
  <span v-if="hasTags" class="room-tag-icon">
    <Icon
      v-if="isFavorite"
      icon="ion:star"
      :width="size"
      color="#fa8c16"
      class="favorite-icon" />
    <Icon
      v-if="isLowPriority"
      icon="ion:arrow-down"
      :width="size"
      color="#faad14"
      class="low-priority-icon" />
  </span>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { Icon } from '@iconify/vue'

const props = withDefaults(
  defineProps<{
    isFavorite?: boolean
    isLowPriority?: boolean
    size?: number
  }>(),
  {
    isFavorite: false,
    isLowPriority: false,
    size: 14
  }
)

const hasTags = computed(() => props.isFavorite || props.isLowPriority)
</script>

<style scoped lang="scss">
.room-tag-icon {
  display: inline-flex;
  align-items: center;
  gap: 2px;
  margin-left: 4px;
}

.favorite-icon {
  animation: pulse 0.3s ease-in-out;
}

.low-priority-icon {
  opacity: 0.7;
}

@keyframes pulse {
  0% {
    transform: scale(1);
  }
  50% {
    transform: scale(1.2);
  }
  100% {
    transform: scale(1);
  }
}
</style>
