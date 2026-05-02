<template>
  <div class="admin-dashboard">
    <n-spin :show="loading">
      <div class="stats-grid">
        <div v-for="stat in statCards" :key="stat.label" class="stat-card">
          <div class="stat-icon" :style="{ background: stat.color }">
            <svg class="size-24px" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path :d="stat.icon" />
            </svg>
          </div>
          <div class="stat-info">
            <span class="stat-value">{{ stat.value }}</span>
            <span class="stat-label">{{ stat.label }}</span>
          </div>
        </div>
      </div>

      <div class="dashboard-grid">
        <div class="dashboard-section">
          <h3>{{ t('admin.dashboard.serverInfo') }}</h3>
          <n-descriptions bordered :column="2" label-placement="left">
            <n-descriptions-item :label="t('admin.dashboard.totalRooms')">
              {{ stats?.roomCount ?? '-' }}
            </n-descriptions-item>
            <n-descriptions-item :label="t('admin.dashboard.totalUsers')">
              {{ stats?.userCount ?? '-' }}
            </n-descriptions-item>
            <n-descriptions-item :label="t('admin.dashboard.dailyActive')">
              {{ stats?.dailyActiveUsers ?? '-' }}
            </n-descriptions-item>
            <n-descriptions-item :label="t('admin.dashboard.monthlyActive')">
              {{ stats?.monthlyActiveUsers ?? '-' }}
            </n-descriptions-item>
            <n-descriptions-item :label="t('admin.dashboard.messages')">
              {{ stats?.messageCount ?? '-' }}
            </n-descriptions-item>
            <n-descriptions-item :label="t('admin.dashboard.uptime')">
              {{ formatUptime(stats?.startServerTime) }}
            </n-descriptions-item>
          </n-descriptions>
        </div>

        <div class="dashboard-section">
          <h3>{{ t('admin.dashboard.serverHealth') }}</h3>
          <div class="health-status">
            <div class="health-indicator" :class="serverHealth?.healthy ? 'healthy' : 'unhealthy'">
              <svg class="size-20px" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path v-if="serverHealth?.healthy" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                <path
                  v-else
                  d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
              <span>{{ serverHealth?.healthy ? t('admin.dashboard.healthy') : t('admin.dashboard.unhealthy') }}</span>
            </div>
          </div>
          <n-descriptions bordered :column="1" label-placement="left" class="server-version-descriptions">
            <n-descriptions-item :label="t('admin.dashboard.version')">
              {{ serverVersion?.serverVersion || '-' }}
            </n-descriptions-item>
            <n-descriptions-item :label="t('admin.dashboard.pythonVersion')">
              {{ serverVersion?.pythonVersion || '-' }}
            </n-descriptions-item>
          </n-descriptions>
        </div>
      </div>
    </n-spin>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { adminService, type ServerHealth, type ServerStats, type ServerVersion } from '@/services/matrix/admin'
import { useAdminStore } from '@/stores/domains/admin/admin'
import { useAdminErrorHandler } from './useAdminError'

const { t } = useI18n()
const adminStore = useAdminStore()
const { handleAdminError } = useAdminErrorHandler()

const stats = ref<ServerStats | null>(null)
const serverHealth = ref<ServerHealth | null>(null)
const serverVersion = ref<ServerVersion | null>(null)
const loading = ref(false)

const statCards = computed(() => [
  {
    label: t('admin.dashboard.totalUsers'),
    value: stats.value?.userCount ?? 0,
    icon: 'M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z',
    color: 'var(--hula-color-info-500)'
  },
  {
    label: t('admin.dashboard.totalRooms'),
    value: stats.value?.roomCount ?? 0,
    icon: 'M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4',
    color: 'var(--hula-color-success-500)'
  },
  {
    label: t('admin.dashboard.dailyActive'),
    value: stats.value?.dailyActiveUsers ?? 0,
    icon: 'M13 7h8m0 0v8m0-8l-8 8-4-4-6 6',
    color: 'var(--hula-color-warning-500)'
  },
  {
    label: t('admin.dashboard.monthlyActive'),
    value: stats.value?.monthlyActiveUsers ?? 0,
    icon: 'M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z',
    color: 'var(--hula-color-beta-500)'
  }
])

function formatUptime(timestamp?: number): string {
  if (!timestamp) return '-'
  const now = Date.now()
  const diff = now - timestamp
  const days = Math.floor(diff / (1000 * 60 * 60 * 24))
  const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60))
  return `${days}d ${hours}h`
}

async function loadData() {
  if (!adminStore.isAdmin) return
  loading.value = true
  try {
    const [statsResult, healthResult, versionResult] = await Promise.allSettled([
      adminService.getServerStats(),
      adminService.getServerHealth(),
      adminService.getServerVersion()
    ])
    if (statsResult.status === 'fulfilled') stats.value = statsResult.value
    if (healthResult.status === 'fulfilled') serverHealth.value = healthResult.value
    if (versionResult.status === 'fulfilled') serverVersion.value = versionResult.value
  } catch (err) {
    handleAdminError(err)
  } finally {
    loading.value = false
  }
}

onMounted(loadData)
</script>

<style scoped lang="scss">
.admin-dashboard {
  max-width: 1200px;
}

.stats-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 16px;
  margin-bottom: 24px;
}

.stat-card {
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 20px;
  background: var(--admin-card-bg);
  border-radius: 12px;
  box-shadow: var(--admin-card-shadow);
  transition:
    transform 0.2s,
    box-shadow 0.2s;

  &:hover {
    transform: translateY(-2px);
    box-shadow: var(--admin-card-shadow-hover);
  }
}

.stat-icon {
  width: 48px;
  height: 48px;
  border-radius: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.stat-info {
  display: flex;
  flex-direction: column;
}

.stat-value {
  font-size: 24px;
  font-weight: 700;
  color: var(--admin-stat-value-color);
}

.stat-label {
  font-size: 13px;
  color: var(--hula-text-quaternary);
  margin-top: 2px;
}

.dashboard-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 16px;
}

.dashboard-section {
  background: var(--admin-card-bg);
  border-radius: 12px;
  padding: 20px;
  box-shadow: var(--admin-card-shadow);

  h3 {
    margin: 0 0 16px;
    font-size: 16px;
    color: var(--admin-title-color);
    font-weight: 600;
    display: flex;
    align-items: center;
    gap: 8px;
  }
}

.health-status {
  display: flex;
  align-items: center;
  gap: 12px;
}

.server-version-descriptions {
  margin-top: 12px;
}

.health-indicator {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 16px;
  border-radius: 8px;
  font-weight: 500;

  &.healthy {
    background: var(--admin-health-ok-bg);
    color: var(--admin-health-ok-text);
  }

  &.unhealthy {
    background: var(--admin-health-err-bg);
    color: var(--admin-health-err-text);
  }
}

@media (max-width: 1024px) {
  .stats-grid {
    grid-template-columns: repeat(2, 1fr);
  }

  .dashboard-grid {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 640px) {
  .stats-grid {
    grid-template-columns: 1fr;
  }

  .stat-card {
    padding: 16px;
  }

  .stat-value {
    font-size: 20px;
  }

  .dashboard-section {
    padding: 16px;
  }
}
</style>
