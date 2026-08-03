<template>
  <van-action-sheet
    :show="visible"
    :title="t('message_container.reaction.menu_title')"
    closeable
    close-on-click-overlay
    teleport="body"
    @update:show="handleUpdateShow"
    @close="handleClose">
    <div class="mobile-reaction-picker">
      <p class="mobile-reaction-picker__hint">{{ t('message_container.reaction.pick_emoji') }}</p>
      <div class="mobile-reaction-picker__grid">
        <button
          v-for="item in QUICK_EMOJIS"
          :key="item.key"
          type="button"
          data-test="quick-emoji-btn"
          :data-emoji="item.emoji"
          :class="[
            'mobile-reaction-picker__emoji',
            { 'mobile-reaction-picker__emoji--active': hasReacted(item.emoji) },
            { 'mobile-reaction-picker__emoji--pending': pendingEmoji === item.emoji && loading }
          ]"
          :disabled="loading && pendingEmoji === item.emoji"
          @click="handleSelect(item)">
          <span class="mobile-reaction-picker__icon">{{ item.emoji }}</span>
        </button>
      </div>
      <div class="mobile-reaction-picker__more">
        <van-button plain block size="small" data-test="more-emoji-btn" @click="handleMore">
          {{ t('message_container.reaction.more_emoji') }}
        </van-button>
      </div>
    </div>
  </van-action-sheet>
</template>

<script setup lang="ts">
import { showToast } from 'vant'
import { watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { QUICK_EMOJIS, type QuickEmoji, useReactionFlow } from '@/composables/messaging/useReactionFlow'

defineOptions({ name: 'MobileReactionPicker' })

const props = defineProps<{
  visible: boolean
  roomId: string
  eventId: string
}>()

const emit = defineEmits<{
  (e: 'update:visible', value: boolean): void
  (e: 'reacted', emoji: string): void
}>()

const { t } = useI18n()

const { reactions, loading, pendingEmoji, getReactions, toggleReaction } = useReactionFlow({
  roomId: () => props.roomId,
  eventId: () => props.eventId
})

const hasReacted = (emoji: string): boolean => {
  return reactions.value.some((r) => r.key === emoji && r.me)
}

const handleSelect = async (item: QuickEmoji): Promise<void> => {
  if (!props.roomId || !props.eventId) return
  try {
    await toggleReaction(item.emoji)
    emit('reacted', item.emoji)
    emit('update:visible', false)
  } catch {
    showToast(t('message_container.reaction.add_failed'))
  }
}

const handleMore = (): void => {
  // 简化实现:仅提示,后续可接入完整表情面板
  emit('update:visible', false)
}

const handleClose = (): void => {
  emit('update:visible', false)
}

const handleUpdateShow = (value: boolean): void => {
  emit('update:visible', value)
}

watch(
  () => [props.visible, props.eventId] as const,
  ([isVisible, eventId]) => {
    if (isVisible && eventId) {
      void getReactions()
    }
  },
  { immediate: true }
)
</script>

<style scoped lang="scss">
.mobile-reaction-picker {
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding: 12px 16px calc(12px + env(safe-area-inset-bottom));
  background: var(--hula-surface-panel);

  &__hint {
    margin: 0;
    font-size: 13px;
    color: var(--hula-text-tertiary);
    text-align: center;
  }

  &__grid {
    display: flex;
    justify-content: space-between;
    gap: 8px;
  }

  &__emoji {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 44px;
    height: 44px;
    border-radius: 50%;
    border: 1px solid transparent;
    background: var(--hula-surface-panel-muted);
    cursor: pointer;
    padding: 0;
    transition: all 0.15s ease;
    -webkit-tap-highlight-color: transparent;

    &:active {
      transform: scale(0.92);
    }

    &--active {
      background: color-mix(in srgb, var(--hula-color-primary-500) 16%, transparent);
      border-color: var(--hula-color-primary-400);
    }

    &--pending {
      opacity: 0.5;
    }

    &:disabled {
      cursor: not-allowed;
    }
  }

  &__icon {
    font-size: 24px;
    line-height: 1;
  }

  &__more {
    border-top: 1px solid var(--hula-border-default);
    padding-top: 8px;
  }
}
</style>
