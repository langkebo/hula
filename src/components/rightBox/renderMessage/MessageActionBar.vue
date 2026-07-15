<template>
  <Transition name="action-bar-fade">
    <div v-if="visible" class="message-action-bar" :class="isMe ? 'action-bar--left' : 'action-bar--right'" @click.stop>
      <n-tooltip v-for="action in visibleActions" :key="action.key" trigger="hover" placement="top">
        <template #trigger>
          <button
            type="button"
            class="action-btn"
            :class="{ 'action-btn--danger': action.key === 'delete' }"
            :aria-label="action.label"
            @click="action.handler">
            <svg class="action-icon">
              <use :href="`#${action.icon}`"></use>
            </svg>
          </button>
        </template>
        <span>{{ action.label }}</span>
      </n-tooltip>
    </div>
  </Transition>
</template>

<script setup lang="ts">
import type { MsgEnum } from '@/enums'

interface ActionItem {
  key: string
  label: string
  icon: string
  visible: boolean
  handler: () => void
}

const props = defineProps<{
  visible: boolean
  isMe: boolean
  messageType: MsgEnum
}>()

const emit = defineEmits<{
  (e: 'react'): void
  (e: 'reply'): void
  (e: 'forward'): void
  (e: 'copy'): void
  (e: 'delete'): void
}>()

const actions = computed<ActionItem[]>(() => [
  {
    key: 'react',
    label: '表情回应',
    icon: 'smiling-face',
    visible: true,
    handler: () => emit('react')
  },
  {
    key: 'reply',
    label: '回复',
    icon: 'reply',
    visible: true,
    handler: () => emit('reply')
  },
  {
    key: 'forward',
    label: '转发',
    icon: 'forward',
    visible: isForwardable(props.messageType),
    handler: () => emit('forward')
  },
  {
    key: 'copy',
    label: '复制',
    icon: 'copy',
    visible: isCopyable(props.messageType),
    handler: () => emit('copy')
  },
  {
    key: 'delete',
    label: '删除',
    icon: 'trash',
    visible: true,
    handler: () => emit('delete')
  }
])

const visibleActions = computed(() => actions.value.filter((a) => a.visible))
</script>

<script lang="ts">
const FORWARDABLE_TYPES = new Set([1, 2, 3, 4, 5, 7, 11]) // text, image, emoji, video, voice, file, link_preview
const COPYABLE_TYPES = new Set([1, 7]) // text, emoji

function isForwardable(type: number): boolean {
  return FORWARDABLE_TYPES.has(type)
}

function isCopyable(type: number): boolean {
  return COPYABLE_TYPES.has(type)
}
</script>

<style scoped>
.message-action-bar {
  position: absolute;
  top: -4px;
  display: flex;
  align-items: center;
  gap: 2px;
  padding: 4px;
  border-radius: 8px;
  background: var(--bg-popover, var(--hula-surface-elevated));
  box-shadow: var(--hula-shadow-floating-menu);
  border: 1px solid var(--hula-border-contrast, rgba(255, 255, 255, 0.06));
  z-index: 10;
  opacity: 0;
  transform: translateY(4px);
  transition:
    opacity 150ms var(--hula-motion-ease-enter),
    transform 150ms var(--hula-motion-ease-enter);
}

.message-action-bar.action-bar--left {
  left: -4px;
  transform: translate(-100%, 4px);
}

.message-action-bar.action-bar--right {
  right: -4px;
  transform: translate(100%, 4px);
}

.message-action-bar.action-bar--left.action-bar-fade-enter-active,
.message-action-bar.action-bar--right.action-bar-fade-enter-active {
  opacity: 1;
}

.message-action-bar.action-bar--left.action-bar-fade-enter-to {
  transform: translate(-100%, 0);
}

.message-action-bar.action-bar--right.action-bar-fade-enter-to {
  transform: translate(100%, 0);
}

.action-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  padding: 0;
  border: none;
  border-radius: 6px;
  background: transparent;
  color: var(--hula-text-secondary);
  cursor: pointer;
  transition:
    background-color 120ms ease,
    color 120ms ease;
}

.action-btn:hover {
  background: var(--hula-surface-list-hover);
  color: var(--hula-text-primary);
}

.action-btn--danger:hover {
  background: var(--hula-color-danger-100);
  color: var(--hula-color-danger-500);
}

.action-btn:focus-visible {
  outline: 2px solid var(--hula-color-primary-500);
  outline-offset: -2px;
}

.action-icon {
  width: 18px;
  height: 18px;
}

.action-bar-fade-enter-active {
  opacity: 1;
}

.action-bar-fade-leave-active {
  transition:
    opacity 100ms ease,
    transform 100ms ease;
}

.action-bar-fade-leave-to {
  opacity: 0;
  transform: translateY(4px);
}

.action-bar--left.action-bar-fade-leave-to {
  transform: translate(-100%, 4px);
}

.action-bar--right.action-bar-fade-leave-to {
  transform: translate(100%, 4px);
}
</style>
