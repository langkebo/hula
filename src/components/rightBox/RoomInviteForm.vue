<template>
  <div class="room-invite-form" data-test="invite-form">
    <input
      v-model="inviteUserId"
      class="room-invite-form__input"
      type="text"
      :placeholder="t('room.detail.invite_placeholder')"
      data-test="invite-input"
      @keyup.enter="handleInvite" />
    <button class="room-invite-form__btn" type="button" :disabled="inviteSubmitting" @click="handleInvite">
      {{ t('room.detail.invite_button') }}
    </button>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useActionFeedback } from '@/composables/common/useActionFeedback'
import { useGroupStore } from '@/stores/domains/chat/group'

const props = defineProps<{ roomId: string }>()

const { t } = useI18n()
const { showFeedback } = useActionFeedback()
const groupStore = useGroupStore()

const inviteUserId = ref('')
const inviteSubmitting = ref(false)

const handleInvite = async () => {
  const userId = inviteUserId.value.trim()
  if (!userId) {
    showFeedback(t('room.detail.invite_user_required'), 'warning')
    return
  }

  inviteSubmitting.value = true
  try {
    const success = await groupStore.inviteUser(props.roomId, userId)
    if (success) {
      showFeedback(t('room.detail.invite_success'), 'success')
      inviteUserId.value = ''
    } else {
      // 失败时不清空输入，便于用户重试
      showFeedback(t('room.detail.invite_failed'), 'error')
    }
  } catch {
    showFeedback(t('room.detail.invite_failed'), 'error')
  } finally {
    inviteSubmitting.value = false
  }
}
</script>

<style scoped lang="scss">
.room-invite-form {
  display: flex;
  gap: 8px;
  padding: 8px;
  background: var(--tjg-surface-panel-muted);
  border-radius: 8px;
}

.room-invite-form__input {
  flex: 1;
  min-width: 0;
  height: 32px;
  padding: 0 10px;
  border: 1px solid var(--tjg-border-default);
  border-radius: 6px;
  background: var(--tjg-surface-panel);
  color: var(--tjg-text-primary);
  font-size: 13px;
  transition: border-color var(--tjg-motion-duration-fast) ease;

  &:focus-within {
    border-color: var(--tjg-color-primary-500);
  }
}

.room-invite-form__btn {
  flex-shrink: 0;
  height: 32px;
  padding: 0 14px;
  border: 0;
  border-radius: 6px;
  background: var(--tjg-color-primary-600);
  color: var(--tjg-text-inverse);
  font-size: 13px;
  cursor: pointer;
  transition: opacity var(--tjg-motion-duration-fast) ease;

  &:hover:not(:disabled) {
    opacity: 0.85;
  }

  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
}
</style>
