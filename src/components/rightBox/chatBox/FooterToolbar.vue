<template>
  <n-flex align="center" justify="space-between" class="p-[10px_22px_5px] select-none flex-shrink-0">
    <n-flex align="center" :size="0" class="input-options">
      <!-- emoji表情 -->
      <n-popover
        v-model:show="emojiShowLocal"
        trigger="click"
        :show-arrow="false"
        placement="top-start"
        :disabled="disabled"
        style="
          padding: 0;
          background: var(--tjg-surface-panel);
          backdrop-filter: blur(10px);
          -webkit-backdrop-filter: blur(10px);
          box-shadow: var(--tjg-shadow-md);
          border: 1px solid var(--tjg-border-default);
          width: auto;
        ">
        <template #trigger>
          <n-popover
            v-model:show="recentlyTipLocal"
            trigger="hover"
            :delay="800"
            :duration="100"
            :show-arrow="false"
            :disabled="emojiShowLocal || recentEmojis.length < 4"
            placement="top">
            <template #trigger>
              <svg class="mr-18px" role="button" :aria-label="t('chat.footer.emoji')">
                <use href="#smiling-face"></use>
              </svg>
            </template>
            <div v-if="recentEmojis.length > 0" class="p-4px">
              <div class="text-xs text-[--tjg-text-tertiary] mb-4px">{{ t('editor.recently_used') }}</div>
              <div class="flex flex-wrap gap-8px max-w-212px">
                <div
                  v-for="(emoji, index) in recentEmojis"
                  :key="index"
                  class="emoji-item cursor-pointer flex-center"
                  @click="onEmojiClick(emoji)">
                  <img v-if="checkIsUrl(emoji)" :src="resolveRecentRenderUrl(emoji)" class="size-24px" alt="表情" />
                  <span v-else class="text-18px">{{ emoji }}</span>
                </div>
              </div>
            </div>
          </n-popover>
        </template>
        <Emoticon @emojiHandle="onEmojiHandle" :all="false" />
      </n-popover>

      <div class="flex-center gap-2px mr-12px">
        <svg @click="$emit('handleScreenshot')" role="button" :aria-label="t('chat.footer.screenshot')">
          <use href="#screenshot"></use>
        </svg>
        <n-popover
          style="
            padding: 0;
            background: var(--tjg-surface-panel);
            backdrop-filter: blur(10px);
            -webkit-backdrop-filter: blur(10px);
            box-shadow: var(--tjg-shadow-md);
            border: 1px solid var(--tjg-border-default);
          "
          trigger="hover"
          :show-arrow="false"
          placement="top">
          <template #trigger>
            <svg class="dropdown-arrow" style="width: 14px; height: 14px">
              <use href="#down"></use>
            </svg>
          </template>

          <div class="footer-item">
            <n-flex
              @click="$emit('handleScreenshot')"
              class="text-12px cursor-pointer group"
              align="center"
              justify="space-between">
              <n-flex align="center" :size="6">
                <svg class="size-14px">
                  <use href="#screenshot"></use>
                </svg>
                <p>{{ t('editor.screenshot') }}</p>
              </n-flex>
              <p class="text-(12px --tjg-text-tertiary)">{{ screenshotShortcut }}</p>
            </n-flex>

            <n-flex
              class="text-12px cursor-pointer group"
              align="center"
              justify="space-between"
              @click="isConcealLocal = !isConcealLocal">
              <n-checkbox v-model:checked="isConcealLocal" @click.stop />
              <p class="text-(12px [--tjg-text-primary])">{{ t('editor.screenshot_hide_curr_window') }}</p>
            </n-flex>
          </div>
        </n-popover>
      </div>

      <n-popover trigger="hover" :show-arrow="false" placement="bottom">
        <template #trigger>
          <div class="flex-center gap-2px mr-12px">
            <svg @click="$emit('handleFileOpen')" role="button" :aria-label="t('chat.footer.send_file')">
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
          <svg
            @click="$emit('handleImageOpen')"
            class="mr-18px"
            role="button"
            :aria-label="t('chat.footer.send_image')">
            <use href="#photo"></use>
          </svg>
        </template>
        <span>{{ t('editor.image') }}</span>
      </n-popover>
      <n-popover trigger="hover" :show-arrow="false" placement="bottom">
        <template #trigger>
          <svg
            @click="$emit('handleVoiceRecord')"
            class="mr-18px"
            role="button"
            :aria-label="t('chat.footer.voice_message')">
            <use href="#voice"></use>
          </svg>
        </template>
        <span>{{ t('editor.voice') }}</span>
      </n-popover>
      <n-popover trigger="hover" :show-arrow="false" placement="bottom">
        <template #trigger>
          <svg
            @click="$emit('showLocationModal')"
            class="mr-18px"
            role="button"
            :aria-label="t('chat.footer.location')">
            <use href="#local"></use>
          </svg>
        </template>
        <span>{{ t('editor.location') }}</span>
      </n-popover>

      <n-popover trigger="hover" :show-arrow="false" placement="bottom">
        <template #trigger>
          <svg
            :class="{ 'text-[--tjg-color-primary-500]': burnAfterReadEnabled }"
            @click="$emit('toggleBurnAfterRead')"
            class="mr-18px cursor-pointer"
            role="button"
            :aria-label="t('chat.footer.burn_after_read')">
            <use href="#timer"></use>
          </svg>
        </template>
        <span>{{ t('editor.burn_after_read') }}</span>
      </n-popover>
    </n-flex>

    <n-popover trigger="hover" :show-arrow="false" placement="bottom">
      <template #trigger>
        <svg
          class="w-22px h-22px cursor-pointer outline-none"
          @click="$emit('openChatHistory')"
          role="button"
          :aria-label="t('chat.footer.chat_history')">
          <use href="#history"></use>
        </svg>
      </template>
      <span>{{ t('editor.chat_history') }}</span>
    </n-popover>
  </n-flex>
