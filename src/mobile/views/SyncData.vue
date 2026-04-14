<template>
  <MobileLayout class="bg-gray-100 px-20px" :safeAreaTop="true" :safeAreaBottom="true">
    <HeaderBar
      :isOfficial="false"
      :hidden-right="true"
      :enable-default-background="false"
      :enable-shadow="false"
      room-name="同步状态" />

    <div class="flex flex-col gap-20px mt-20px">
      <!-- 同步状态卡片 -->
      <div class="bg-white rounded-15px p-20px">
        <div class="flex items-center justify-between mb-15px">
          <div class="flex items-center gap-10px">
            <van-icon :name="statusIcon" :size="24" :color="statusColor" />
            <span class="text-16px font-medium">{{ statusText }}</span>
          </div>
          <van-button
            v-if="status === 'error'"
            size="small"
            type="primary"
            @click="handleRetry"
          >
            重试
          </van-button>
        </div>

        <!-- 同步进度条 -->
        <div v-if="status === 'syncing'" class="mb-15px">
          <van-progress :percentage="Math.floor(progress)" stroke-width="6" />
          <div class="flex justify-between mt-8px text-12px text-gray-500">
            <span>同步中...</span>
            <span>{{ syncedRooms }}/{{ totalRooms }} 房间</span>
          </div>
        </div>

        <!-- 错误信息 -->
        <div v-if="errorMessage" class="text-12px text-red-500 bg-red-50 p-10px rounded-8px mb-10px">
          {{ errorMessage }}
        </div>

        <!-- 同步信息列表 -->
        <van-cell-group inset>
          <van-cell title="最后同步时间" :value="lastSyncTimeFormatted" />
          <van-cell title="同步 Token" :value="syncToken || '无'" value-class="text-11px" />
          <van-cell title="房间数量" :value="totalRooms" />
          <van-cell title="已同步房间" :value="syncedRooms" />
        </van-cell-group>
      </div>

      <!-- 操作按钮组 -->
      <div class="flex flex-col gap-12px">
        <van-button
          :loading="status === 'syncing'"
          color="#487D68"
          block
          @click="handleManualSync"
        >
          手动同步
        </van-button>

        <van-button plain block @click="handleClearCache">
          清理缓存
        </van-button>

        <van-button plain block type="danger" @click="handleClearToken">
          重置同步 Token
        </van-button>
      </div>
    </div>
  </MobileLayout>
</template>

<script setup lang="ts">
import { computed, onMounted } from 'vue'
import { showToast } from 'vant'
import MobileLayout from '@/mobile/components/MobileLayout.vue'
import HeaderBar from '@/mobile/components/HeaderBar.vue'
import { useSyncMonitor } from '@/composables/useSyncMonitor'
import { createLogger } from '@/utils/Logger'

const logger = createLogger('SyncDataPage')

const {
  status,
  progress,
  syncedRooms,
  totalRooms,
  lastSyncTime,
  syncToken,
  errorMessage,
  manualSync,
  clearCache,
  clearSyncToken,
  updateSyncState
} = useSyncMonitor()

const statusIcon = computed(() => {
  switch (status.value) {
    case 'syncing':
      return 'replay'
    case 'error':
      return 'warning-o'
    case 'catchup':
      return 'success'
    default:
      return 'clock-o'
  }
})

const statusColor = computed(() => {
  switch (status.value) {
    case 'syncing':
      return '#487D68'
    case 'error':
      return '#ee0a24'
    case 'catchup':
      return '#07c160'
    default:
      return '#969799'
  }
})

const statusText = computed(() => {
  switch (status.value) {
    case 'syncing':
      return '同步中'
    case 'error':
      return '同步失败'
    case 'catchup':
      return '已同步'
    default:
      return '空闲'
  }
})

const lastSyncTimeFormatted = computed(() => {
  if (!lastSyncTime.value) return '从未同步'
  return lastSyncTime.value.toLocaleString()
})

const handleManualSync = async () => {
  try {
    await manualSync()
    showToast('同步完成')
  } catch (err) {
    showToast('同步失败')
    logger.error('手动同步失败:', err)
  }
}

const handleClearCache = async () => {
  try {
    await clearCache()
    showToast('缓存已清理')
  } catch (err) {
    showToast('清理失败')
    logger.error('清理缓存失败:', err)
  }
}

const handleClearToken = () => {
  clearSyncToken()
  showToast('Token 已重置')
  updateSyncState()
}

const handleRetry = () => {
  handleManualSync()
}

onMounted(() => {
  updateSyncState()
})
</script>

<style lang="scss" scoped>
:deep(.van-cell__value) {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
</style>
