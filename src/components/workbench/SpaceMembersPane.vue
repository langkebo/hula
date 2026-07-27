<template>
  <div class="space-members-pane">
    <!-- 面板头：返回按钮 + 标题 + 成员数 -->
    <header class="space-members-pane__header" data-test="space-members-header">
      <button
        type="button"
        class="space-members-pane__back"
        data-test="space-members-back"
        :aria-label="t('common.back')"
        @click="emit('back')">
        <svg class="size-16px"><use href="#arrow-left" /></svg>
      </button>
      <span class="space-members-pane__title">{{ t('space.members_title') }}</span>
      <span class="space-members-pane__count">{{ members.length }}</span>
    </header>

    <!-- 邀请表单（管理员可见） -->
    <section v-if="canManage" class="space-members-pane__invite" data-test="space-invite-form">
      <input
        v-model="inviteUserId"
        type="text"
        class="space-members-pane__invite-input"
        data-test="space-invite-input"
        :placeholder="t('space.invite_user_placeholder')"
        @keydown.enter.prevent="handleInvite" />
      <button type="button" class="space-members-pane__invite-btn" :disabled="inviteSubmitting" @click="handleInvite">
        {{ t('space.invite_button') }}
      </button>
    </section>

    <!-- 成员列表 -->
    <div class="space-members-pane__list">
      <div
        v-for="member in members"
        :key="member.user_id"
        class="space-members-pane__item"
        data-test="space-member-item"
        @click="emit('memberClick', member.user_id)">
        <div class="space-members-pane__avatar">
          {{ getInitials(member.user_id) }}
        </div>
        <div class="space-members-pane__info">
          <span class="space-members-pane__name">{{ member.user_id }}</span>
          <span class="space-members-pane__status">{{ t(`space.membership_${member.membership}`) }}</span>
        </div>
      </div>

      <div v-if="!members.length" class="space-members-pane__empty" data-test="space-members-empty">
        {{ t('space.detail_members_empty') }}
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useActionFeedback } from '@/composables/common/useActionFeedback'
import { useSpaceMembers } from '@/composables/space/useSpaceMembers'

const props = defineProps<{
  spaceId: string
  canManage?: boolean
}>()

const emit = defineEmits<{
  back: []
  memberClick: [userId: string]
}>()

const { t } = useI18n()
const { showFeedback } = useActionFeedback()
const { members, load, invite } = useSpaceMembers(() => props.spaceId)

const inviteUserId = ref('')
const inviteSubmitting = ref(false)

const getInitials = (text: string) => {
  const localPart = text.startsWith('@') ? text.slice(1).split(':')[0] : text
  return localPart.slice(0, 2).toUpperCase() || '?'
}

const handleInvite = async () => {
  const userId = inviteUserId.value.trim()
  if (!userId) {
    showFeedback(t('space.invite_user_required'), 'warning')
    return
  }

  inviteSubmitting.value = true
  try {
    const ok = await invite(userId)
    if (ok) {
      showFeedback(t('space.invite_success'), 'success')
      inviteUserId.value = ''
    } else {
      showFeedback(t('space.invite_failed'), 'error')
    }
  } catch {
    showFeedback(t('space.invite_failed'), 'error')
  } finally {
    inviteSubmitting.value = false
  }
}

// 挂载时自动加载
void load()
</script>

<style scoped lang="scss">
.space-members-pane {
  display: flex;
  flex-direction: column;
  height: 100%;
  background: var(--hula-surface-panel);
}

.space-members-pane__header {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 12px 16px;
  border-bottom: 1px solid var(--hula-border-layout-divider);
  flex-shrink: 0;
}

.space-members-pane__back {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  border: 0;
  border-radius: 8px;
  background: transparent;
  color: var(--hula-text-secondary);
  cursor: pointer;
  transition: background-color 0.15s ease;

  &:hover {
    background: var(--hula-surface-list-hover);
  }
}

.space-members-pane__title {
  flex: 1;
  font-size: 15px;
  font-weight: 600;
  color: var(--hula-text-primary);
}

.space-members-pane__count {
  font-size: 12px;
  color: var(--hula-text-tertiary);
  padding: 2px 8px;
  border-radius: 10px;
  background: var(--hula-surface-search);
}

.space-members-pane__invite {
  display: flex;
  gap: 8px;
  padding: 12px 16px;
  border-bottom: 1px solid var(--hula-border-layout-divider);
  flex-shrink: 0;
}

.space-members-pane__invite-input {
  flex: 1;
  height: 36px;
  padding: 0 12px;
  border: 1px solid var(--hula-border-default);
  border-radius: 8px;
  background: var(--hula-surface-search);
  color: var(--hula-text-primary);
  font-size: 13px;

  &:focus {
    border-color: var(--hula-color-primary-500);
    outline: none;
  }
}

.space-members-pane__invite-btn {
  height: 36px;
  padding: 0 16px;
  border: 0;
  border-radius: 8px;
  background: var(--hula-color-primary-500);
  color: var(--hula-text-inverse);
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;

  &:hover:not(:disabled) {
    background: var(--hula-color-primary-600);
  }

  &:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }
}

.space-members-pane__list {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  padding: 8px;
}

.space-members-pane__item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 10px 12px;
  border-radius: 8px;
  cursor: pointer;
  transition: background-color 0.15s ease;

  &:hover {
    background: var(--hula-surface-list-hover);
  }
}

.space-members-pane__avatar {
  width: 36px;
  height: 36px;
  border-radius: 50%;
  background: var(--hula-surface-search);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 12px;
  font-weight: 600;
  color: var(--hula-text-secondary);
  flex-shrink: 0;
}

.space-members-pane__info {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.space-members-pane__name {
  font-size: 13px;
  color: var(--hula-text-primary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.space-members-pane__status {
  font-size: 11px;
  color: var(--hula-text-quaternary);
}

.space-members-pane__empty {
  padding: 40px 16px;
  text-align: center;
  font-size: 13px;
  color: var(--hula-text-quaternary);
}
</style>
