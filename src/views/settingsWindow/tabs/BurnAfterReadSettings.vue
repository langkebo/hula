<template>
  <div class="burn-after-read-settings">
    <div class="settings-section">
      <h3 class="section-title">全局设置</h3>
      <div class="setting-item">
        <div class="setting-info">
          <span class="setting-label">全局默认开启阅后即焚</span>
          <span class="setting-desc">新私聊默认开启阅后即焚功能</span>
        </div>
        <n-switch v-model:value="globalBurnEnabled" @update:value="handleGlobalBurnToggle" />
      </div>

      <div class="setting-item">
        <div class="setting-info">
          <span class="setting-label">默认焚毁时间</span>
          <span class="setting-desc">消息阅后的默认焚毁倒计时</span>
        </div>
        <n-select
          v-model:value="globalBurnDuration"
          :options="burnDurationOptions"
          style="width: 130px"
          @update:value="handleBurnDurationChange" />
      </div>

      <div class="setting-item">
        <div class="setting-info">
          <span class="setting-label">已读消息自动开始倒计时</span>
          <span class="setting-desc">消息被标记为已读后自动启动焚毁倒计时</span>
        </div>
        <n-switch v-model:value="autoBurnRead" @update:value="handleToggle('autoBurnRead')" />
      </div>

      <div class="setting-item">
        <div class="setting-info">
          <span class="setting-label">消息即将焚毁时通知</span>
          <span class="setting-desc">消息焚毁前发送通知提醒</span>
        </div>
        <n-switch v-model:value="burnNotification" @update:value="handleToggle('burnNotification')" />
      </div>

      <div class="setting-item">
        <div class="setting-info">
          <span class="setting-label">显示焚毁倒计时</span>
          <span class="setting-desc">在消息上显示焚毁倒计时进度</span>
        </div>
        <n-switch v-model:value="showBurnCountdown" @update:value="handleToggle('showBurnCountdown')" />
      </div>

      <div class="setting-item">
        <div class="setting-info">
          <span class="setting-label">消息焚毁时播放音效</span>
          <span class="setting-desc">消息焚毁完成时播放提示音</span>
        </div>
        <n-switch v-model:value="burnSound" @update:value="handleToggle('burnSound')" />
      </div>
    </div>

    <n-divider />

    <div class="settings-section">
      <h3 class="section-title">房间级别设置</h3>
      <n-spin :show="loadingRooms">
        <div v-if="burnRooms.length === 0" class="empty-list">
          <span class="empty-text">暂无开启阅后即焚的私聊</span>
        </div>
        <div v-else class="room-list">
          <div v-for="room in burnRooms" :key="room.roomId" class="room-item">
            <div class="room-info">
              <span class="room-name">{{ room.name || room.roomId }}</span>
              <div class="room-burn-status">
                <n-tag v-if="room.burnEnabled" type="success" size="small">已开启</n-tag>
                <n-tag v-else type="default" size="small">已关闭</n-tag>
                <span v-if="room.burnEnabled" class="room-duration">
                  焚毁时间: {{ formatDuration(room.burnDuration || globalBurnDuration) }}
                </span>
              </div>
            </div>
            <div class="room-actions">
              <n-button v-if="room.burnEnabled" size="small" @click="handleEditRoomBurn(room)">修改</n-button>
              <n-button v-if="room.burnEnabled" size="small" type="warning" @click="handleDisableRoomBurn(room)">关闭</n-button>
              <n-button v-if="!room.burnEnabled" size="small" type="primary" @click="handleEnableRoomBurn(room)">开启</n-button>
            </div>
          </div>
        </div>
      </n-spin>
    </div>

    <n-divider />

    <div class="settings-section">
      <h3 class="section-title">焚毁统计</h3>
      <n-spin :show="loadingStats">
        <div class="stats-grid">
          <div class="stat-card">
            <span class="stat-value">{{ burnStats.totalBurned }}</span>
            <span class="stat-label">总焚毁消息</span>
          </div>
          <div class="stat-card">
            <span class="stat-value">{{ burnStats.totalPending }}</span>
            <span class="stat-label">待焚毁消息</span>
          </div>
          <div class="stat-card">
            <span class="stat-value">{{ burnStats.roomsWithBurnEnabled }}</span>
            <span class="stat-label">开启房间数</span>
          </div>
        </div>
      </n-spin>
    </div>

    <n-divider />

    <div class="settings-section">
      <n-alert type="warning" :show-icon="true">
        阅后即焚不能保证对方未截图或保存消息。服务器会在消息到期后删除，但无法控制客户端行为。
      </n-alert>
    </div>

    <n-modal v-model:show="showEditRoom" preset="dialog" title="修改房间焚毁时间" positive-text="保存" negative-text="取消" @positive-click="handleSaveRoomBurn">
      <n-form>
        <n-form-item label="焚毁时间">
          <n-select v-model:value="editRoomDuration" :options="burnDurationOptions" style="width: 100%" />
        </n-form-item>
      </n-form>
    </n-modal>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted } from 'vue'
