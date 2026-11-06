<template>
  <div class="admin-layout">
    <AdminSidebar :mobile-open="mobileMenuOpen" @close="mobileMenuOpen = false" @back-home="goHome" />

    <div class="admin-main">
      <ActionBar :shrink="false" class="shrink-0" />
      <div class="admin-header">
        <div class="admin-header-left">
          <button
            class="admin-menu-toggle"
            :aria-label="t('admin.menuToggle')"
            :aria-expanded="mobileMenuOpen"
            @click="mobileMenuOpen = !mobileMenuOpen">
            <AdminNavIcon name="menuToggle" size="20px" />
          </button>
          <h2 class="admin-page-title">{{ currentPageTitle }}</h2>
        </div>
        <div class="admin-header-actions">
          <n-tag :type="statusTagType" size="small">{{ statusLabel }}</n-tag>
        </div>
      </div>

      <div class="admin-content">
        <router-view v-if="navState === 'ready'" />
        <div v-else class="admin-state-panel">
          <h3 class="admin-state-title">{{ stateTitle }}</h3>
          <p class="admin-state-description">{{ stateDescription }}</p>
          <button
            v-if="navState === 'unavailable'"
            class="admin-state-retry"
            type="button"
            :disabled="retrying"
            @click="retryProbe">
            {{ retrying ? t('admin.availability.retrying') : t('admin.availability.retry') }}
          </button>
        </div>
      </div>
    </div>

    <div v-if="mobileMenuOpen" class="admin-overlay" @click="mobileMenuOpen = false" />
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'
import AdminSidebar from './AdminSidebar.vue'
import AdminNavIcon from './icons/AdminNavIcon.vue'
import { useAdminNav } from './useAdminNav'

const router = useRouter()
const { t } = useI18n()
const { navState, retrying, stateTitle, stateDescription, statusTagType, statusLabel, currentPageTitle, retryProbe } =
  useAdminNav()

const mobileMenuOpen = ref(false)

const goHome = () => {
  router.push('/message')
}
</script>

<style scoped lang="scss">
@use '@/styles/scss/global/responsive.scss' as responsive;

.admin-layout {
  display: flex;
  height: 100vh;
  overflow: hidden;
  background: var(--admin-bg);
}

.admin-main {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  min-width: 0;
}

.admin-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px 24px;
  background: var(--admin-card-bg);
  border-bottom: 1px solid var(--admin-header-border);
  flex-shrink: 0;
}

.admin-header-left {
  display: flex;
  align-items: center;
  gap: 12px;
}

.admin-menu-toggle {
  display: none;
  align-items: center;
  justify-content: center;
  width: 36px;
  height: 36px;
  border-radius: 8px;
  border: 1px solid var(--admin-header-border);
  background: var(--admin-card-bg);
  cursor: pointer;
  color: var(--admin-title-color);
  transition: all 0.2s;

  &:hover {
    background: var(--tjg-surface-list-hover);
  }
}

.admin-page-title {
  font-size: 18px;
  font-weight: 600;
  color: var(--admin-title-color);
  margin: 0;
}

.admin-content {
  flex: 1;
  overflow-y: auto;
  padding: 24px;
}

.admin-state-panel {
  max-width: 480px;
  padding: 24px;
  border: 1px solid var(--admin-header-border);
  border-radius: 12px;
  background: var(--admin-card-bg);
}

.admin-state-title {
  margin: 0 0 8px;
  font-size: 16px;
  font-weight: 600;
  color: var(--admin-title-color);
}

.admin-state-description {
  margin: 0;
  font-size: 13px;
  line-height: 1.7;
  color: var(--tjg-text-secondary);
}

.admin-state-retry {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  margin-top: 16px;
  padding: 8px 16px;
  border: none;
  border-radius: 8px;
  background: var(--tjg-color-primary-500);
  color: var(--tjg-text-inverse);
  font-size: 13px;
  cursor: pointer;
  transition: opacity 0.2s;

  &:hover:not(:disabled) {
    opacity: 0.9;
  }

  &:disabled {
    cursor: not-allowed;
    opacity: 0.6;
  }
}

.admin-overlay {
  display: none;
  position: fixed;
  inset: 0;
  background: color-mix(in srgb, var(--tjg-surface-media-preview) 40%, transparent);
  z-index: 99;
}

@include responsive.respond-to-max('md') {
  .admin-menu-toggle {
    display: flex;
  }

  .admin-overlay {
    display: block;
  }

  .admin-header {
    padding: 12px 16px;
  }

  .admin-page-title {
    font-size: 16px;
  }

  .admin-content {
    padding: 16px;
  }
}
</style>