</template>

<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import type { EmojiUrlPayload } from '@/composables/chat/useFooterEmoji'

const props = defineProps<{
  emojiShow: boolean
  recentlyTip: boolean
  recentEmojis: string[]
  burnAfterReadEnabled: boolean
  isConceal: boolean
  screenshotShortcut: string
  disabled: boolean
  checkIsUrl: (str: string) => boolean
  resolveRecentRenderUrl: (url: string) => string
}>()

const emit = defineEmits<{
  (event: 'update:emojiShow', value: boolean): void
  (event: 'update:recentlyTip', value: boolean): void
  (event: 'update:isConceal', value: boolean): void
  (event: 'emojiHandle', item: string | EmojiUrlPayload, type: 'emoji' | 'emoji-url'): void
  (event: 'handleScreenshot'): void
  (event: 'handleFileOpen'): void
  (event: 'handleImageOpen'): void
  (event: 'handleVoiceRecord'): void
  (event: 'showLocationModal'): void
  (event: 'toggleBurnAfterRead'): void
  (event: 'openChatHistory'): void
}>()

const { t } = useI18n()

const Emoticon = defineAsyncComponent(() => import('@/components/rightBox/emoticon/index.vue'))

const emojiShowLocal = computed({
  get: () => props.emojiShow,
  set: (v: boolean) => emit('update:emojiShow', v)
})

const recentlyTipLocal = computed({
  get: () => props.recentlyTip,
  set: (v: boolean) => emit('update:recentlyTip', v)
})

const isConcealLocal = computed({
  get: () => props.isConceal,
  set: (v: boolean) => emit('update:isConceal', v)
})

const onEmojiClick = (emoji: string) => {
  if (props.checkIsUrl(emoji)) {
    emit('emojiHandle', { renderUrl: props.resolveRecentRenderUrl(emoji), serverUrl: emoji }, 'emoji-url')
  } else {
    emit('emojiHandle', emoji, 'emoji')
  }
}

const onEmojiHandle = (item: string | EmojiUrlPayload, type?: 'emoji' | 'emoji-url') => {
  emit('emojiHandle', item, type ?? 'emoji')
}
</script>

<style scoped lang="scss">
.input-options {
  svg {
    width: 22px;
    height: 22px;
    cursor: pointer;

    &:hover {
      color: var(--tjg-color-primary-500);
    }
  }

  .dropdown-arrow {
    transition: transform var(--tjg-motion-duration-overlay) ease;

    &:hover {
      transform: rotate(180deg);
    }
  }
}

.footer-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 4px;
  padding: 6px 8px;
  min-width: 160px;
  box-sizing: border-box;
  width: fit-content;
  height: fit-content;
  user-select: none;

  .group {
    padding: 4px 6px;
    border-radius: 4px;

    &:hover {
      background-color: var(--tjg-fill-hover);

      svg {
        animation: twinkle 0.3s ease-in-out;
      }
    }
  }
}
</style>
