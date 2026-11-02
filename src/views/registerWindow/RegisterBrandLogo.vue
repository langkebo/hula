<template>
  <div class="auth-logo">
    <div class="auth-logo-icon">
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="2"
        stroke-linecap="round"
        stroke-linejoin="round"
        aria-hidden="true">
        <path
          d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" />
      </svg>
    </div>
    <div class="auth-logo-text">
      {{ t('auth.register.title') }}
      <span class="accent">{{ t('auth.register.title_accent') }}</span>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useI18n } from 'vue-i18n'

const { t } = useI18n()
</script>

<style scoped lang="scss">
/* Logo + 标题（对齐原型 .auth-logo） */
.auth-logo {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 10px;
  margin-bottom: 6px;
}

.auth-logo-icon {
  width: 42px;
  height: 42px;
  border-radius: var(--tjg-radius-sm, 4px);
  background: linear-gradient(135deg, var(--tjg-color-primary-400), var(--tjg-color-primary-600));
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 4px 12px color-mix(in srgb, var(--tjg-color-primary-500) 40%, transparent);

  svg {
    width: 22px;
    height: 22px;
    color: var(--tjg-text-inverse, #fff);
  }
}

.auth-logo-text {
  font-size: 22px;
  font-weight: 700;
  color: var(--tjg-text-primary);
  letter-spacing: 1px;

  .accent {
    color: var(--tjg-color-primary-500);
  }
}
</style>
