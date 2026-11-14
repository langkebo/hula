<template>
  <footer class="float-footer-button" :style="floatStyle">
    <div
      class="float-box"
      :class="{ max: count > 99 }"
      role="button"
      tabindex="0"
      :aria-label="t('home.chat_main.new_messages', { count: label })"
      @click="emit('click')"
      @keydown.enter.prevent="emit('click')"
      @keydown.space.prevent="emit('click')">
      <n-flex justify="space-between" align="center">
        <n-icon :color="count > 99 ? 'var(--tjg-color-danger-500)' : 'var(--tjg-color-primary-500)'">
          <svg aria-hidden="true">
            <use href="#double-down"></use>
          </svg>
        </n-icon>
        <span v-if="count > 0" class="text-[var(--text-sm)]" :class="{ 'color-[--tjg-color-danger-500]': count > 99 }">
          {{ t('home.chat_main.new_messages', { count: label }) }}
        </span>
      </n-flex>
    </div>
  </footer>
</template>

<script setup lang="ts">
import type { StyleValue } from 'vue'
import { useI18n } from 'vue-i18n'

withDefaults(
  defineProps<{
    count?: number
    /** 已格式化的未读条数文案（如 99+） */
    label: string
    floatStyle?: StyleValue
  }>(),
  { count: 0, floatStyle: undefined }
)

const emit = defineEmits<{
  click: []
}>()

const { t } = useI18n()
</script>

<style scoped lang="scss">
.float-footer-button {
  position: absolute;
  z-index: 10;
  width: fit-content;
  user-select: none;
  color: var(--tjg-color-primary-500);
  cursor: pointer;
}
</style>
