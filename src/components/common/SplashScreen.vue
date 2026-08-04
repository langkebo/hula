<template>
  <Transition name="splash-fade" appear>
    <div v-if="visible" class="splash-screen" :class="{ 'is-minimal': minimal }">
      <div class="splash-content">
        <div class="logo-container">
          <img v-if="!minimal" src="/tjg.png" class="logo-image" alt="Tjg Logo" />
          <div v-else class="minimal-logo">
            <svg class="w-48px h-48px" viewBox="0 0 100 100" fill="none">
              <circle cx="50" cy="50" r="45" stroke="var(--tjg-color-primary-500)" stroke-width="4" fill="none" />
              <path
                d="M30 50 L45 65 L70 35"
                stroke="var(--tjg-color-primary-500)"
                stroke-width="4"
                stroke-linecap="round"
                stroke-linejoin="round"
                fill="none" />
            </svg>
          </div>
        </div>

        <div v-if="!minimal" class="progress-section">
          <n-progress
            type="line"
            :show-indicator="false"
            :color="'var(--tjg-color-primary-500)'"
            :rail-color="'var(--tjg-color-primary-300-alpha)'"
            :percentage="percentage" />
          <n-flex justify="center" align="center" :gap="12">
            <n-spin :size="12" :color="'var(--tjg-color-primary-500)'" />
            <span class="loading-text">{{ loadingText }}</span>
          </n-flex>
        </div>

        <div v-if="showError && errorMessage" class="error-section">
          <n-alert type="error" :show-icon="true">
            {{ errorMessage }}
          </n-alert>
          <n-button v-if="retryable" type="primary" size="small" @click="$emit('retry')">{{ t('retry') }}</n-button>
        </div>
      </div>
    </div>
  </Transition>
</template>

<script setup lang="ts">
import { NAlert } from 'naive-ui'
import { useI18n } from 'vue-i18n'

defineProps<{
  visible: boolean
  percentage?: number
  loadingText?: string
  minimal?: boolean
  showError?: boolean
  errorMessage?: string
  retryable?: boolean
}>()

defineEmits<{
  retry: []
}>()

const { t } = useI18n()
</script>

<style scoped>
.splash-screen {
  position: fixed;
  inset: 0;
  z-index: 9999;
  display: flex;
  justify-content: center;
  align-items: center;
  background: var(--tjg-surface-elevated);
}

.splash-screen.is-minimal {
  background: transparent;
}

.splash-content {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 24px;
}

.logo-container {
  width: 220px;
  height: 104px;
  display: flex;
  justify-content: center;
  align-items: center;
}

.logo-image {
  width: 100%;
  height: 100%;
  object-fit: contain;
}

.minimal-logo {
  display: flex;
  justify-content: center;
  align-items: center;
}

.progress-section {
  width: 280px;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.loading-text {
  font-size: 14px;
  color: var(--tjg-text-secondary);
}

.error-section {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
  max-width: 300px;
}

.splash-fade-enter-active,
.splash-fade-leave-active {
  transition: opacity 0.3s ease;
}

.splash-fade-enter-from,
.splash-fade-leave-to {
  opacity: 0;
}
</style>
