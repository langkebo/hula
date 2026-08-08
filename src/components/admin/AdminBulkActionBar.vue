<template>
  <div v-if="selectedCount > 0" class="admin-bulk-action-bar">
    <span class="admin-bulk-action-bar__count">
      {{ t('admin.common.selectedCount', { count: selectedCount }) }}
    </span>
    <div class="admin-bulk-action-bar__actions">
      <n-button
        v-for="action in actions"
        :key="action.key"
        :type="action.type ?? 'default'"
        :size="action.size ?? 'small'"
        :disabled="action.disabled"
        :loading="action.loading"
        @click="handleAction(action)">
        <template v-if="action.icon" #icon>
          <span class="admin-bulk-action-bar__action-icon">
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              :stroke-width="1.5"
              aria-hidden="true"
              focusable="false">
              <path :d="action.icon" />
            </svg>
          </span>
        </template>
        {{ action.label }}
      </n-button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { NButton } from 'naive-ui'
import { useI18n } from 'vue-i18n'

type BulkActionType = 'default' | 'primary' | 'info' | 'success' | 'warning' | 'error'
type BulkActionSize = 'tiny' | 'small' | 'medium' | 'large'

interface BulkAction {
  /** 操作唯一标识，随 `action` 事件抛出 */
  key: string
  /** 按钮文案（已由父组件翻译） */
  label: string
  /** 按钮类型，默认 default */
  type?: BulkActionType
  /** 按钮尺寸，默认 small */
  size?: BulkActionSize
  /** SVG path data，按钮前置图标 */
  icon?: string
  /** 是否禁用 */
  disabled?: boolean
  /** 是否处于加载态 */
  loading?: boolean
}

defineProps<{
  /** 当前选中条目数；为 0 时整条隐藏 */
  selectedCount: number
  /** 可用批量操作列表 */
  actions: BulkAction[]
}>()

const emit = defineEmits<{
  /** 点击某个操作时触发，负载为该操作的 key */
  action: [key: string]
}>()

const { t } = useI18n()

function handleAction(action: BulkAction) {
  if (action.disabled || action.loading) return
  emit('action', action.key)
}
</script>

<style scoped lang="scss">
.admin-bulk-action-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--tjg-space-4);
  padding: var(--tjg-space-2) var(--tjg-space-4);
  margin-bottom: var(--tjg-space-3);
  background: var(--tjg-color-primary-50);
  border: 1px solid var(--tjg-color-primary-200);
  border-radius: var(--tjg-radius-sm);
  transition:
    background var(--tjg-motion-duration-normal) var(--tjg-motion-ease-standard),
    border-color var(--tjg-motion-duration-normal) var(--tjg-motion-ease-standard);
}

.admin-bulk-action-bar__count {
  font-size: var(--tjg-font-size-sm);
  font-weight: var(--tjg-font-weight-medium);
  color: var(--tjg-color-primary-700);
}

.admin-bulk-action-bar__actions {
  display: flex;
  align-items: center;
  gap: var(--tjg-space-2);
  flex-wrap: wrap;
}

.admin-bulk-action-bar__action-icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;

  svg {
    width: 16px;
    height: 16px;
  }
}

@media (max-width: 640px) {
  .admin-bulk-action-bar {
    flex-direction: column;
    align-items: stretch;
    gap: var(--tjg-space-2);
  }

  .admin-bulk-action-bar__actions {
    justify-content: flex-end;
  }
}

@media (prefers-reduced-motion: reduce) {
  .admin-bulk-action-bar {
    transition: none;
  }
}
</style>
