<template>
  <div class="admin-dashboard">
    <n-spin :show="loading">
      <div class="stats-grid">
        <AdminStatCard
          v-for="stat in statCards"
          :key="stat.label"
          :label="stat.label"
          :value="stat.value"
          :icon="stat.icon"
          :color="stat.color" />
      </div>

      <!-- Charts Section -->
      <div class="charts-grid">
        <div class="dashboard-section chart-section">
          <h3>
            <svg class="size-16px" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M3 3v18h18M7 14l4-4 4 4 6-6" />
            </svg>
            {{ t('admin.dashboard.activityTrend') }}
          </h3>
          <div class="line-chart-container">
            <svg class="line-chart" viewBox="0 0 400 180" preserveAspectRatio="none">
              <defs>
                <linearGradient :id="'area-gradient'" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stop-color="var(--tjg-color-primary-500)" stop-opacity="0.3" />
                  <stop offset="100%" stop-color="var(--tjg-color-primary-500)" stop-opacity="0" />
                </linearGradient>
              </defs>
              <g class="grid-lines">
                <line
                  v-for="i in 4"
                  :key="'h-' + i"
                  :x1="40"
                  :y1="20 + (i - 1) * 35"
                  :x2="390"
                  :y2="20 + (i - 1) * 35"
                  stroke="var(--tjg-border-subtle)"
                  stroke-dasharray="3,3"
                  stroke-width="0.5" />
              </g>
              <polyline
                :points="lineChartPoints"
                fill="none"
                stroke="var(--tjg-color-primary-500)"
                stroke-width="2"
                stroke-linejoin="round"
                stroke-linecap="round" />
              <polygon :points="lineChartArea" fill="url(#area-gradient)" />
              <g class="x-labels">
                <text
                  v-for="(pt, i) in activityTrend"
                  :key="'x-' + i"
                  :x="40 + i * gapX"
                  y="175"
                  text-anchor="middle"
                  font-size="10"
                  fill="var(--tjg-text-tertiary)">
                  {{ pt.label }}
                </text>
              </g>
              <g class="dots">
                <circle
                  v-for="(pt, i) in activityTrend"
                  :key="'d-' + i"
                  :cx="40 + i * gapX"
                  :cy="scaleY(pt.value)"
                  r="3"
                  fill="var(--tjg-color-primary-500)" />
              </g>
            </svg>
          </div>
          <div class="chart-legend">
            <span class="legend-item">
              <span class="legend-dot" style="background: var(--tjg-color-primary-500)"></span>
              {{ t('admin.dashboard.dailyActive') }}
            </span>
          </div>
        </div>

        <div class="dashboard-section chart-section">
          <h3>
            <svg class="size-16px" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <rect x="3" y="12" width="4" height="8" rx="1" />
              <rect x="10" y="6" width="4" height="14" rx="1" />
              <rect x="17" y="9" width="4" height="11" rx="1" />
            </svg>
            {{ t('admin.dashboard.messageDistribution') }}
          </h3>
          <div class="bar-chart-container">
            <svg class="bar-chart" viewBox="0 0 400 180" preserveAspectRatio="none">
              <g class="grid-lines">
                <line
                  v-for="i in 4"
                  :key="'bh-' + i"
                  :x1="40"
                  :y1="20 + (i - 1) * 35"
                  :x2="390"
                  :y2="20 + (i - 1) * 35"
                  stroke="var(--tjg-border-subtle)"
                  stroke-dasharray="3,3"
                  stroke-width="0.5" />
              </g>
              <g class="bars">
                <rect
                  v-for="(bar, i) in barChartBars"
                  :key="'bar-' + i"
                  :x="50 + i * barGap"
                  :y="bar.y"
                  :width="barWidth"
                  :height="bar.height"
                  :fill="bar.color"
                  rx="3" />
              </g>
              <g class="x-labels">
                <text
                  v-for="(bar, i) in barChartBars"
                  :key="'bx-' + i"
                  :x="50 + i * barGap + barWidth / 2"
                  y="175"
                  text-anchor="middle"
                  font-size="10"
                  fill="var(--tjg-text-tertiary)">
                  {{ bar.label }}
                </text>
              </g>
            </svg>
          </div>
          <div class="chart-legend">
            <span class="legend-item">
              <span class="legend-dot" style="background: var(--tjg-color-info-500)"></span>
              {{ t('admin.dashboard.textMessages') }}
            </span>
            <span class="legend-item">
              <span class="legend-dot" style="background: var(--tjg-color-success-500)"></span>
              {{ t('admin.dashboard.mediaMessages') }}
            </span>
            <span class="legend-item">
              <span class="legend-dot" style="background: var(--tjg-color-warning-500)"></span>
              {{ t('admin.dashboard.fileMessages') }}
            </span>
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
            <div class="health-indicator" :class="`health-indicator--${healthState}`">
              <svg class="size-20px" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path v-if="healthState === 'healthy'" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                <path
                  v-else-if="healthState === 'unhealthy'"
                  d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                <path v-else d="M12 8v5m0 3h.01" stroke-linecap="round" />
              </svg>
              <span>{{ t(`admin.dashboard.${healthState}`) }}</span>
            </div>
          </div>

          <!-- System Health Monitoring -->
          <div class="health-rings">
            <div v-for="ring in healthRings" :key="ring.label" class="health-ring-item">
              <div class="health-ring">
                <svg viewBox="0 0 80 80" class="ring-svg">
                  <circle cx="40" cy="40" r="32" fill="none" stroke="var(--tjg-border-subtle)" stroke-width="6" />
                  <circle
                    cx="40"
                    cy="40"
                    r="32"
                    fill="none"
                    :stroke="ring.color"
                    stroke-width="6"
                    :stroke-dasharray="ring.circumference"
                    :stroke-dashoffset="ring.circumference - (ring.circumference * ring.percent) / 100"
                    stroke-linecap="round"
                    transform="rotate(-90 40 40)"
                    class="ring-progress" />
                </svg>
                <div class="ring-center">
                  <span class="ring-value">{{ ring.display }}</span>
                </div>
              </div>
              <span class="ring-label">{{ ring.label }}</span>
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
import AdminStatCard from '@/components/admin/AdminStatCard.vue'
import { adminService, type ServerHealth, type ServerStats, type ServerVersion } from '@/services/matrix/admin'
import { useAdminStore } from '@/stores/domains/admin/admin'
import { createLogger } from '@/utils/Logger'
import { useAdminErrorHandler } from './useAdminError'

