<template>
  <div class="single-details__actions">
    <button class="single-details__action" type="button" @click="emit('send-message')">
      <span class="single-details__action-icon">
        <svg aria-hidden="true"><use href="#message" /></svg>
      </span>
      <span class="single-details__action-label">{{ t('home.chat_details.actions.message') }}</span>
    </button>

    <button class="single-details__action" type="button" @click="emit('encrypted-chat')">
      <span class="single-details__action-icon single-details__action-icon--encrypted">
        <svg aria-hidden="true"><use href="#lock" /></svg>
      </span>
      <span class="single-details__action-label">{{ t('friend.detail.encrypted_chat') }}</span>
    </button>

    <button class="single-details__action" type="button" @click="emit('voice-call')">
      <span class="single-details__action-icon">
        <svg aria-hidden="true"><use href="#phone" /></svg>
      </span>
      <span class="single-details__action-label">{{ t('home.chat_details.single.footer.audio_call') }}</span>
    </button>

    <button class="single-details__action" type="button" @click="emit('video-call')">
      <span class="single-details__action-icon">
        <svg aria-hidden="true"><use href="#video" /></svg>
      </span>
      <span class="single-details__action-label">{{ t('home.chat_details.single.footer.video_call') }}</span>
    </button>
  </div>
</template>

<script setup lang="ts">
import { useI18n } from 'vue-i18n'

const emit = defineEmits<{
  'send-message': []
  'encrypted-chat': []
  'voice-call': []
  'video-call': []
}>()

const { t } = useI18n()
</script>

<style scoped>
.single-details__actions {
  display: flex;
  align-items: flex-start;
  justify-content: center;
  gap: 34px;
}

.single-details__action {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 10px;
  border: none;
  background: transparent;
  cursor: pointer;
  color: var(--tjg-text-secondary);
}

.single-details__action:hover .single-details__action-icon {
  transform: translateY(-1px);
  box-shadow: 0 8px 18px color-mix(in srgb, var(--tjg-color-primary-500) 22%, transparent);
}

.single-details__action-icon {
  width: 42px;
  height: 42px;
  border-radius: 14px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  background: var(--tjg-color-primary-500);
  color: var(--tjg-text-inverse);
  transition:
    transform 0.2s ease,
    box-shadow 0.2s ease,
    background 0.2s ease;

  svg {
    width: 20px;
    height: 20px;
  }
}

.single-details__action-label {
  font-size: 12px;
  line-height: 16px;
  color: var(--tjg-text-secondary);
}

.single-details__action-icon--encrypted {
  background: var(--tjg-color-success-500);
}
</style>
