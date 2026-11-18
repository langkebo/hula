<template>
  <div class="room-visibility-toggle">
    <span class="room-visibility-toggle__label">{{ t('room.detail.visibility_label') }}</span>
    <span v-if="loadFailed" class="room-visibility-toggle__error" data-test="visibility-error">
      {{ t('room.detail.visibility_load_failed') }}
      <button class="room-visibility-toggle__retry" type="button" data-test="visibility-retry" @click="loadVisibility">
        {{ t('common.retry') }}
      </button>
    </span>
    <button
      v-else
      class="room-visibility-toggle__btn"
      :class="currentVisibility ? `room-visibility-toggle__btn--${currentVisibility}` : ''"
      type="button"
      :disabled="loading || !currentVisibility"
      data-test="visibility-toggle"
      @click="handleToggle">
      <span class="room-visibility-toggle__indicator" />
      <span class="room-visibility-toggle__text">
        {{
          currentVisibility === 'public'
            ? t('room.detail.visibility_public')
            : currentVisibility === 'private'
              ? t('room.detail.visibility_private')
              : t('common.loading')
        }}
      </span>
    </button>
  </div>
</template>

<script lang="ts" setup>
import { useI18n } from 'vue-i18n'
import { useActionFeedback } from '@/composables/common/useActionFeedback'
import { useGroupStore } from '@/stores/domains/chat/group'

defineOptions({ name: 'RoomVisibilityToggle' })

const { t } = useI18n()
const { showFeedback } = useActionFeedback()
const groupStore = useGroupStore()

const props = defineProps<{
  roomId: string
}>()

// null 表示尚未取到真实值：不能用 'private' 冒充，否则失败时会误导用户
const currentVisibility = ref<'public' | 'private' | null>(null)
const loading = ref(false)
const loadFailed = ref(false)

// 加载当前可见性
const loadVisibility = async () => {
  if (!props.roomId) return
  loading.value = true
  loadFailed.value = false
  currentVisibility.value = null
  try {
    currentVisibility.value = await groupStore.getVisibility(props.roomId)
  } catch {
    // 取不到就明确报错并给重试，不猜测可见性
    loadFailed.value = true
  } finally {
    loading.value = false
  }
}

// 切换可见性
const handleToggle = async () => {
  if (loading.value || !currentVisibility.value) return
  const next: 'public' | 'private' = currentVisibility.value === 'public' ? 'private' : 'public'

  loading.value = true
  try {
    const success = await groupStore.setVisibility(props.roomId, next)
    if (success) {
      currentVisibility.value = next
      showFeedback(t('room.detail.visibility_updated'), 'success')
    } else {
      showFeedback(t('room.detail.visibility_update_failed'), 'error')
    }
  } catch {
    showFeedback(t('room.detail.visibility_update_failed'), 'error')
  } finally {
    loading.value = false
  }
}

// 挂载时加载当前可见性
onMounted(loadVisibility)

// roomId 变化时重新加载
watch(() => props.roomId, loadVisibility)
</script>

<style scoped lang="scss">
.room-visibility-toggle {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 12px;
  background: var(--tjg-surface-panel-muted);
  border-radius: 8px;
}

.room-visibility-toggle__label {
  font-size: 13px;
  color: var(--tjg-text-secondary);
  font-weight: 500;
}

.room-visibility-toggle__error {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  color: var(--tjg-text-secondary);
}

.room-visibility-toggle__retry {
  appearance: none;
  border: 0;
  padding: 2px 4px;
  border-radius: var(--tjg-radius-xs);
  background: transparent;
  color: var(--tjg-color-primary-500);
  font-size: 12px;
  font-weight: 500;
  cursor: pointer;

  &:focus-visible {
    outline: 2px solid var(--tjg-color-primary-500);
    outline-offset: 2px;
  }
}

.room-visibility-toggle__btn {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  height: 30px;
  padding: 0 12px;
  border: 1px solid var(--tjg-border-default);
  border-radius: var(--tjg-radius-xl);
  background: var(--tjg-surface-panel);
  color: var(--tjg-text-primary);
  font-size: 12px;
  cursor: pointer;
  transition:
    color var(--tjg-motion-duration-fast) ease,
    background-color var(--tjg-motion-duration-fast) ease,
    border-color var(--tjg-motion-duration-fast) ease,
    box-shadow var(--tjg-motion-duration-fast) ease,
    opacity var(--tjg-motion-duration-fast) ease,
    transform var(--tjg-motion-duration-fast) ease;

  &:hover:not(:disabled) {
    border-color: var(--tjg-color-primary-500);
  }

  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  &--public {
    background: var(--tjg-color-success-100, rgba(34, 197, 94, 0.1));
    border-color: var(--tjg-color-success-500);
    color: var(--tjg-color-success-500);
  }

  &--private {
    background: var(--tjg-surface-panel);
    color: var(--tjg-text-tertiary);
  }
}

.room-visibility-toggle__indicator {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: currentColor;
}

.room-visibility-toggle__text {
  font-weight: 500;
}
</style>
