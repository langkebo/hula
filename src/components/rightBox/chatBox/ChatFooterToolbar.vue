<template>
  <n-flex align="center" :size="0" class="input-options">
    <slot name="emoji-picker" />

    <div class="flex-center gap-2px mr-12px">
      <svg class="cursor-pointer" @click="emit('screenshot')">
        <use href="#screenshot"></use>
      </svg>
      <n-popover :style="popoverStyle" trigger="hover" :show-arrow="false" placement="top">
        <template #trigger>
          <svg class="dropdown-arrow cursor-pointer" style="width: 14px; height: 14px">
            <use href="#down"></use>
          </svg>
        </template>
        <div class="footer-item">
          <n-flex
            class="text-12px cursor-pointer group"
            align="center"
            justify="space-between"
            @click="emit('screenshot')">
            <n-flex align="center" :size="6">
              <svg class="size-14px">
                <use href="#screenshot"></use>
              </svg>
              <p>{{ t('editor.screenshot') }}</p>
            </n-flex>
            <p v-if="shortcut" class="text-(12px #909090)">{{ shortcut }}</p>
          </n-flex>
          <n-flex
            class="text-12px cursor-pointer group"
            align="center"
            justify="space-between"
            @click="emit('toggleConceal')">
            <n-checkbox :checked="isConceal" @click.stop />
            <p class="text-(12px --chat-text-color)">{{ t('editor.screenshot_hide_curr_window') }}</p>
          </n-flex>
        </div>
      </n-popover>
    </div>

    <n-popover trigger="hover" :show-arrow="false" placement="bottom">
      <template #trigger>
        <div class="flex-center gap-2px mr-12px cursor-pointer" @click="emit('openFile')">
          <svg>
            <use href="#file2"></use>
          </svg>
          <svg style="width: 14px; height: 14px">
            <use href="#down"></use>
          </svg>
        </div>
      </template>
      <span>{{ t('editor.file') }}</span>
    </n-popover>

    <n-popover trigger="hover" :show-arrow="false" placement="bottom">
      <template #trigger>
        <svg class="mr-18px cursor-pointer" @click="emit('openImage')">
          <use href="#photo"></use>
        </svg>
      </template>
      <span>{{ t('editor.image') }}</span>
    </n-popover>

    <n-popover trigger="hover" :show-arrow="false" placement="bottom">
      <template #trigger>
        <svg class="mr-18px cursor-pointer" @click="emit('voiceRecord')">
          <use href="#voice"></use>
        </svg>
      </template>
      <span>{{ t('editor.voice') }}</span>
    </n-popover>

    <n-popover trigger="hover" :show-arrow="false" placement="bottom">
      <template #trigger>
        <svg class="mr-18px cursor-pointer" @click="emit('openLocation')">
          <use href="#local"></use>
        </svg>
      </template>
      <span>{{ t('editor.location') }}</span>
    </n-popover>

    <n-popover v-if="showBurnAfterRead" trigger="hover" :show-arrow="false" placement="bottom">
      <template #trigger>
        <svg
          :class="{ 'text-[--primary-color]': isBurnAfterRead }"
          class="mr-18px cursor-pointer"
          @click="emit('toggleBurnAfterRead')">
          <use href="#timer"></use>
        </svg>
      </template>
      <span>{{ t('editor.burn_after_read') }}</span>
    </n-popover>

    <slot name="extra" />
  </n-flex>
</template>

<script setup lang="ts">
import { useI18n } from 'vue-i18n'

const props = withDefaults(
  defineProps<{
    isConceal?: boolean
    isBurnAfterRead?: boolean
    shortcut?: string
    showBurnAfterRead?: boolean
  }>(),
  {
    isConceal: false,
    isBurnAfterRead: false,
    shortcut: '',
    showBurnAfterRead: true
  }
)

const emit = defineEmits<{
  (e: 'screenshot'): void
  (e: 'toggleConceal'): void
  (e: 'openFile'): void
  (e: 'openImage'): void
  (e: 'voiceRecord'): void
  (e: 'openLocation'): void
  (e: 'toggleBurnAfterRead'): void
}>()

const { t } = useI18n()

const popoverStyle = {
  padding: '0',
  background: 'var(--bg-emoji)',
  backdropFilter: 'blur(10px)',
  WebkitBackdropFilter: 'blur(10px)',
  boxShadow: '2px 2px 12px 2px var(--box-shadow-color)',
  border: '1px solid var(--box-shadow-color)'
}
</script>

<style scoped>
.footer-item {
  padding: 8px 12px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}
</style>