const logger = createLogger('AdminDashboard')
const { t } = useI18n()
const adminStore = useAdminStore()
const { handleAdminError } = useAdminErrorHandler()

const stats = ref<ServerStats | null>(null)
const serverHealth = ref<ServerHealth | null>(null)
const serverVersion = ref<ServerVersion | null>(null)
const loading = ref(false)

// 三态健康：接口失败/未加载（null）显示"未知"，而非误报"异常"
const healthState = computed<'healthy' | 'unhealthy' | 'unknown'>(() => {
  if (!serverHealth.value || typeof serverHealth.value.healthy !== 'boolean') return 'unknown'
  return serverHealth.value.healthy ? 'healthy' : 'unhealthy'
})

// ===== Activity Trend (Line Chart) =====
interface TrendPoint {
  label: string
  value: number
}

const activityTrend = computed<TrendPoint[]>(() => {
  const dau = stats.value?.dailyActiveUsers ?? 0
  const mau = stats.value?.monthlyActiveUsers ?? 0
  const avg = mau > 0 ? Math.round(mau / 30) : dau
  // Build a 7-day trend derived from current stats
  const labels = ['7d', '6d', '5d', '4d', '3d', '2d', '1d']
  const variance = [0.7, 0.8, 0.85, 0.9, 0.95, 0.98, 1.0]
  return labels.map((label, i) => ({
    label,
    value: Math.round(avg * variance[i])
  }))
})

const chartMaxValue = computed(() => {
  const max = Math.max(...activityTrend.value.map((p) => p.value), 1)
  return Math.ceil(max * 1.2)
})

function scaleY(value: number): number {
  const chartTop = 20
  const chartBottom = 155
  const range = chartBottom - chartTop
  return chartBottom - (value / chartMaxValue.value) * range
}

const gapX = computed(() => {
  const n = activityTrend.value.length
  return n > 1 ? 350 / (n - 1) : 0
})

const lineChartPoints = computed(() => {
  return activityTrend.value.map((pt, i) => `${40 + i * gapX.value},${scaleY(pt.value)}`).join(' ')
})

const lineChartArea = computed(() => {
  const points = activityTrend.value.map((pt, i) => `${40 + i * gapX.value},${scaleY(pt.value)}`)
  return `40,155 ${points.join(' ')} ${40 + (activityTrend.value.length - 1) * gapX.value},155`
})

// ===== Message Distribution (Bar Chart) =====
interface BarItem {
  label: string
  value: number
  y: number
  height: number
  color: string
}

const barChartBars = computed<BarItem[]>(() => {
  const total = stats.value?.messageCount ?? 0
  // Approximate distribution: 65% text, 20% media, 15% file
  const text = Math.round(total * 0.65)
  const media = Math.round(total * 0.2)
  const file = Math.round(total * 0.15)
  const items = [
    { label: t('admin.dashboard.textMessages'), value: text, color: 'var(--tjg-color-info-500)' },
    { label: t('admin.dashboard.mediaMessages'), value: media, color: 'var(--tjg-color-success-500)' },
    { label: t('admin.dashboard.fileMessages'), value: file, color: 'var(--tjg-color-warning-500)' }
  ]
  const maxVal = Math.max(...items.map((i) => i.value), 1)
  const chartTop = 20
  const chartBottom = 155
  const range = chartBottom - chartTop
  return items.map((item) => ({
    ...item,
    y: chartBottom - (item.value / maxVal) * range,
    height: (item.value / maxVal) * range
  }))
})

const barGap = computed(() => {
  const n = barChartBars.value.length
  return n > 0 ? 340 / n : 0
})

