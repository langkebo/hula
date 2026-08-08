<template>
  <div class="friend-details-sections">
    <!-- 分组分配区 -->
    <div class="single-details__group-section management-section">
      <div class="management-header">
        <span class="management-label">{{ t('friend.detail.group_section') }}</span>
      </div>
      <n-select
        v-model:value="selectedGroupIds"
        multiple
        :options="groupOptions"
        :placeholder="t('friend.detail.group_placeholder')"
        :loading="loadingGroups"
        :disabled="loadingGroups"
        size="small"
        @update:value="handleGroupSelectionChange" />
      <p v-if="groupLoadError" class="single-details__section-error">{{ groupLoadError }}</p>
    </div>

    <!-- 设备列表区 -->
    <div class="single-details__device-section management-section">
      <div class="management-header">
        <span class="management-label">{{ t('friend.detail.devices_section') }}</span>
        <button
          v-if="!loadingDevices && devices.length > 0"
          type="button"
          class="single-details__refresh"
          :aria-label="t('friend.detail.devices_section')"
          @click="loadDevices">
          <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
            <path d="M4 12a8 8 0 0 1 13.66-5.66L20 8M20 4v4h-4" stroke-linecap="round" stroke-linejoin="round" />
            <path d="M20 12a8 8 0 0 1-13.66 5.66L4 16M4 20v-4h4" stroke-linecap="round" stroke-linejoin="round" />
          </svg>
        </button>
      </div>

      <p v-if="loadingDevices" class="single-details__section-hint">{{ t('friend.detail.devices_loading') }}</p>
      <p v-else-if="deviceError" class="single-details__section-error">{{ deviceError }}</p>
      <p v-else-if="devices.length === 0" class="single-details__section-hint">
        {{ t('friend.detail.devices_empty') }}
      </p>

      <ul v-else class="single-details__device-list">
        <li v-for="device in devices" :key="device.device_id" class="single-details__device-item">
          <div class="single-details__device-info">
            <span class="single-details__device-name">
              {{ device.display_name || t('friend.detail.device_unknown') }}
            </span>
            <span class="single-details__device-meta">
              {{ t('friend.detail.device_last_seen') }}：{{ formatDeviceLastSeen(device.last_seen_ts) }}
            </span>
          </div>
          <span
            class="single-details__device-verified"
            :class="device.verified ? 'single-details__device-verified--ok' : 'single-details__device-verified--warn'">
            {{ device.verified ? t('friend.detail.device_verified') : t('friend.detail.device_unverified') }}
          </span>
        </li>
      </ul>
    </div>

    <!-- 联邦/服务器信息区 -->
    <div class="single-details__federation-section management-section">
      <div class="management-header">
        <span class="management-label">{{ t('friend.detail.federation_section') }}</span>
      </div>
      <div class="single-details__federation-row">
        <span class="single-details__federation-label">{{ t('friend.detail.server_address') }}</span>
        <span class="single-details__federation-value">{{ serverName || '-' }}</span>
      </div>
      <div class="single-details__federation-row">
        <span class="single-details__federation-label">{{ t('friend.detail.federated_user') }}</span>
        <span
          class="single-details__federation-badge"
          :class="isFederatedUser ? 'single-details__federation-badge--warn' : 'single-details__federation-badge--ok'">
          {{ isFederatedUser ? t('friend.detail.federated_user') : t('friend.detail.local_user') }}
        </span>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useActionFeedback } from '@/composables/common/useActionFeedback'
import type { FriendGroup } from '@/services/matrix/friends/MatrixFriendService'
import { matrixFriendService } from '@/services/matrix/friends/MatrixFriendService'
import matrixClientService from '@/services/matrix/MatrixClientService'
import type { Device } from '@/services/matrix/user/MatrixDeviceService'
import { matrixDeviceService } from '@/services/matrix/user/MatrixDeviceService'
import { createLogger } from '@/utils/Logger'

