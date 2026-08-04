<template>
  <div class="admin-layout" :class="{ 'sidebar-collapsed': sidebarCollapsed }">
    <div class="admin-sidebar" :class="{ 'sidebar-mobile-open': mobileMenuOpen }">
      <div class="admin-sidebar-header">
        <svg class="size-24px" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path
            d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
        </svg>
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
            <svg class="size-18px" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path :d="item.icon" />
            </svg>
            <span>{{ item.label }}</span>
          </router-link>
        </template>
      </nav>

      <div class="admin-sidebar-footer">
        <button class="admin-back-btn" @click="goHome">
          <svg class="size-18px" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M19 12H5m7-7l-7 7 7 7" />
          </svg>
          <span>{{ t('admin.backToApp') }}</span>
        </button>
      </div>
    </div>

    <div class="admin-main">
      <div class="admin-header">
        <div class="admin-header-left">
          <button class="admin-menu-toggle" @click="mobileMenuOpen = !mobileMenuOpen">
            <svg class="size-20px" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M4 6h16M4 12h16M4 18h16" />
            </svg>
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

const router = useRouter()
const route = useRoute()
const { t } = useI18n()
const adminStore = useAdminStore()

const sidebarCollapsed = ref(false)
const mobileMenuOpen = ref(false)

interface NavItem {
  path: string
  label: string
  icon: string
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
        icon: 'M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6'
      }
    ]
  },
  {
    label: t('admin.nav_group.userManagement'),
    items: [
      {
        path: '/admin/users',
        label: t('admin.nav.users'),
        icon: 'M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z'
      },
      {
        path: '/admin/registration-tokens',
        label: t('admin.nav.registrationTokens'),
        icon: 'M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z'
      },
      {
        path: '/admin/guests',
        label: t('admin.nav.guests'),
        icon: 'M16 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2m9-13a4 4 0 11-8 0 4 4 0 018 0zm6 5v2m0 4v.01M19 10a2 2 0 012 2v7a2 2 0 01-2 2h-2a2 2 0 01-2-2v-7a2 2 0 012-2h2z'
      }
    ]
  },
  {
    label: t('admin.nav_group.roomManagement'),
    items: [
      {
        path: '/admin/rooms',
        label: t('admin.nav.rooms'),
        icon: 'M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4'
      },
      {
        path: '/admin/spaces',
        label: t('admin.nav.spaces'),
        icon: 'M4 5a1 1 0 011-1h14a1 1 0 011 1v2a1 1 0 01-1 1H5a1 1 0 01-1-1V5zM4 13a1 1 0 011-1h6a1 1 0 011 1v6a1 1 0 01-1 1H5a1 1 0 01-1-1v-6zM16 13a1 1 0 011-1h2a1 1 0 011 1v6a1 1 0 01-1 1h-2a1 1 0 01-1-1v-6z'
      }
    ]
  },
  {
    label: t('admin.nav_group.federation'),
    items: [
      {
        path: '/admin/federation',
        label: t('admin.nav.federation'),
        icon: 'M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z'
      },
      {
        path: '/admin/federation-monitor',
        label: t('admin.nav.federationMonitor'),
        icon: 'M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z'
      }
    ]
  },
  {
    label: t('admin.nav_group.messaging'),
    items: [
      {
        path: '/admin/notices',
        label: t('admin.nav.notices'),
        icon: 'M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9'
      },
      {
        path: '/admin/notifications',
        label: t('admin.nav.notifications'),
        icon: 'M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9'
      }
    ]
  },
  {
    label: t('admin.nav_group.security'),
    items: [
      {
        path: '/admin/audit',
        label: t('admin.nav.audit'),
        icon: 'M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01'
      },
      {
        path: '/admin/security',
        label: t('admin.nav.security'),
        icon: 'M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z'
      },
      {
        path: '/admin/moderation',
        label: t('admin.nav.moderation'),
        icon: 'M3 21v-4m0 0V5a2 2 0 012-2h6.5l1 1H21l-3 6 3 6h-8.5l-1-1H5a2 2 0 00-2 2zm9-13.5V9'
      }
    ]
  },
  {
    label: t('admin.nav_group.system'),
    items: [
      {
        path: '/admin/server-config',
        label: t('admin.nav.server_config'),
        icon: 'M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z M15 12a3 3 0 11-6 0 3 3 0 016 0z'
      },
      {
        path: '/admin/server-logs',
        label: t('admin.nav.serverLogs'),
        icon: 'M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4m0 5c0 2.21-3.582 4-8 4s-8-1.79-8-4'
      },
      {
        path: '/admin/maintenance',
        label: t('admin.nav.maintenance'),
        icon: 'M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z M15 12a3 3 0 11-6 0 3 3 0 016 0z'
      },
      {
        path: '/admin/retention',
        label: t('admin.nav.retention'),
        icon: 'M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z'
      },
      {
        path: '/admin/saml',
        label: t('admin.nav.saml'),
        icon: 'M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1'
      },
      {
        path: '/admin/app-services',
        label: t('admin.nav.appServices'),
        icon: 'M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z'
      },
      {
        path: '/admin/modules',
        label: t('admin.nav.modules'),
        icon: 'M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z'
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
