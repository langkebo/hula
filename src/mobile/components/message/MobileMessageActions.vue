<template>
  <van-action-sheet
    :show="visible"
    :title="t('message_container.long_press.menu_title')"
    closeable
    close-on-click-overlay
    teleport="body"
    @update:show="handleUpdateShow"
    @close="handleClose">
    <div class="mobile-message-actions">
      <button
        v-for="action in renderedActions"
        :key="action.name"
        type="button"
        data-test="message-action-item"
        :data-action="action.name"
        :class="['mobile-message-actions__item', { 'mobile-message-actions__item--danger': action.danger }]"
        @click="handleSelect(action.name)">
        <span class="mobile-message-actions__label">{{ action.label }}</span>
      </button>
    </div>
  </van-action-sheet>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

defineOptions({ name: 'MobileMessageActions' })

const props = withDefaults(
  defineProps<{
    visible: boolean
    actions?: string[]
    dangerActions?: string[]
  }>(),
  {
    actions: () => ['reply', 'copy', 'forward', 'react', 'pin', 'delete', 'multi_select'],
    dangerActions: () => ['delete']
  }
)

const emit = defineEmits<{
  (e: 'update:visible', value: boolean): void
  (e: 'select', action: string): void
}>()

const { t } = useI18n()

const renderedActions = computed(() => {
  return props.actions.map((name) => ({
    name,
    label: t(`message_container.long_press.${name}`),
    danger: props.dangerActions.includes(name)
  }))
})

const handleSelect = (action: string): void => {
  emit('select', action)
  emit('update:visible', false)
}

const handleClose = (): void => {
  emit('update:visible', false)
}

const handleUpdateShow = (value: boolean): void => {
  emit('update:visible', value)
}
</script>

<style scoped lang="scss">
.mobile-message-actions {
  display: flex;
  flex-direction: column;
  padding: 8px 16px calc(12px + env(safe-area-inset-bottom));
  background: var(--tjg-surface-panel);

  &__item {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 100%;
    height: 48px;
    padding: 0;
    border: none;
    border-bottom: 1px solid var(--tjg-border-default);
    background: transparent;
    font-size: 16px;
    color: var(--tjg-text-primary);
    cursor: pointer;
    -webkit-tap-highlight-color: transparent;

    &:last-child {
      border-bottom: none;
    }

    &:active {
      background: var(--tjg-surface-panel-muted);
    }

    &--danger {
      color: var(--tjg-color-danger-500);
    }
  }

  &__label {
    line-height: 1;
  }
}
</style>
