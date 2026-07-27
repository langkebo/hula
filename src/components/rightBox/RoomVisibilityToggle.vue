<template>
  <div class="room-visibility-toggle">
    <span class="room-visibility-toggle__label">{{ t('room.detail.visibility_label') }}</span>
    <button
      class="room-visibility-toggle__btn"
      :class="`room-visibility-toggle__btn--${currentVisibility}`"
      type="button"
      :disabled="loading"
      data-test="visibility-toggle"
      @click="handleToggle">
      <span class="room-visibility-toggle__indicator" />
      <span class="room-visibility-toggle__text">
        {{ currentVisibility === 'public' ? t('room.detail.visibility_public') : t('room.detail.visibility_private') }}
      </span>
    </button>
  </div>
</template>

<script lang="ts" setup name="RoomVisibilityToggle">
import { useI18n } from 'vue-i18n'
import { useActionFeedback } from '@/composables/common/useActionFeedback'
import { useGroupStore } from '@/stores/domains/chat/group'

const { t } = useI18n()
const { showFeedback } = useActionFeedback()
const groupStore = useGroupStore()

const props = defineProps<{
  roomId: string
}>()

const currentVisibility = ref<'public' | 'private'>('private')
const loading = ref(false)

// 加载当前可见性
const loadVisibility = async () => {
  if (!props.roomId) return
  loading.value = true
  try {
    currentVisibility.value = await groupStore.getVisibility(props.roomId)
  } catch {
    // 获取失败默认私密
    currentVisibility.value = 'private'
  } finally {
    loading.value = false
  }
}

// 切换可见性
const handleToggle = async () => {
  if (loading.value) return
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
  background: var(--hula-surface-panel-muted);
  border-radius: 8px;
}

.room-visibility-toggle__label {
  font-size: 13px;
  color: var(--hula-text-secondary);
  font-weight: 500;
}

.room-visibility-toggle__btn {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  height: 30px;
  padding: 0 12px;
  border: 1px solid var(--hula-border-default);
  border-radius: 16px;
  background: var(--hula-surface-panel);
  color: var(--hula-text-primary);
  font-size: 12px;
  cursor: pointer;
  transition: all 0.15s ease;

  &:hover:not(:disabled) {
    border-color: var(--hula-color-primary-500);
  }

  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  &--public {
    background: var(--hula-color-success-100, rgba(34, 197, 94, 0.1));
    border-color: var(--hula-color-success-500, #22c55e);
    color: var(--hula-color-success-500, #22c55e);
  }

  &--private {
    background: var(--hula-surface-panel);
    color: var(--hula-text-tertiary);
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
