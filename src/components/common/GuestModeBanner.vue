<template>
  <div v-if="visible" class="guest-mode-banner" role="banner" :style="{ background: 'var(--tjg-color-warning-100)' }">
    <div class="guest-mode-banner__content">
      <svg class="guest-mode-banner__icon" width="20" height="20" viewBox="0 0 24 24" fill="none">
        <path
          d="M12 2L2 22h20L12 2z"
          stroke="var(--tjg-color-warning-500)"
          stroke-width="2"
          stroke-linejoin="round"
          fill="var(--tjg-color-warning-100)" />
        <line
          x1="12"
          y1="9"
          x2="12"
          y2="14"
          stroke="var(--tjg-color-warning-500)"
          stroke-width="2"
          stroke-linecap="round" />
        <circle cx="12" cy="17.5" r="1.2" fill="var(--tjg-color-warning-500)" />
      </svg>
      <span class="guest-mode-banner__text">
        <template v-if="guestUserId">{{ guestUserId }} ·</template>
        您正在以访客身份浏览，功能受限
      </span>
    </div>
    <div class="guest-mode-banner__actions">
      <n-button size="small" type="primary" data-testid="guest-upgrade-btn" @click="$emit('upgrade')">
        {{ t('common.login') || '登录' }}
      </n-button>
      <n-button size="small" quaternary data-testid="guest-exit-btn" @click="$emit('exit')">
        {{ t('common.exit') || '退出' }}
      </n-button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useI18n } from 'vue-i18n'

defineOptions({ name: 'GuestModeBanner' })

defineProps<{
  visible: boolean
  guestUserId?: string | null
}>()

defineEmits<{
  upgrade: []
  exit: []
}>()

const { t } = useI18n()
</script>

<style scoped lang="scss">
.guest-mode-banner {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 8px 16px;
  border-bottom: 1px solid var(--tjg-color-warning-400);
}

.guest-mode-banner__content {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
}

.guest-mode-banner__icon {
  flex-shrink: 0;
}

.guest-mode-banner__text {
  font-size: 13px;
  color: var(--tjg-text-primary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.guest-mode-banner__actions {
  display: flex;
  align-items: center;
  gap: 4px;
  flex-shrink: 0;
}
</style>
