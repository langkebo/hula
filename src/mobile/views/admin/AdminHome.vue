<template>
  <mobile-layout :title="t('admin.title')">
    <div class="mobile-admin">
      <!-- 管理功能列表 -->
      <van-cell-group :title="t('admin.management')">
        <van-cell :title="t('admin.users')" icon="friends-o" is-link @click="handleNavigate('users')">
          <template #value>
            <van-tag type="primary">{{ userCount }}</van-tag>
          </template>
        </van-cell>
        <van-cell :title="t('admin.rooms')" icon="chat-o" is-link @click="handleNavigate('rooms')">
          <template #value>
            <van-tag type="success">{{ roomCount }}</van-tag>
          </template>
        </van-cell>
        <van-cell :title="t('admin.federation')" icon="exchange" is-link @click="handleNavigate('federation')" />
        <van-cell :title="t('admin.notices')" icon="volume-o" is-link @click="handleNavigate('notices')" />
        <van-cell :title="t('admin.audit')" icon="records" is-link @click="handleNavigate('audit')" />
        <van-cell :title="t('admin.retention')" icon="clock-o" is-link @click="handleNavigate('retention')" />
        <van-cell
          :title="t('admin.registration_tokens')"
          icon="peer-pay"
          is-link
          @click="handleNavigate('registration-tokens')" />
        <van-cell :title="t('admin.maintenance')" icon="setting" is-link @click="handleNavigate('maintenance')" />
        <van-cell :title="t('admin.saml.title')" icon="lock" is-link @click="handleNavigate('saml')" />
        <van-cell :title="t('admin.security.title')" icon="shield-o" is-link @click="handleNavigate('security')" />
        <van-cell :title="t('admin.logs.title')" icon="records" is-link @click="handleNavigate('server-logs')" />
        <van-cell :title="t('admin.moderation')" icon="shield-o" is-link @click="handleNavigate('moderation')">
          <template #value>
            <van-tag v-if="reportCount > 0" type="danger">{{ reportCount }}</van-tag>
          </template>
        </van-cell>
      </van-cell-group>

      <!-- 快速操作 -->
      <van-cell-group :title="t('admin.quick_actions')">
        <van-cell :title="t('admin.server_stats')" icon="bar-chart-o" is-link @click="showStatsDialog = true" />
        <van-cell :title="t('admin.settings')" icon="setting-o" is-link @click="handleNavigate('settings')" />
      </van-cell-group>

      <!-- 服务器统计对话框 -->
      <van-popup v-model:show="showStatsDialog" position="bottom" :style="{ height: '60%' }">
        <div class="stats-dialog">
          <div class="stats-header">
            <h3>{{ t('admin.server_stats') }}</h3>
            <van-icon name="cross" @click="showStatsDialog = false" />
          </div>
          <van-divider />
          <div class="stats-content">
            <div class="stat-item">
              <div class="stat-label">{{ t('admin.total_users') }}</div>
              <div class="stat-value">{{ userCount }}</div>
            </div>
            <div class="stat-item">
              <div class="stat-label">{{ t('admin.total_rooms') }}</div>
              <div class="stat-value">{{ roomCount }}</div>
            </div>
            <div class="stat-item">
              <div class="stat-label">{{ t('admin.active_users') }}</div>
              <div class="stat-value">{{ activeUserCount }}</div>
            </div>
            <div class="stat-item">
              <div class="stat-label">{{ t('admin.pending_reports') }}</div>
              <div class="stat-value">{{ reportCount }}</div>
            </div>
          </div>
        </div>
      </van-popup>
    </div>
  </mobile-layout>
</template>

<script setup lang="ts">
import { showToast } from 'vant'
import { onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'
import MobileLayout from '@/mobile/layout/index.vue'
import { adminService, type ServerStats } from '@/services/matrix'
import { createLogger } from '@/utils/Logger'

const logger = createLogger('MobileAdmin')
const { t } = useI18n()
const router = useRouter()

const userCount = ref(0)
const roomCount = ref(0)
const activeUserCount = ref(0)
const reportCount = ref(0)
const showStatsDialog = ref(false)

const loadStats = async () => {
  try {
    const stats = await adminService.getServerStats()
    userCount.value = stats.userCount
    roomCount.value = stats.roomCount
    activeUserCount.value = stats.dailyActiveUsers
  } catch (error) {
    logger.error('[MobileAdmin] 加载统计失败:', error)
    showToast(t('admin.load_failed'))
  }
}

const handleNavigate = (page: string) => {
  router.push(`/mobile/admin/${page}`)
}

onMounted(() => {
  loadStats()
})
</script>

<style scoped lang="scss">
.mobile-admin {
  padding: 12px 0;

  .van-cell-group {
    margin-bottom: 12px;
  }
}

.stats-dialog {
  padding: 16px;

  .stats-header {
    display: flex;
    align-items: center;
    justify-content: space-between;

    h3 {
      margin: 0;
      font-size: 18px;
      font-weight: 600;
    }

    .van-icon {
      font-size: 20px;
      cursor: pointer;
    }
  }

  .stats-content {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: 16px;
    padding: 16px 0;

    .stat-item {
      text-align: center;
      padding: 16px;
      background: var(--van-background-2);
      border-radius: 8px;

      .stat-label {
        font-size: 13px;
        color: var(--van-text-color-2);
        margin-bottom: 8px;
      }

      .stat-value {
        font-size: 24px;
        font-weight: 600;
        color: var(--van-primary-color);
      }
    }
  }
}
</style>
