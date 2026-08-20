<template>
  <n-modal
    :show="show"
    class="pin-selector-modal w-420px rounded-10px"
    role="dialog"
    aria-modal="true"
    @update:show="(v: boolean) => emit('update:show', v)">
    <div class="pin-selector bg-[--tjg-surface-panel] h-full p-6px box-border flex flex-col">
      <div class="pin-selector__header">
        <span class="pin-selector__title">{{ t('home.chat_sidebar.pins.selector_title', '选择要置顶的消息') }}</span>
        <button
          type="button"
          class="pin-selector__close"
          data-testid="pin-selector-close"
          :aria-label="t('common.close', '关闭')"
          @click="emit('update:show', false)">
          <svg class="size-12px">
            <use href="#close"></use>
          </svg>
        </button>
      </div>

      <div v-if="selectableMessages.length === 0" class="pin-selector__empty">
        <n-empty :description="t('home.chat_sidebar.pins.selector_empty', '暂无可置顶的消息')" />
      </div>

      <n-scrollbar v-else class="pin-selector__scroll">
        <div
          v-for="msg in selectableMessages"
          :key="msg.message.id"
          class="pin-selector__item"
          role="button"
          tabindex="0"
          :data-testid="`pin-select-item-${msg.message.id}`"
          @click="handleSelect(msg.message.id)"
          @keyup.enter="handleSelect(msg.message.id)">
          <span class="pin-selector__sender">{{ getSenderName(msg) }}</span>
          <span class="pin-selector__body">{{ getMessagePreview(msg) }}</span>
          <span class="pin-selector__time">{{ formatTime(msg.message.sendTime) }}</span>
        </div>
      </n-scrollbar>
    </div>
  </n-modal>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { useChatStore } from '@/stores/domains/chat/chat'
import type { MessageType } from '@/stores/domains/chat/chat/types'
import { formatChatTime } from '@/utils/ComputedTime'
import { isMessageMultiSelectEnabled } from '@/utils/MessageSelect'

defineOptions({ name: 'PinMessageSelector' })

defineProps<{ show: boolean }>()

const emit = defineEmits<{
  (e: 'update:show', value: boolean): void
  (e: 'select', eventId: string): void
}>()

const { t } = useI18n()
const chatStore = useChatStore()

/** 最多展示最近 N 条可置顶消息，避免超长列表 DOM 压力 */
const MAX_LIST = 100

/** 当前房间内可置顶的消息（排除公告/机器人/撤回），按时间倒序（最新在前） */
const selectableMessages = computed<MessageType[]>(() =>
  chatStore.chatMessageList
    .filter((msg) => Boolean(msg.message?.id) && isMessageMultiSelectEnabled(msg.message.type))
    .slice(-MAX_LIST)
    .reverse()
)

const getSenderName = (msg: MessageType): string => msg.fromUser?.username || msg.fromUser?.uid || ''

const getMessagePreview = (msg: MessageType): string => {
  const body = msg.message.body
  if (typeof body === 'string') return body
  if (body && typeof body === 'object') {
    const b = body as Record<string, unknown>
    return String(b.content ?? b.body ?? b.fileName ?? b.text ?? b.url ?? '')
  }
  return ''
}

const formatTime = (timestamp: number): string => {
  try {
    return formatChatTime(timestamp)
  } catch {
    return ''
  }
}

const handleSelect = (eventId: string): void => {
  emit('select', eventId)
  emit('update:show', false)
}
</script>

<style scoped lang="scss">
.pin-selector {
  border-radius: 10px;
  overflow: hidden;
}

.pin-selector__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 14px;
  border-bottom: 1px solid var(--tjg-border-default);
  flex-shrink: 0;
}

.pin-selector__title {
  font-size: var(--tjg-font-size-base, 14px);
  font-weight: var(--tjg-font-weight-semibold, 600);
  color: var(--tjg-text-primary);
}

.pin-selector__close {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 22px;
  height: 22px;
  border: none;
  border-radius: var(--tjg-radius-sm, 6px);
  background: transparent;
  color: var(--tjg-text-tertiary);
  cursor: pointer;
}

.pin-selector__close:hover {
  background: color-mix(in srgb, var(--tjg-text-tertiary) 12%, transparent);
  color: var(--tjg-text-primary);
}

.pin-selector__empty {
  padding: 32px 0;
}

.pin-selector__scroll {
  max-height: 400px;
  flex: 1;
}

.pin-selector__item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 10px;
  border-radius: var(--tjg-radius-sm, 8px);
  cursor: pointer;
  min-height: 36px;
  transition: background var(--tjg-motion-duration-fast, 150ms) ease;
}

.pin-selector__item:hover {
  background: color-mix(in srgb, var(--tjg-color-primary-500) 8%, var(--tjg-surface-panel));
}

.pin-selector__sender {
  font-size: var(--tjg-font-size-sm, 12px);
  font-weight: var(--tjg-font-weight-medium, 500);
  color: var(--tjg-color-primary-500);
  flex-shrink: 0;
  max-width: 120px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.pin-selector__body {
  font-size: var(--tjg-font-size-sm, 12px);
  color: var(--tjg-text-primary);
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.pin-selector__time {
  font-size: var(--tjg-font-size-xs, 11px);
  color: var(--tjg-text-tertiary);
  flex-shrink: 0;
}

@media (prefers-reduced-motion: reduce) {
  .pin-selector__item {
    transition: none;
  }
}
</style>