import {
  NSwitch,
  NDivider,
  NSelect,
  NButton,
  NSpin,
  NTag,
  NModal,
  NForm,
  NFormItem,
  NAlert,
  useMessage,
  useDialog
} from 'naive-ui'
import { matrixBurnAfterReadService } from '@/services/matrix'
import { createLogger } from '@/utils/Logger'

const logger = createLogger('BurnAfterReadSettings')

defineOptions({
  name: 'BurnAfterReadSettings'
})

const message = useMessage()
const dialog = useDialog()

const globalBurnEnabled = ref(false)
const globalBurnDuration = ref(60)
const autoBurnRead = ref(true)
const burnNotification = ref(true)
const showBurnCountdown = ref(true)
const burnSound = ref(false)

const loadingRooms = ref(false)
const loadingStats = ref(false)

interface BurnRoom {
  roomId: string
  name: string
  burnEnabled: boolean
  burnDuration: number
}

const burnRooms = ref<BurnRoom[]>([])

const burnStats = reactive({
  totalBurned: 0,
  totalPending: 0,
  roomsWithBurnEnabled: 0
})

const showEditRoom = ref(false)
const editRoomId = ref('')
const editRoomDuration = ref(60)

const burnDurationOptions = [
  { label: '30秒', value: 30 },
  { label: '1分钟', value: 60 },
  { label: '5分钟', value: 300 },
  { label: '1小时', value: 3600 },
  { label: '24小时', value: 86400 }
]

const STORAGE_KEY = 'hula-burn-after-read-settings'

onMounted(() => {
  loadSettings()
  loadBurnStats()
})

function loadSettings() {
  const saved = localStorage.getItem(STORAGE_KEY)
  if (saved) {
    try {
      const data = JSON.parse(saved)
      if (data.globalBurnEnabled !== undefined) globalBurnEnabled.value = data.globalBurnEnabled
      if (data.globalBurnDuration !== undefined) globalBurnDuration.value = data.globalBurnDuration
      if (data.autoBurnRead !== undefined) autoBurnRead.value = data.autoBurnRead
      if (data.burnNotification !== undefined) burnNotification.value = data.burnNotification
      if (data.showBurnCountdown !== undefined) showBurnCountdown.value = data.showBurnCountdown
      if (data.burnSound !== undefined) burnSound.value = data.burnSound
      if (data.burnRooms) burnRooms.value = data.burnRooms
    } catch {
      // ignore
    }
  }
}

function saveSettings() {
  localStorage.setItem(
    STORAGE_KEY,
    JSON.stringify({
      globalBurnEnabled: globalBurnEnabled.value,
      globalBurnDuration: globalBurnDuration.value,
      autoBurnRead: autoBurnRead.value,
      burnNotification: burnNotification.value,
      showBurnCountdown: showBurnCountdown.value,
      burnSound: burnSound.value,
      burnRooms: burnRooms.value
    })
  )
}

async function loadBurnStats() {
  loadingStats.value = true
  try {
    const stats = await matrixBurnAfterReadService.getBurnStats()
    if (stats) {
      burnStats.totalBurned = stats.totalBurned || 0
      burnStats.totalPending = stats.totalPending || 0
      burnStats.roomsWithBurnEnabled = stats.roomsWithBurnEnabled || 0
    }
  } catch {
    logger.error('Failed to load burn stats')
  } finally {
    loadingStats.value = false
  }
}