const logger = createLogger('FriendDetailsSections')
const { t } = useI18n()
const { showFeedback } = useActionFeedback()

const props = defineProps({
  userId: {
    type: String,
    required: true
  }
})

// ==================== 通用工具 ====================

const formatDate = (ts: number): string => {
  const date = new Date(ts)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffMins = Math.floor(diffMs / 60000)
  const diffHours = Math.floor(diffMs / 3600000)
  const diffDays = Math.floor(diffMs / 86400000)

  if (diffMins < 1) return t('friend.detail.just_now')
  if (diffMins < 60) return t('friend.detail.minutes_ago', { count: diffMins })
  if (diffHours < 24) return t('friend.detail.hours_ago', { count: diffHours })
  if (diffDays < 7) return t('friend.detail.days_ago', { count: diffDays })
  return date.toLocaleDateString()
}

// ==================== 分组分配区 ====================

const availableGroups = ref<FriendGroup[]>([])
const selectedGroupIds = ref<string[]>([])
const currentGroupIds = ref<string[]>([])
const loadingGroups = ref(false)
const groupLoadError = ref('')

const groupOptions = computed(() => availableGroups.value.map((g) => ({ label: g.name, value: g.group_id })))

const loadGroups = async () => {
  if (!props.userId) return
  loadingGroups.value = true
  groupLoadError.value = ''
  try {
    const [all, assigned] = await Promise.all([
      matrixFriendService.getFriendGroups(),
      matrixFriendService.getFriendGroupsByUser(props.userId)
    ])
    availableGroups.value = all
    const assignedIds = assigned.map((g) => g.group_id)
    currentGroupIds.value = assignedIds
    selectedGroupIds.value = [...assignedIds]
  } catch (err) {
    logger.error('加载好友分组失败', err)
    groupLoadError.value = t('friend.detail.group_load_error')
  } finally {
    loadingGroups.value = false
  }
}

const handleGroupSelectionChange = async (next: string[]) => {
  if (!props.userId) return
  const prev = currentGroupIds.value
  const toAdd = next.filter((id) => !prev.includes(id))
  const toRemove = prev.filter((id) => !next.includes(id))
  // 乐观更新当前引用，避免 NSelect 抖动
  currentGroupIds.value = [...next]

  let hasFailure = false
  for (const groupId of toAdd) {
    try {
      await matrixFriendService.addFriendToGroup(groupId, props.userId)
      showFeedback(t('friend.detail.group_assign_success'), 'success', 'polite')
    } catch (err) {
      hasFailure = true
      logger.error('分配分组失败', err)
      showFeedback(t('friend.detail.group_assign_error'), 'error', 'assertive')
    }
  }
  for (const groupId of toRemove) {
    try {
      await matrixFriendService.removeFriendFromGroup(groupId, props.userId)
      showFeedback(t('friend.detail.group_remove_success'), 'success', 'polite')
    } catch (err) {
      hasFailure = true
      logger.error('移出分组失败', err)
      showFeedback(t('friend.detail.group_remove_error'), 'error', 'assertive')
    }
  }

  // 任一操作失败时回滚乐观更新，保持 UI 与服务端一致
  if (hasFailure) {
    currentGroupIds.value = prev
    selectedGroupIds.value = [...prev]
  }
}

// ==================== 设备列表区 ====================

const devices = ref<Device[]>([])
const loadingDevices = ref(false)
const deviceError = ref('')

const formatDeviceLastSeen = (ts?: number): string => {
  if (!ts || ts <= 0) return '-'
  return formatDate(ts)
}

const loadDevices = async () => {
  if (!props.userId) return
  loadingDevices.value = true
  deviceError.value = ''
  devices.value = []
  try {
    devices.value = await matrixDeviceService.getUserDevices(props.userId)
  } catch (err) {
    logger.error('加载设备列表失败', err)
    deviceError.value = t('friend.detail.devices_load_error')
  } finally {
    loadingDevices.value = false
  }
}

