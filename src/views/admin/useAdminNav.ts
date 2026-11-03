import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRoute } from 'vue-router'
import type { AdminNavState, AdminOptionalCapability } from '@/services/matrix/admin/adminApiAvailability'
import {
  filterAdminNavGroups,
  readOptionalCapabilityFlag,
  resolveAdminNavState
} from '@/services/matrix/admin/adminApiAvailability'
import { useAdminStore } from '@/stores/domains/admin/admin'
import { useCapabilityStore } from '@/stores/domains/chat/capability'
import type { AdminNavIconName } from './icons/adminNavIcons'

export interface AdminNavItem {
  path: string
  label: string
  icon: AdminNavIconName
  requires?: 'admin-api'
  optionalCapability?: AdminOptionalCapability
}

export interface AdminNavGroup {
  label: string
  items: AdminNavItem[]
}

export type AdminStatusTagType = 'default' | 'primary' | 'info' | 'success' | 'warning' | 'error'

/**
 * 后台导航的派生状态：六态、可选能力过滤、状态文案与状态徽标。
 * 由 `adminApiAvailability.ts` 的纯函数派生，组件只负责渲染。
 */
export function useAdminNav() {
  const { t } = useI18n()
  const route = useRoute()
  const adminStore = useAdminStore()
  const capabilityStore = useCapabilityStore()

  const rawNavGroups = computed<AdminNavGroup[]>(() => [
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
          icon: 'saml',
          optionalCapability: 'saml'
        },
        {
          path: '/admin/app-services',
          label: t('admin.nav.appServices'),
          icon: 'appServices'
        },
        {
          path: '/admin/telemetry',
          label: t('admin.nav.telemetry'),
          icon: 'telemetry'
        },
        {
          path: '/admin/background-updates',
          label: t('admin.nav.backgroundUpdates'),
          icon: 'backgroundUpdates'
        },
        {
          path: '/admin/media',
          label: t('admin.nav.media'),
          icon: 'media'
        },
        {
          path: '/admin/modules',
          label: t('admin.nav.modules'),
          icon: 'modules',
          optionalCapability: 'modules'
        }
      ]
    }
  ])

  const navGroups = computed<AdminNavGroup[]>(() =>
    rawNavGroups.value.map((group) => ({
      label: group.label,
      items: group.items.map((item) => ({ ...item, requires: 'admin-api' as const }))
    }))
  )

  const navState = computed<AdminNavState>(() =>
    resolveAdminNavState(adminStore.apiAvailability, adminStore.availabilityLoaded)
  )

  const isOptionalCapabilityEnabled = (capability: AdminOptionalCapability) =>
    readOptionalCapabilityFlag(capability, capabilityStore.unstableFeatures)

  const visibleNavGroups = computed<AdminNavGroup[]>(() =>
    filterAdminNavGroups(navGroups.value, navState.value, isOptionalCapabilityEnabled)
  )

  const showSkeleton = computed(() => navState.value === 'loading' || navState.value === 'unavailable')

  const retrying = computed(() => adminStore.isCheckingAdmin)

  const stateTitle = computed(() => {
    switch (navState.value) {
      case 'loading':
        return t('admin.availability.loading.title')
      case 'forbidden':
        return t('admin.availability.forbidden.title')
      case 'unauthorized':
        return t('admin.availability.unauthorized.title')
      case 'unsupported':
        return t('admin.availability.unsupported.title')
      case 'unavailable':
        return t('admin.availability.unavailable.title')
      default:
        return t('admin.title')
    }
  })

  const stateDescription = computed(() => {
    switch (navState.value) {
      case 'loading':
        return t('admin.availability.loading.description')
      case 'forbidden':
        return t('admin.availability.forbidden.description')
      case 'unauthorized':
        return t('admin.availability.unauthorized.description')
      case 'unsupported':
        return t('admin.availability.unsupported.description')
      case 'unavailable':
        return t('admin.availability.unavailable.description')
      default:
        return ''
    }
  })

  const statusTagType = computed<AdminStatusTagType>(() => {
    switch (navState.value) {
      case 'ready':
        return adminStore.isAdmin ? 'success' : 'error'
      case 'forbidden':
      case 'unauthorized':
        return 'error'
      case 'unsupported':
      case 'unavailable':
        return 'warning'
      default:
        return 'default'
    }
  })

  const statusLabel = computed(() => {
    switch (navState.value) {
      case 'ready':
        return adminStore.isAdmin ? t('admin.status.admin') : t('admin.status.user')
      case 'loading':
        return t('admin.availability.tag.loading')
      case 'forbidden':
        return t('admin.availability.tag.forbidden')
      case 'unauthorized':
        return t('admin.availability.tag.unauthorized')
      case 'unsupported':
        return t('admin.availability.tag.unsupported')
      default:
        return t('admin.availability.tag.unavailable')
    }
  })

  const currentPageTitle = computed(() => {
    const item = navGroups.value.flatMap((group) => group.items).find((i) => route.path.startsWith(i.path))
    return item?.label || t('admin.title')
  })

  const retryProbe = () => {
    void adminStore.retryApiProbe()
  }

  return {
    navState,
    visibleNavGroups,
    showSkeleton,
    retrying,
    stateTitle,
    stateDescription,
    statusTagType,
    statusLabel,
    currentPageTitle,
    retryProbe
  }
}
