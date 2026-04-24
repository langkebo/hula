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
        <router-link
          v-for="item in navItems"
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
import { ref, computed } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { useAdminStore } from '@/stores/domains/admin/admin'

const router = useRouter()
const route = useRoute()
const { t } = useI18n()
const adminStore = useAdminStore()

const sidebarCollapsed = ref(false)
const mobileMenuOpen = ref(false)

const navItems = computed(() => [
  {
    path: '/admin/dashboard',
    label: t('admin.nav.dashboard'),
    icon: 'M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6'
  },
  {
    path: '/admin/users',
    label: t('admin.nav.users'),
    icon: 'M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z'
  },
  {
    path: '/admin/rooms',
    label: t('admin.nav.rooms'),
    icon: 'M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4'
  },
  {
    path: '/admin/federation',
    label: t('admin.nav.federation'),
    icon: 'M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z'
  },
  {
    path: '/admin/notices',
    label: t('admin.nav.notices'),
    icon: 'M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9'
  }
])

const currentPageTitle = computed(() => {
  const item = navItems.value.find((i) => route.path.startsWith(i.path))
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
  color: #fff;
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
  gap: 4px;
  overflow-y: auto;
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
    color: #fff;
    background: var(--admin-sidebar-hover);
  }

  &--active {
    color: #fff;
    background: var(--color-primary-active);
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
    color: #fff;
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
    background: var(--bg-msg-hover);
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
  background: rgba(0, 0, 0, 0.4);
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
