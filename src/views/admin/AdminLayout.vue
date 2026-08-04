<template>
  <div class="admin-layout" :class="{ 'sidebar-collapsed': sidebarCollapsed }">
    <div class="admin-sidebar" :class="{ 'sidebar-mobile-open': mobileMenuOpen }">
      <div class="admin-sidebar-header">
        <AdminNavIcon name="lock" size="24px" />
        <span class="admin-sidebar-title">{{ t('admin.title') }}</span>
      </div>

      <nav class="admin-nav">
        <template v-for="group in navGroups" :key="group.label">
          <div class="admin-nav-group-label">{{ group.label }}</div>
          <router-link
            v-for="item in group.items"
            :key="item.path"
            :to="item.path"
            class="admin-nav-item"
            active-class="admin-nav-item--active"
            @click="mobileMenuOpen = false">
            <AdminNavIcon :name="item.icon" />
            <span>{{ item.label }}</span>
          </router-link>
        </template>
      </nav>

      <div class="admin-sidebar-footer">
        <button class="admin-back-btn" @click="goHome">
          <AdminNavIcon name="backToApp" />
          <span>{{ t('admin.backToApp') }}</span>
        </button>
      </div>
    </div>

    <div class="admin-main">
      <div class="admin-header">
        <div class="admin-header-left">
          <button class="admin-menu-toggle" @click="mobileMenuOpen = !mobileMenuOpen">
            <AdminNavIcon name="menuToggle" size="20px" />
          </button>
          <h2 class="admin-page-title">{{ currentPageTitle }}</h2>
        </div>
        <div class="admin-header-actions">
          <n-tag :type="adminStore.isAdmin ? 'success' : 'error'" size="small">
            {{ adminStore.isAdmin ? t('admin.status.admin') : t('admin.status.user') }}
          </n-tag>
        </div>
      </div>

      <div class="admin-content">
        <router-view />
      </div>
    </div>

    <div v-if="mobileMenuOpen" class="admin-overlay" @click="mobileMenuOpen = false" />
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRoute, useRouter } from 'vue-router'
import { useAdminStore } from '@/stores/domains/admin/admin'
import AdminNavIcon from './icons/AdminNavIcon.vue'
import type { AdminNavIconName } from './icons/adminNavIcons'

const router = useRouter()
const route = useRoute()
const { t } = useI18n()
const adminStore = useAdminStore()

const sidebarCollapsed = ref(false)
const mobileMenuOpen = ref(false)

interface NavItem {
  path: string
  label: string
  icon: AdminNavIconName
}

interface NavGroup {
  label: string
  items: NavItem[]
}

const navGroups = computed<NavGroup[]>(() => [
  {
    label: t('admin.nav_group.overview'),
    items: [
      {
        path: '/admin/dashboard',
        label: t('admin.nav.dashboard'),
        icon: 'dashboard'
      }
    ]
  },
  {
    label: t('admin.nav_group.userManagement'),
    items: [
      {
        path: '/admin/users',
        label: t('admin.nav.users'),
        icon: 'users'
      },
      {
        path: '/admin/registration-tokens',
        label: t('admin.nav.registrationTokens'),
        icon: 'registrationTokens'
      },
      {
        path: '/admin/guests',
        label: t('admin.nav.guests'),
        icon: 'guests'
      }
    ]
  },
  {
    label: t('admin.nav_group.roomManagement'),
    items: [
      {
        path: '/admin/rooms',
        label: t('admin.nav.rooms'),
        icon: 'rooms'
      },
      {
        path: '/admin/spaces',
        label: t('admin.nav.spaces'),
        icon: 'spaces'
      }
    ]
  },
  {
    label: t('admin.nav_group.federation'),
    items: [
      {
        path: '/admin/federation',
        label: t('admin.nav.federation'),
        icon: 'federation'
      },
      {
        path: '/admin/federation-monitor',
        label: t('admin.nav.federationMonitor'),
        icon: 'federationMonitor'
      }
    ]
  },
  {
    label: t('admin.nav_group.messaging'),
    items: [
      {
        path: '/admin/notices',
        label: t('admin.nav.notices'),
        icon: 'notices'
      },
      {
        path: '/admin/notifications',
        label: t('admin.nav.notifications'),
        icon: 'notifications'
      }
    ]
  },
  {
    label: t('admin.nav_group.security'),
    items: [
      {
        path: '/admin/audit',
        label: t('admin.nav.audit'),
        icon: 'audit'
      },
      {
        path: '/admin/security',
        label: t('admin.nav.security'),
        icon: 'security'
      },
      {
        path: '/admin/moderation',
        label: t('admin.nav.moderation'),
        icon: 'moderation'
      }
    ]
  },
  {
    label: t('admin.nav_group.system'),
    items: [
      {
        path: '/admin/server-config',
        label: t('admin.nav.server_config'),
        icon: 'serverConfig'
      },
      {
        path: '/admin/server-logs',
        label: t('admin.nav.serverLogs'),
        icon: 'serverLogs'
      },
      {
        path: '/admin/maintenance',
        label: t('admin.nav.maintenance'),
        icon: 'maintenance'
      },
      {
        path: '/admin/retention',
        label: t('admin.nav.retention'),
        icon: 'retention'
      },
      {
        path: '/admin/saml',
        label: t('admin.nav.saml'),
        icon: 'saml'
      },
      {
        path: '/admin/app-services',
        label: t('admin.nav.appServices'),
        icon: 'appServices'
      },
      {
        path: '/admin/modules',
        label: t('admin.nav.modules'),
        icon: 'modules'
      }
    ]
  }
])

const allNavItems = computed(() => navGroups.value.flatMap((g) => g.items))

const currentPageTitle = computed(() => {
  const item = allNavItems.value.find((i) => route.path.startsWith(i.path))
  return item?.label || t('admin.title')
})

const goHome = () => {
  router.push('/message')
}
</script>

<style scoped lang="scss">
.admin-layout {
  display: flex;
  height: 100vh;
  overflow: hidden;
  background: var(--admin-bg);
}

.admin-sidebar {
  width: 220px;
  background: var(--admin-sidebar-bg);
  color: var(--tjg-text-inverse);
  display: flex;
  flex-direction: column;
  flex-shrink: 0;
  transition: width 0.3s ease;
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
  transition: all 0.2s;
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
  transition: all 0.2s;
  white-space: nowrap;

  &:hover {
    color: var(--tjg-text-inverse);
    background: var(--admin-sidebar-hover);
  }
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

.admin-overlay {
  display: none;
  position: fixed;
  inset: 0;
  background: color-mix(in srgb, var(--tjg-surface-media-preview) 40%, transparent);
  z-index: 99;
}

@media (max-width: 768px) {
  .admin-menu-toggle {
    display: flex;
  }

  .admin-sidebar {
    position: fixed;
    left: -260px;
    top: 0;
    bottom: 0;
    width: 240px;
    transition: left 0.3s ease;
  }

  .admin-sidebar.sidebar-mobile-open {
    left: 0;
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

@media (min-width: 769px) and (max-width: 1024px) {
  .admin-sidebar {
    width: 64px;
  }

  .admin-sidebar-title,
  .admin-nav-item span,
  .admin-back-btn span {
    display: none;
  }

  .admin-nav-item {
    justify-content: center;
    padding: 10px;
  }

  .admin-back-btn {
    justify-content: center;
    padding: 10px;
  }

  .admin-sidebar-header {
    justify-content: center;
    padding: 16px 8px;
  }
}
</style>
