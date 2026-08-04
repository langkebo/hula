<template>
  <div class="not-found-page">
    <div class="not-found-container">
      <div class="not-found-icon">
        <svg width="120" height="120" viewBox="0 0 120 120" fill="none">
          <circle cx="60" cy="60" r="55" stroke="var(--tjg-text-disabled)" stroke-width="4" fill="none" />
          <text x="60" y="68" text-anchor="middle" font-size="36" font-weight="700" fill="var(--tjg-text-disabled)">
            ?
          </text>
        </svg>
      </div>
      <h1 class="not-found-title">404</h1>
      <p class="not-found-message">{{ t('common.notFound') }}</p>
      <n-button type="primary" size="large" @click="goHome">
        {{ t('common.goHome') }}
      </n-button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'

const router = useRouter()
const { t } = useI18n()

const goHome = () => {
  router.push('/message')
}
</script>

<style scoped lang="scss">
.not-found-page {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 100vh;
  background: linear-gradient(135deg, var(--tjg-surface-panel-muted) 0%, var(--tjg-surface-subtle) 100%);
}

.not-found-container {
  text-align: center;
  padding: 60px 40px;
  background: white;
  border-radius: 16px;
  box-shadow: var(--tjg-shadow-md);
  max-width: 480px;
  width: 90%;
}

.not-found-icon {
  margin-bottom: 24px;
}

.not-found-title {
  font-size: 72px;
  font-weight: 700;
  color: var(--tjg-text-tertiary);
  margin: 0;
  line-height: 1;
}

.not-found-message {
  font-size: 18px;
  color: var(--tjg-text-secondary);
  margin: 16px 0 32px;
  line-height: 1.6;
}
</style>
