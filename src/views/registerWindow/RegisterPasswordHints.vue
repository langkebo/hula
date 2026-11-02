<template>
  <div v-if="password" class="pwd-hints">
    <div :class="['pwd-hint', { valid: validateMinLength(password) }]">
      {{ t('auth.register.password_hints.min_length') }}
    </div>
    <div :class="['pwd-hint', { valid: validateAlphaNumeric(password) }]">
      {{ t('auth.register.password_hints.alpha_numeric') }}
    </div>
    <div :class="['pwd-hint', { valid: validateSpecialChar(password) }]">
      {{ t('auth.register.password_hints.special_char') }}
    </div>
  </div>
</template>

<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import { validateAlphaNumeric, validatePasswordMinLength, validateSpecialChar } from '@/utils/Validate'

defineProps<{
  password: string
}>()

const { t } = useI18n()
const validateMinLength = validatePasswordMinLength
</script>

<style scoped lang="scss">
/* 密码强度提示（对齐原型 .pwd-hints） */
.pwd-hints {
  width: 100%;
  display: flex;
  flex-direction: column;
  gap: 4px;
  margin-top: -6px;
}

.pwd-hint {
  font-size: 11px;
  line-height: 14px;
  color: var(--tjg-text-tertiary);
  display: flex;
  align-items: center;
  gap: 6px;
  transition: color 0.2s;

  &::before {
    content: '○';
    font-size: 10px;
  }

  &.valid {
    color: var(--tjg-color-primary-500);

    &::before {
      content: '●';
    }
  }
}

@media (prefers-reduced-motion: reduce) {
  .pwd-hint {
    transition: none;
  }
}
</style>
