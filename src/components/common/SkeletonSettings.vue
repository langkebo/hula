<template>
  <div class="skeleton-settings" role="status" aria-label="Loading">
    <div class="skeleton-settings__nav">
      <div v-for="i in navItems" :key="`nav-${i}`" class="skeleton-settings__nav-item">
        <SkeletonBase variant="rect" :width="16" :height="16" />
        <SkeletonBase variant="text" :width="getNavWidth(i)" height="14px" />
      </div>
    </div>
    <div class="skeleton-settings__form">
      <div v-for="i in formFields" :key="`field-${i}`" class="skeleton-settings__field">
        <SkeletonBase class="skeleton-settings__label" variant="text" :width="getLabelWidth(i)" height="12px" />
        <SkeletonBase class="skeleton-settings__input" variant="rect" width="100%" height="36px" />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import SkeletonBase from './SkeletonBase.vue'

defineOptions({ name: 'SkeletonSettings' })

withDefaults(
  defineProps<{
    navItems?: number
    formFields?: number
  }>(),
  {
    navItems: 4,
    formFields: 4
  }
)

const navWidths = ['80%', '60%', '70%', '90%', '50%']
const labelWidths = ['30%', '25%', '40%', '35%', '20%']

function getNavWidth(index: number): string {
  return navWidths[(index - 1) % navWidths.length] ?? '70%'
}

function getLabelWidth(index: number): string {
  return labelWidths[(index - 1) % labelWidths.length] ?? '30%'
}
</script>

<style scoped lang="scss">
.skeleton-settings {
  display: flex;
  gap: 24px;
  padding: 16px;
  min-height: 300px;

  &__nav {
    display: flex;
    flex-direction: column;
    gap: 16px;
    width: 200px;
    flex-shrink: 0;
  }

  &__nav-item {
    display: flex;
    align-items: center;
    gap: 10px;
  }

  &__form {
    display: flex;
    flex-direction: column;
    gap: 20px;
    flex: 1;
  }

  &__field {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  &__label {
    max-width: 120px;
  }

  &__input {
    border-radius: 6px;
  }
}
</style>
