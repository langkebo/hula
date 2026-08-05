<template>
  <div
    v-if="visible"
    ref="menuRef"
    class="message-action-menu"
    data-test="message-action-menu"
    role="menu"
    :style="{ left: `${adjustedPosition.x}px`, top: `${adjustedPosition.y}px` }"
    @keydown.esc="close"
    @click.stop>
    <div v-if="!allowedActions.length" class="message-action-menu__empty" data-test="menu-empty">
      {{ t('message.no_actions') }}
    </div>
    <template v-else>
      <button
        v-for="action in allowedActions"
        :key="action"
        type="button"
        class="message-action-menu__item"
        :class="{
          'message-action-menu__item--danger': action === 'delete' || action === 'recall'
        }"
        data-test="menu-item"
        :data-action="action"
        role="menuitem"
        @click="handleActionClick(action)">
        <svg class="size-14px"><use :href="`#${getActionIcon(action)}`" /></svg>
        <span>{{ t(`message.action_${action}`) }}</span>
      </button>
    </template>
  </div>
</template>

<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import type { MsgEnum } from '@/enums'
import type { MessageType } from '@/stores/domains/chat/chat'
import { getStrategy, type MessageAction, type MessageActionContext } from '@/strategy/strategies'

const props = defineProps<{
  visible: boolean
  message: MessageType
  isMe: boolean
  canModerate: boolean
  isPinned: boolean
  position: { x: number; y: number }
}>()

const emit = defineEmits<{
  'update:visible': [visible: boolean]
  recall: []
  edit: []
  reply: []
  forward: []
  mark: []
  pin: []
  copy: []
  delete: []
}>()

const { t } = useI18n()
const menuRef = ref<HTMLElement>()
const allowedActions = ref<MessageAction[]>([])
// 视口边界检测后的实际定位
const adjustedPosition = ref({ x: 0, y: 0 })

const actionContext = computed<MessageActionContext>(() => ({
  isMe: props.isMe,
  canModerate: props.canModerate,
  isPinned: props.isPinned
}))

// 加载策略并获取允许的动作
async function loadAllowedActions() {
  if (!props.visible || !props.message?.message) {
    allowedActions.value = []
    return
  }
  try {
    const strategy = await getStrategy(props.message.message.type as MsgEnum)
    allowedActions.value = strategy.getAllowedActions?.(actionContext.value) ?? []
  } catch {
    allowedActions.value = []
  }
}

// 根据菜单实际尺寸钳制位置在视口内
function clampPosition() {
  const el = menuRef.value
  const margin = 8
  let x = props.position.x
  let y = props.position.y
  if (el) {
    const rect = el.getBoundingClientRect()
    const vw = window.innerWidth
    const vh = window.innerHeight
    if (x + rect.width + margin > vw) {
      x = Math.max(margin, vw - rect.width - margin)
    }
    if (y + rect.height + margin > vh) {
      y = Math.max(margin, vh - rect.height - margin)
    }
  }
  adjustedPosition.value = { x, y }
}

watch(
  () => [props.visible, props.message?.message?.type, props.isMe, props.canModerate, props.isPinned],
  () => {
    if (props.visible) {
      void loadAllowedActions().then(() => {
        nextTick(() => clampPosition())
      })
    } else {
      allowedActions.value = []
    }
  },
  { immediate: true }
)

// 位置变化时重新钳制
watch(
  () => props.position,
  () => {
    if (props.visible) {
      nextTick(() => clampPosition())
    }
  },
  { deep: true }
)

const ACTION_ICON: Record<MessageAction, string> = {
  recall: 'undo',
  edit: 'edit',
  reply: 'reply',
  forward: 'forward',
  mark: 'bookmark',
  pin: 'pin',
  copy: 'copy',
  delete: 'trash'
}

const getActionIcon = (action: MessageAction): string => ACTION_ICON[action] || 'circle'

const handleActionClick = (action: MessageAction) => {
  switch (action) {
    case 'recall':
      emit('recall')
      break
    case 'edit':
      emit('edit')
      break
    case 'reply':
      emit('reply')
      break
    case 'forward':
      emit('forward')
      break
    case 'mark':
      emit('mark')
      break
    case 'pin':
      emit('pin')
      break
    case 'copy':
      emit('copy')
      break
    case 'delete':
      emit('delete')
      break
  }
  close()
}

const close = () => {
  emit('update:visible', false)
}
</script>

<style scoped lang="scss">
.message-action-menu {
  position: fixed;
  z-index: 1000;
  min-width: 180px;
  padding: 4px;
  background: var(--tjg-surface-elevated);
  border: 1px solid var(--tjg-border-contrast, rgba(255, 255, 255, 0.06));
  border-radius: 8px;
  box-shadow: var(--tjg-shadow-floating-menu);
  outline: none;
}

.message-action-menu__item {
  display: flex;
  align-items: center;
  gap: 10px;
  width: 100%;
  padding: 8px 12px;
  border: 0;
  border-radius: 6px;
  background: transparent;
  color: var(--tjg-text-primary);
  font-size: 13px;
  text-align: left;
  cursor: pointer;
  transition: background-color var(--tjg-motion-duration-fast) ease;

  &:hover {
    background: var(--tjg-surface-list-hover);
  }

  &:focus-visible {
    outline: 2px solid var(--tjg-color-primary-500);
    outline-offset: -2px;
  }
}

.message-action-menu__item--danger {
  color: var(--tjg-color-danger-500);

  &:hover {
    background: var(--tjg-color-danger-100, color-mix(in srgb, var(--tjg-color-danger-500) 12%, transparent));
  }
}

.message-action-menu__empty {
  padding: 12px 16px;
  font-size: 12px;
  color: var(--tjg-text-quaternary);
  text-align: center;
}
</style>
