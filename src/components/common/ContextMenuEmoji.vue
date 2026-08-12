<template>
  <div
    v-if="showMenu && emoji.length > 0"
    class="context-menu select-none"
    style="height: fit-content"
    :style="menuPosition">
    <div class="emoji-container">
      <div v-for="(item, index) in displayedEmojis" :key="index" class="p-4px">
        <n-popover :delay="500" :duration="0" trigger="hover" :show-arrow="false" placement="top">
          <template #trigger>
            <div
              class="emoji-item"
              role="button"
              tabindex="0"
              :aria-label="item.title"
              @click="emit('reply-emoji', item)"
              @keydown.enter.prevent="emit('reply-emoji', item)"
              @keydown.space.prevent="emit('reply-emoji', item)">
              <img :title="item.title" class="size-18px" :src="item.url" :alt="item.title" />
            </div>
          </template>
          <span>{{ item.title }}</span>
        </n-popover>
      </div>
      <div v-if="!showAll && emoji.length > 4" class="py-4px">
        <div
          class="emoji-more-btn"
          role="button"
          tabindex="0"
          :aria-label="t('menu.ctx_menu_more')"
          @click="emit('update:showAll', true)"
          @keydown.enter.prevent="emit('update:showAll', true)"
          @keydown.space.prevent="emit('update:showAll', true)">
          {{ t('menu.ctx_menu_more') }}
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import type { ReactionEmoji } from '@/composables/common/useContextMenuTypes'

const props = withDefaults(
  defineProps<{
    emoji: ReactionEmoji[]
    showMenu: boolean
    menuPosition: { left: string; top: string }
    showAll: boolean
  }>(),
  {
    emoji: () => [],
    showMenu: false,
    showAll: false
  }
)

const emit = defineEmits<{
  'reply-emoji': [item: ReactionEmoji]
  'update:showAll': [value: boolean]
}>()

const { t } = useI18n()

const displayedEmojis = computed(() => {
  return props.showAll ? props.emoji : props.emoji.slice(0, 4)
})
</script>

<style scoped lang="scss">
@use '@/styles/scss/global/variable.scss' as *;

.context-menu {
  @include menu-item-style();
}

.emoji-container {
  -webkit-backdrop-filter: blur(10px);
  background: var(--tjg-menu-bg);
  @apply flex flex-wrap max-w-180px px-6px select-none;
}

.emoji-item {
  @apply flex-center size-28px rounded-4px text-16px cursor-pointer hover:bg-[--tjg-menu-hover];
}

.emoji-more-btn {
  @apply flex-center size-28px px-4px rounded-4px text-12px cursor-pointer bg-[--tjg-menu-hover] hover:bg-[--tjg-menu-hover];
}
</style>
