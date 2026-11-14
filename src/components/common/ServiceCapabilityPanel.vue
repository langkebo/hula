<script setup lang="ts">
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import CapabilityBadge from '@/components/common/CapabilityBadge.vue'
import EmptyState from '@/components/common/EmptyState.vue'
import ErrorState from '@/components/common/ErrorState.vue'
import type { CapabilityItem } from '@/types/capability'

const MAX_VISIBLE = 5

const props = withDefaults(
  defineProps<{
    /** 能力条目；按传入顺序渲染 */
    items?: CapabilityItem[]
    /** 列表级加载错误，提供时优先渲染错误态 */
    error?: string
  }>(),
  {
    items: () => [],
    error: ''
  }
)

const emit = defineEmits<{
  /** key 为空字符串表示整体重试 */
  retry: [key: string]
  openSettings: [key: string]
}>()

const { t } = useI18n()

const expanded = ref(false)

const visibleItems = computed(() => (expanded.value ? props.items : props.items.slice(0, MAX_VISIBLE)))
</script>

<template>
  <section class="capability-panel" data-test="service-capability-panel">
    <ErrorState
      v-if="error"
      compact
      :title="t('common.capability.error_title')"
      :message="error"
      :retry-text="t('common.retry')"
      @retry="emit('retry', '')" />

    <EmptyState
      v-else-if="items.length === 0"
      compact
      variant="subtle"
      illustration="no-results"
      :title="t('common.capability.empty_title')"
      :description="t('common.capability.empty_description')" />

    <template v-else>
      <ul class="capability-panel__list">
        <li v-for="item in visibleItems" :key="item.key" class="capability-panel__item" :data-key="item.key">
          <div class="capability-panel__info">
            <CapabilityBadge :state="item.state" :label="item.label" />
            <span v-if="item.hint" class="capability-panel__hint">{{ item.hint }}</span>
          </div>

          <div class="capability-panel__actions">
            <button
              v-if="item.state !== 'ready'"
              type="button"
              class="capability-panel__action"
              data-test="capability-retry"
              :aria-label="t('common.capability.retry_item', { name: item.label })"
              @click="emit('retry', item.key)">
              {{ t('common.retry') }}
            </button>
            <button
              type="button"
              class="capability-panel__action"
              data-test="capability-settings"
              :aria-label="t('common.capability.settings_item', { name: item.label })"
              @click="emit('openSettings', item.key)">
              {{ t('common.capability.settings') }}
            </button>
          </div>
        </li>
      </ul>

      <button
        v-if="items.length > MAX_VISIBLE"
        type="button"
        class="capability-panel__toggle"
        data-test="capability-toggle"
        @click="expanded = !expanded">
        {{ expanded ? t('common.capability.collapse') : t('common.capability.expand', { count: items.length }) }}
      </button>
    </template>
  </section>
</template>

<style scoped lang="scss">
.capability-panel__list {
  display: flex;
  flex-direction: column;
  gap: 2px;
  margin: 0;
  padding: 0;
  list-style: none;
}

.capability-panel__item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 6px 0;
  border-bottom: 1px solid var(--tjg-border-muted);
}

.capability-panel__item:last-child {
  border-bottom: 0;
}

.capability-panel__info {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 4px 8px;
  min-width: 0;
}

.capability-panel__hint {
  font-size: 12px;
  line-height: 18px;
  color: var(--tjg-text-tertiary);
}

.capability-panel__actions {
  display: flex;
  flex: none;
  align-items: center;
  gap: 6px;
}

.capability-panel__action {
  padding: 2px 8px;
  border: 1px solid var(--tjg-border-muted);
  border-radius: 6px;
  background: transparent;
  font-size: 12px;
  line-height: 18px;
  color: var(--tjg-text-secondary);
  cursor: pointer;
}

.capability-panel__action:hover {
  border-color: var(--tjg-color-primary-500);
  color: var(--tjg-text-primary);
}

.capability-panel__action:focus-visible,
.capability-panel__toggle:focus-visible {
  outline: 2px solid var(--tjg-color-primary-500);
  outline-offset: 2px;
}

.capability-panel__toggle {
  margin-top: 8px;
  padding: 0;
  border: 0;
  background: none;
  font-size: 12px;
  line-height: 18px;
  color: var(--tjg-text-secondary);
  cursor: pointer;
}

.capability-panel__toggle:hover {
  color: var(--tjg-text-primary);
}
</style>