// ==================== 联邦/服务器信息区 ====================

/**
 * 从 Matrix user ID `@localpart:server.name` 中解析出 server name。
 * 输入不符合 MXID 规范时返回空字符串。
 */
const parseServerName = (userId: string): string => {
  const colonIdx = userId.indexOf(':')
  if (colonIdx <= 0 || colonIdx === userId.length - 1) return ''
  return userId.slice(colonIdx + 1)
}

const localDomain = computed<string>(() => matrixClientService.getServerDomain())

const serverName = computed(() => parseServerName(props.userId))
const isFederatedUser = computed(() => {
  const server = serverName.value
  if (!server || !localDomain.value) return false
  return server !== localDomain.value
})

// ==================== 联动加载 ====================

watch(
  () => props.userId,
  (uid) => {
    if (!uid) return
    void loadGroups()
    void loadDevices()
  },
  { immediate: true }
)
</script>

<style scoped lang="scss">
.friend-details-sections {
  width: 100%;
  display: flex;
  flex-direction: column;
  gap: 16px;
  padding: 0 8px;
  box-sizing: border-box;
}

.management-section {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 12px;
  background: var(--tjg-surface-panel-muted);
  border-radius: 8px;
}

.management-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}

.management-label {
  font-size: 13px;
  color: var(--tjg-text-secondary);
  font-weight: 500;
}

.single-details__refresh {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 20px;
  height: 20px;
  padding: 0;
  border: none;
  background: transparent;
  color: var(--tjg-text-tertiary);
  cursor: pointer;
  border-radius: 4px;
  transition: color var(--tjg-motion-duration-fast) var(--tjg-motion-ease-standard);

  &:hover {
    color: var(--tjg-text-secondary);
  }

  svg {
    width: 14px;
    height: 14px;
  }
}

.single-details__section-hint,
.single-details__section-error {
  margin: 0;
  font-size: 12px;
  line-height: 18px;
}

.single-details__section-hint {
  color: var(--tjg-text-tertiary);
}

.single-details__section-error {
  color: var(--tjg-color-danger-500);
}

.single-details__device-list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.single-details__device-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  padding: 6px 8px;
  background: var(--tjg-surface-input);
  border-radius: 6px;
}

.single-details__device-info {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
}

.single-details__device-name {
  font-size: 13px;
  color: var(--tjg-text-primary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.single-details__device-meta {
  font-size: 11px;
  color: var(--tjg-text-tertiary);
}

.single-details__device-verified {
  flex-shrink: 0;
  display: inline-flex;
  align-items: center;
  padding: 2px 8px;
  font-size: 11px;
  border-radius: var(--tjg-radius-full);
  border: 1px solid transparent;
}

.single-details__device-verified--ok {
  color: var(--tjg-color-success-600);
  background: var(--tjg-color-success-100);
  border-color: var(--tjg-color-success-100);
}

.single-details__device-verified--warn {
  color: var(--tjg-color-warning-600);
  background: var(--tjg-color-warning-100);
  border-color: var(--tjg-color-warning-100);
}

.single-details__federation-badge {
  flex-shrink: 0;
  display: inline-flex;
  align-items: center;
  padding: 2px 8px;
  font-size: 11px;
  border-radius: var(--tjg-radius-full);
  border: 1px solid transparent;
}

.single-details__federation-badge--ok {
  color: var(--tjg-color-success-600);
  background: var(--tjg-color-success-100);
  border-color: var(--tjg-color-success-100);
}

.single-details__federation-badge--warn {
  color: var(--tjg-color-warning-600);
  background: var(--tjg-color-warning-100);
  border-color: var(--tjg-color-warning-100);
}

.single-details__federation-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  font-size: 13px;
}

.single-details__federation-label {
  color: var(--tjg-text-secondary);
}

.single-details__federation-value {
  color: var(--tjg-text-primary);
  word-break: break-all;
  text-align: right;
}
</style>
