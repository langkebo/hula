<template>
  <div
    class="auth-back-link"
    @click="emit('back')"
    role="button"
    tabindex="0"
    :aria-label="t('auth.register.actions.back_to_login')"
    @keydown.enter="emit('back')">
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="2"
      stroke-linecap="round"
      stroke-linejoin="round"
      aria-hidden="true">
      <line x1="19" y1="12" x2="5" y2="12" />
      <polyline points="12 19 5 12 12 5" />
    </svg>
    <span>{{ t('auth.register.actions.back_to_login') }}</span>
  </div>
</template>

<script setup lang="ts">
import { useI18n } from 'vue-i18n'

const { t } = useI18n()

const emit = defineEmits<{
  back: []
}>()
</script>

<style scoped lang="scss">
/* 返回登录链接（对齐原型 .auth-back-link） */
.auth-back-link {
  position: absolute;
  top: 14px;
  left: 20px;
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 13px;
  color: var(--tjg-text-secondary);
  cursor: pointer;
  z-index: 10;
  transition: color var(--tjg-motion-duration-fast);

  svg {
    width: 16px;
    height: 16px;
  }

  &:hover {
    color: var(--tjg-text-primary);
  }
}

@media (prefers-reduced-motion: reduce) {
  .auth-back-link {
    transition: none;
  }
}
</style>