function formatDuration(seconds: number): string {
  if (seconds < 60) return `${seconds}秒`
  if (seconds < 3600) return `${Math.floor(seconds / 60)}分钟`
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}小时`
  return `${Math.floor(seconds / 86400)}天`
}

async function handleGlobalBurnToggle(value: boolean) {
  if (value) {
    dialog.warning({
      title: '开启阅后即焚',
      content: '全局开启后，新私聊将默认启用阅后即焚。阅后即焚不能保证对方未截图或保存消息。',
      positiveText: '确定开启',
      negativeText: '取消',
      onPositiveClick: () => {
        globalBurnEnabled.value = true
        saveSettings()
        message.success('已全局开启阅后即焚')
      },
      onNegativeClick: () => {
        globalBurnEnabled.value = false
      }
    })
  } else {
    globalBurnEnabled.value = false
    saveSettings()
    message.info('已全局关闭阅后即焚')
  }
}

function handleBurnDurationChange(value: number) {
  globalBurnDuration.value = value
  saveSettings()
  message.success(`默认焚毁时间已设置为${formatDuration(value)}`)
}

function handleToggle(_key: string) {
  saveSettings()
  message.success('设置已更新')
}

function handleEditRoomBurn(room: BurnRoom) {
  editRoomId.value = room.roomId
  editRoomDuration.value = room.burnDuration || globalBurnDuration.value
  showEditRoom.value = true
}

async function handleSaveRoomBurn() {
  try {
    await matrixBurnAfterReadService.enableBurn(editRoomId.value, editRoomDuration.value * 1000)
    const room = burnRooms.value.find((r) => r.roomId === editRoomId.value)
    if (room) {
      room.burnDuration = editRoomDuration.value
    }
    saveSettings()
    showEditRoom.value = false
    message.success('房间焚毁时间已更新')
    await loadBurnStats()
  } catch {
    message.error('更新房间焚毁时间失败')
  }
}

async function handleEnableRoomBurn(room: BurnRoom) {
  try {
    await matrixBurnAfterReadService.enableBurn(room.roomId, globalBurnDuration.value * 1000)
    room.burnEnabled = true
    room.burnDuration = globalBurnDuration.value
    saveSettings()
    message.success('已开启房间阅后即焚')
    await loadBurnStats()
  } catch {
    message.error('开启房间阅后即焚失败')
  }
}

async function handleDisableRoomBurn(room: BurnRoom) {
  try {
    await matrixBurnAfterReadService.disableBurn(room.roomId)
    room.burnEnabled = false
    saveSettings()
    message.success('已关闭房间阅后即焚')
    await loadBurnStats()
  } catch {
    message.error('关闭房间阅后即焚失败')
  }
}
</script>

<style scoped>
.burn-after-read-settings {
  padding: 0 8px;
}

.settings-section {
  margin-bottom: 16px;
}

.section-title {
  font-size: 16px;
  font-weight: 500;
  margin-bottom: 12px;
}

.setting-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 0;
  border-bottom: 1px solid rgba(0, 0, 0, 0.05);
}

:deep(.dark) .setting-item {
  border-bottom-color: rgba(255, 255, 255, 0.05);
}

.setting-info {
  display: flex;
  flex-direction: column;
}

.setting-label {
  font-size: 14px;
}

.setting-desc {
  font-size: 12px;
  color: var(--color-text-quaternary);
  margin-top: 4px;
}

.room-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.room-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 12px;
  background-color: rgba(0, 0, 0, 0.02);
  border-radius: 6px;
}

:deep(.dark) .room-item {
  background-color: rgba(255, 255, 255, 0.05);
}

.room-info {
  display: flex;
  flex-direction: column;
  min-width: 0;
  flex: 1;
}

.room-name {
  font-size: 14px;
  font-weight: 500;
  word-break: break-all;
}

.room-burn-status {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-top: 4px;
}

.room-duration {
  font-size: 12px;
  color: var(--color-text-secondary);
}

:deep(.dark) .room-duration {
  color: #aaa;
}

.room-actions {
  display: flex;
  gap: 4px;
  flex-shrink: 0;
  margin-left: 12px;
}

.stats-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 12px;
}

.stat-card {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 16px;
  background-color: rgba(0, 0, 0, 0.02);
  border-radius: 8px;
}

:deep(.dark) .stat-card {
  background-color: rgba(255, 255, 255, 0.05);
}

.stat-value {
  font-size: 24px;
  font-weight: 600;
  color: var(--text-color, #1a1a1a);
}

:deep(.dark) .stat-value {
  color: #fff;
}

.stat-label {
  font-size: 12px;
  color: var(--color-text-quaternary);
  margin-top: 4px;
}

.empty-list {
  padding: 16px;
  text-align: center;
}

.empty-text {
  font-size: 13px;
  color: var(--color-text-quaternary);
}
</style>