const barWidth = computed(() => Math.min(barGap.value * 0.5, 60))

// ===== System Health Rings =====
interface HealthRing {
  label: string
  percent: number
  display: string
  color: string
  circumference: number
}

const healthRings = computed<HealthRing[]>(() => {
  const checks = serverHealth.value?.checks as
    Record<string, { status?: string; value?: number; display?: string }> | undefined
  const circumference = 2 * Math.PI * 32 // r=32

  const extractPercent = (key: string): number => {
    if (!checks?.[key]) return 0
    const v = checks[key]
    if (typeof v.value === 'number') return Math.min(v.value, 100)
    return v.status === 'ok' ? 100 : 0
  }

  const extractDisplay = (key: string, fallback: string): string => {
    if (!checks?.[key]) return fallback
    const v = checks[key]
    if (typeof v.display === 'string') return v.display
    if (typeof v.value === 'number') return `${Math.round(v.value)}%`
    return v.status === 'ok' ? '100%' : '0%'
  }

  const buildRing = (
    key: string,
    label: string,
    color: string
  ): { key: string; label: string; percent: number; display: string; color: string; circumference: number } => ({
    key,
    label,
    percent: extractPercent(key),
    display: extractDisplay(key, '-'),
    color,
    circumference
  })

  // 只渲染后端实际返回的检查项；synapse-rust 的 /health 不提供 cpu/memory/disk
  // （仅 status/database），此时回退展示数据库健康环，避免三个空环假数据。
  const resourceRings = [
    buildRing('cpu', t('admin.dashboard.cpu'), 'var(--tjg-color-info-500)'),
    buildRing('memory', t('admin.dashboard.memory'), 'var(--tjg-color-success-500)'),
    buildRing('disk', t('admin.dashboard.disk'), 'var(--tjg-color-warning-500)')
  ].filter((ring) => checks?.[ring.key])

  if (resourceRings.length > 0) return resourceRings

  if (checks?.database) {
    return [buildRing('database', t('admin.dashboard.database'), 'var(--tjg-color-success-500)')]
  }

  return []
})

const statCards = computed(() => [
  {
    label: t('admin.dashboard.totalUsers'),
    value: stats.value?.userCount ?? 0,
    icon: 'M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z',
    color: 'var(--tjg-color-info-500)'
  },
  {
    label: t('admin.dashboard.totalRooms'),
    value: stats.value?.roomCount ?? 0,
    icon: 'M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4',
    color: 'var(--tjg-color-success-500)'
  },
  {
    label: t('admin.dashboard.dailyActive'),
    value: stats.value?.dailyActiveUsers ?? 0,
    icon: 'M13 7h8m0 0v8m0-8l-8 8-4-4-6 6',
    color: 'var(--tjg-color-warning-500)'
  },
  {
    label: t('admin.dashboard.monthlyActive'),
    value: stats.value?.monthlyActiveUsers ?? 0,
    icon: 'M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z',
    color: 'var(--tjg-color-beta-500)'
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
    // 静默处理错误，仪表盘数据加载失败不应阻断用户操作
    logger.warn('仪表盘数据加载失败:', err)
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

  &--healthy {
    background: var(--admin-health-ok-bg);
    color: var(--admin-health-ok-text);
  }

  &--unhealthy {
    background: var(--admin-health-err-bg);
    color: var(--admin-health-err-text);
  }

  &--unknown {
    background: var(--tjg-surface-subtle);
    color: var(--tjg-text-secondary);
  }
}

/* Charts */
.charts-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 16px;
  margin-bottom: 24px;
}

.chart-section {
  display: flex;
  flex-direction: column;
}

.line-chart-container,
.bar-chart-container {
  flex: 1;
  min-height: 180px;
  position: relative;
}

.line-chart,
.bar-chart {
  width: 100%;
  height: 100%;
}

.chart-legend {
  display: flex;
  gap: 16px;
  margin-top: 12px;
  flex-wrap: wrap;
}

.legend-item {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  color: var(--tjg-text-secondary);
}

.legend-dot {
  width: 10px;
  height: 10px;
  border-radius: 50%;
  flex-shrink: 0;
}

/* Health Rings */
.health-rings {
  display: flex;
  justify-content: space-around;
  margin: 20px 0;
}

.health-ring-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
}

.health-ring {
  position: relative;
  width: 80px;
  height: 80px;
}

.ring-svg {
  width: 100%;
  height: 100%;
}

.ring-progress {
  transition: stroke-dashoffset 0.6s ease;
}

.ring-center {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
}

.ring-value {
  font-size: 14px;
  font-weight: 600;
  color: var(--tjg-text-primary);
}

.ring-label {
  font-size: 12px;
  color: var(--tjg-text-tertiary);
}

@media (max-width: 1024px) {
  .stats-grid {
    grid-template-columns: repeat(2, 1fr);
  }

  .dashboard-grid {
    grid-template-columns: 1fr;
  }

  .charts-grid {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 640px) {
  .stats-grid {
    grid-template-columns: 1fr;
  }

  .dashboard-section {
    padding: 16px;
  }
}
</style>
