<template>
  <div class="forbidden-page">
    <div class="forbidden-content">
      <svg xmlns="http://www.w3.org/2000/svg" width="120" height="120" viewBox="0 0 120 120">
        <circle cx="60" cy="60" r="55" stroke="#e74c3c" stroke-width="4" fill="none" />
        <line x1="30" y1="30" x2="90" y2="90" stroke="#e74c3c" stroke-width="4" stroke-linecap="round" />
        <line x1="90" y1="30" x2="30" y2="90" stroke="#e74c3c" stroke-width="4" stroke-linecap="round" />
      </svg>
      <h1 class="forbidden-title">{{ t('admin.forbidden.title') }}</h1>
      <p class="forbidden-desc">{{ t('admin.forbidden.desc') }}</p>
      <n-button type="primary" @click="goHome">{{ t('common.goHome') }}</n-button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'

const router = useRouter()
const { t } = useI18n()

const goHome = () => router.push('/message')
</script>

<style scoped>
.forbidden-page {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 100vh;
  background: linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%);
}

.forbidden-content {
  text-align: center;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 16px;
}

.forbidden-title {
  font-size: 24px;
  font-weight: 600;
  color: var(--color-danger);
  margin: 0;
}

.forbidden-desc {
  font-size: 14px;
  color: var(--hula-text-secondary);
  margin: 0;
}
</style>
