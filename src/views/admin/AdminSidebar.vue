<template>
  <div class="admin-sidebar" :class="{ 'sidebar-mobile-open': mobileOpen }">
    <div class="admin-sidebar-header">
      <AdminNavIcon name="lock" size="24px" />
      <span class="admin-sidebar-title">{{ t('admin.title') }}</span>
    </div>

    <nav class="admin-nav">
      <template v-if="navState === 'ready'">
        <template v-for="group in visibleNavGroups" :key="group.label">
          <div class="admin-nav-group-label">{{ group.label }}</div>
          <router-link
            v-for="item in group.items"
            :key="item.path"
            :to="item.path"
            class="admin-nav-item"
            active-class="admin-nav-item--active"
            @click="emit('close')">
            <AdminNavIcon :name="item.icon" />
            <span>{{ item.label }}</span>
          </router-link>
        </template>
      </template>

      <div v-else class="admin-nav-state">
        <div v-if="showSkeleton" class="admin-nav-skeleton" aria-hidden="true">
          <span v-for="row in 6" :key="row" class="admin-nav-skeleton-row" />
        </div>
        <p
          v-if="navState === 'unsupported' || navState === 'forbidden' || navState === 'unauthorized'"
          class="admin-nav-state-title">
          {{ stateTitle }}
        </p>
        <button
          v-if="navState === 'unavailable'"
          class="admin-nav-retry"
          type="button"
          :disabled="retrying"
          @click="retryProbe">
          {{ retrying ? t('admin.availability.retrying') : t('admin.availability.retry') }}
        </button>
      </div>
    </nav>

    <div class="admin-sidebar-footer">
      <button class="admin-back-btn" @click="emit('backHome')">
        <AdminNavIcon name="backToApp" />
        <span>{{ t('admin.backToApp') }}</span>
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import AdminNavIcon from './icons/AdminNavIcon.vue'
import { useAdminNav } from './useAdminNav'

defineProps<{ mobileOpen: boolean }>()

const emit = defineEmits<{ close: []; backHome: [] }>()

const { t } = useI18n()
const { navState, visibleNavGroups, showSkeleton, retrying, stateTitle, retryProbe } = useAdminNav()
</script>

<style scoped lang="scss">
@use '@/styles/scss/global/responsive.scss' as responsive;

.admin-sidebar {
  width: 220px;
  background: var(--admin-sidebar-bg);
  color: var(--tjg-text-inverse);
  display: flex;
  flex-direction: column;
  flex-shrink: 0;
  transition: width var(--tjg-motion-duration-slow) ease;
  z-index: 100;
}

.admin-sidebar-header {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 20px 16px;
  border-bottom: 1px solid var(--admin-sidebar-border);
}

.admin-sidebar-title {
  font-size: 16px;
  font-weight: 600;
  white-space: nowrap;
  overflow: hidden;
}

.admin-nav {
  flex: 1;
  padding: 12px 8px;
  display: flex;
  flex-direction: column;
  gap: 2px;
  overflow-y: auto;
}

.admin-nav-group-label {
  padding: 16px 12px 6px;
  font-size: 11px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: var(--admin-sidebar-text);
  opacity: 0.5;
  white-space: nowrap;

  &:first-child {
    padding-top: 4px;
  }
}

.admin-nav-item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 12px;
  border-radius: 8px;
  color: var(--admin-sidebar-text);
  text-decoration: none;
  font-size: 14px;
  transition:
    color var(--tjg-motion-duration-normal),
    background-color var(--tjg-motion-duration-normal),
    border-color var(--tjg-motion-duration-normal),
    box-shadow var(--tjg-motion-duration-normal),
    opacity var(--tjg-motion-duration-normal),
    transform var(--tjg-motion-duration-normal);
  white-space: nowrap;

  &:hover {
    color: var(--tjg-text-inverse);
    background: var(--admin-sidebar-hover);
  }

  &--active {
    color: var(--tjg-text-inverse);
    background: var(--tjg-color-primary-300-alpha);
  }
}

.admin-nav-state {
  padding: 8px;
}

.admin-nav-state-title {
  margin: 0;
  padding: 8px 12px;
  font-size: 13px;
  line-height: 1.6;
  color: var(--admin-sidebar-text);
  opacity: 0.8;
}

.admin-nav-skeleton {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 8px 12px;
}

.admin-nav-skeleton-row {
  height: 34px;
  border-radius: 8px;
  background: var(--admin-sidebar-hover);
  animation: admin-skeleton-pulse 1.4s ease-in-out infinite;
}

.admin-nav-retry {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  margin: 8px 12px 0;
  padding: 8px 16px;
  border: none;
  border-radius: 8px;
  background: var(--tjg-color-primary-500);
  color: var(--tjg-text-inverse);
  font-size: 13px;
  cursor: pointer;
  transition: opacity var(--tjg-motion-duration-normal);

  &:hover:not(:disabled) {
    opacity: 0.9;
  }

  &:disabled {
    cursor: not-allowed;
    opacity: 0.6;
  }
}

@keyframes admin-skeleton-pulse {
  0%,
  100% {
    opacity: 0.45;
  }

  50% {
    opacity: 0.85;
  }
}

@media (prefers-reduced-motion: reduce) {
  .admin-nav-skeleton-row {
    animation: none;
  }
}

.admin-sidebar-footer {
  padding: 12px 8px;
  border-top: 1px solid var(--admin-sidebar-border);
}

.admin-back-btn {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 12px;
  border-radius: 8px;
  color: var(--admin-sidebar-text);
  background: none;
  border: none;
  cursor: pointer;
  font-size: 14px;
  width: 100%;
  transition:
    color var(--tjg-motion-duration-normal),
    background-color var(--tjg-motion-duration-normal),
    border-color var(--tjg-motion-duration-normal),
    box-shadow var(--tjg-motion-duration-normal),
    opacity var(--tjg-motion-duration-normal),
    transform var(--tjg-motion-duration-normal);
  white-space: nowrap;

  &:hover {
    color: var(--tjg-text-inverse);
    background: var(--admin-sidebar-hover);
  }
}

@include responsive.down('md') {
  .admin-sidebar {
    position: fixed;
    left: -260px;
    top: 0;
    bottom: 0;
    width: 240px;
    transition: left var(--tjg-motion-duration-slow) ease;
  }

  .admin-sidebar.sidebar-mobile-open {
    left: 0;
  }
}

// shrink 档（768–991px）：侧栏收为图标条；与 responsive.scss 的 md/lg 断点同源
@include responsive.up('md') {
  @include responsive.down('lg') {
    .admin-sidebar {
      width: 64px;
    }

    .admin-sidebar-title,
    .admin-nav-item span,
    .admin-back-btn span {
      display: none;
    }

    .admin-nav-item,
    .admin-back-btn {
      justify-content: center;
      padding: 10px;
    }

    .admin-sidebar-header {
      justify-content: center;
      padding: 16px 8px;
    }
  }
}
</style>
