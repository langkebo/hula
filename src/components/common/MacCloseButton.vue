<template>
  <div class="mac-close-button" :class="[colorClass, $attrs.class]" v-bind="$attrs" @click="$emit('click', $event)">
    <svg class="mac-close-button__icon hidden"><use href="#close" /></svg>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'

const props = withDefaults(
  defineProps<{
    color?: 'primary' | 'danger'
  }>(),
  {
    color: 'danger'
  }
)

defineEmits<{
  click: [event: MouseEvent]
}>()

const colorClass = computed(() => `mac-close-button--${props.color}`)
</script>

<style scoped lang="scss">
.mac-close-button {
  width: 13px;
  height: 13px;
  border-radius: 50%;
  box-shadow: inset 0 0 0 1px rgba(0, 0, 0, 0.1);
  cursor: pointer;
  user-select: none;
  display: flex;
  align-items: center;
  justify-content: center;
}

.mac-close-button--danger {
  background: var(--tjg-color-danger-500);
}

.mac-close-button--primary {
  background: var(--tjg-color-primary-500);
}

.mac-close-button__icon {
  width: 8px;
  height: 8px;
  color: white;
}

.mac-close-button:hover .mac-close-button__icon {
  display: block;
}
</style>
