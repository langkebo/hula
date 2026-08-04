<template>
  <n-modal
    v-model:show="visible"
    preset="card"
    :title="t('encryption.device_trust.title')"
    :bordered="false"
    :closable="true"
    :mask-closable="false"
    class="device-trust-manager"
    style="width: 700px; max-width: 90vw">
    <n-spin :show="loading">
      <n-tabs v-model:value="activeTab" type="line">
        <!-- Device List Tab -->
        <n-tab-pane name="devices" :tab="t('encryption.device_trust.device_list_tab')">
          <div v-if="devices.length === 0 && !loading" class="empty-state">
            <n-empty :description="t('encryption.device_trust.no_devices')" />
          </div>
          <div v-else class="device-list">
            <div v-for="device in devices" :key="device.deviceId" class="device-item">
              <div class="device-info">
                <div class="device-icon">
                  <Icon
                    :icon="device.deviceId === currentDeviceId ? 'mdi:cellphone-check' : 'mdi:cellphone'"
                    :width="24" />
                </div>
                <div class="device-text">
                  <div class="device-name">
                    {{ device.displayName || t('encryption.device_trust.unnamed_device') }}
                    <n-tag v-if="device.deviceId === currentDeviceId" size="small" type="info" class="ml-8px">
                      {{ t('encryption.device_trust.current_device') }}
                    </n-tag>
                  </div>
                  <div class="device-id">{{ device.deviceId }}</div>
                  <div class="device-meta">
                    <span v-if="device.lastSeenIp">
                      <Icon icon="mdi:ip-network" :width="14" class="mr-4px" />
                      {{ device.lastSeenIp }}
                    </span>
                    <span v-if="device.lastSeenTs" class="ml-12px">
                      <Icon icon="mdi:clock-outline" :width="14" class="mr-4px" />
                      {{ formatTimestamp(device.lastSeenTs) }}
                    </span>
                  </div>
                </div>
              </div>
              <div class="device-actions">
                <n-tag :type="getTrustTagType(device)" size="small" class="mr-8px">
                  {{ getTrustLabel(device) }}
                </n-tag>
                <n-space size="small">
                  <n-button
                    v-if="!device.isVerified"
                    size="small"
                    type="primary"
                    ghost
                    :loading="actionLoading === `trust-${device.deviceId}`"
                    @click="handleTrustDevice(device)">
                    {{ t('encryption.device_trust.trust') }}
                  </n-button>
                  <n-popconfirm v-if="device.isVerified" @positive-click="handleUntrustDevice(device)">
                    <template #trigger>
                      <n-button size="small" :loading="actionLoading === `untrust-${device.deviceId}`">
                        {{ t('encryption.device_trust.untrust') }}
                      </n-button>
                    </template>
                    {{ t('encryption.device_trust.untrust_confirm') }}
                  </n-popconfirm>
                  <n-button
                    v-if="!device.isVerified"
                    size="small"
                    type="primary"
                    ghost
                    @click="handleVerifyDevice(device)">
                    {{ t('encryption.device_trust.verify') }}
                  </n-button>
                  <n-popconfirm v-if="!device.isBlocked" @positive-click="handleBlockDevice(device)">
                    <template #trigger>
                      <n-button
                        size="small"
                        type="warning"
                        ghost
                        :loading="actionLoading === `block-${device.deviceId}`">
                        {{ t('encryption.device_trust.block') }}
                      </n-button>
                    </template>
                    {{ t('encryption.device_trust.block_confirm') }}
                  </n-popconfirm>
                  <n-button
                    v-if="device.isBlocked"
                    size="small"
                    type="success"
                    ghost
                    :loading="actionLoading === `unblock-${device.deviceId}`"
                    @click="handleUnblockDevice(device)">
                    {{ t('encryption.device_trust.unblock') }}
                  </n-button>
                </n-space>
              </div>
            </div>
          </div>
        </n-tab-pane>

        <!-- Unverified Devices in Room Tab -->
        <n-tab-pane name="unverified" :tab="t('encryption.device_trust.unverified_tab')">
          <div class="room-selector-section">
            <div class="selector-label">{{ t('encryption.device_trust.select_room') }}</div>
            <n-select
              v-model:value="selectedRoomId"
              :options="roomOptions"
              :placeholder="t('encryption.device_trust.select_room_placeholder')"
              filterable
              clearable
              @update:value="handleRoomSelect" />
          </div>

          <div v-if="selectedRoomId" class="unverified-section">
            <div v-if="unverifiedDevices.length === 0 && !loading" class="empty-state">
              <n-empty :description="t('encryption.device_trust.no_unverified_devices')" />
            </div>
            <div v-else class="device-list">
              <div v-for="device in unverifiedDevices" :key="`${device.userId}-${device.deviceId}`" class="device-item">
                <div class="device-info">
                  <div class="device-icon">
                    <Icon icon="mdi:shield-alert" :width="24" />
                  </div>
                  <div class="device-text">
                    <div class="device-name">{{ device.displayName || device.deviceId }}</div>
                    <div class="device-id">{{ device.userId }} / {{ device.deviceId }}</div>
                  </div>
                </div>
                <div class="device-actions">
                  <n-tag type="error" size="small">{{ t('encryption.device_trust.unverified') }}</n-tag>
                  <n-button size="small" type="primary" ghost class="ml-8px" @click="handleVerifyDevice(device)">
                    {{ t('encryption.device_trust.verify') }}
                  </n-button>
                </div>
              </div>
            </div>
          </div>
          <div v-else class="empty-state">
            <n-empty :description="t('encryption.device_trust.select_room_hint')" />
          </div>
        </n-tab-pane>

        <!-- Blocked Devices Tab -->
        <n-tab-pane name="blocked" :tab="t('encryption.device_trust.blocked_tab')">
          <div v-if="blockedDevices.length === 0 && !loading" class="empty-state">
            <n-empty :description="t('encryption.device_trust.no_blocked_devices')" />
          </div>
          <div v-else class="device-list">
            <div v-for="device in blockedDevices" :key="device.deviceId" class="device-item">
              <div class="device-info">
                <div class="device-icon">
                  <Icon icon="mdi:cellphone-remove" :width="24" />
                </div>
                <div class="device-text">
                  <div class="device-name">{{ device.displayName || t('encryption.device_trust.unnamed_device') }}</div>
                  <div class="device-id">{{ device.userId }} / {{ device.deviceId }}</div>
                </div>
              </div>
              <div class="device-actions">
                <n-tag type="error" size="small">{{ t('encryption.device_trust.blocked') }}</n-tag>
                <n-button
                  size="small"
                  type="success"
                  ghost
                  class="ml-8px"
                  :loading="actionLoading === `unblock-${device.deviceId}`"
                  @click="handleUnblockDevice(device)">
                  {{ t('encryption.device_trust.unblock') }}
                </n-button>
              </div>
            </div>
          </div>
        </n-tab-pane>
      </n-tabs>
    </n-spin>

    <template #footer>
      <n-flex justify="end">
        <n-button @click="handleRefresh" :loading="loading">
          <Icon icon="mdi:refresh" :width="16" class="mr-4px" />
          {{ t('common.refresh') }}
        </n-button>
        <n-button @click="handleClose">{{ t('common.close') }}</n-button>
      </n-flex>
    </template>

    <DeviceVerifyDialog
      :show="showVerifyDialog"
      :device-id="verifyTargetDeviceId"
      :device-name="verifyTargetDeviceName"
      initial-mode="sas"
      @update:show="showVerifyDialog = $event"
      @success="handleVerifySuccess" />
  </n-modal>
</template>

<script setup lang="ts">
import { Icon } from '@iconify/vue'
import { NButton, NEmpty, NFlex, NModal, NPopconfirm, NSelect, NSpace, NSpin, NTabPane, NTabs, NTag } from 'naive-ui'
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import DeviceVerifyDialog from '@/components/encryption/DeviceVerifyDialog.vue'
import { useActionFeedback } from '@/composables/common/useActionFeedback'
import { type DeviceTrustInfo, useDeviceTrust } from '@/composables/encryption/useDeviceTrust'
import { matrixEncryptionService } from '@/services/matrix/crypto/MatrixEncryptionService'
import type { RoomInfo } from '@/services/types'
import { useRoomStore } from '@/stores/domains/chat/room'
import { createLogger } from '@/utils/Logger'

const logger = createLogger('DeviceTrustManager')

const { t } = useI18n()
const { showFeedback } = useActionFeedback()
const roomStore = useRoomStore()

const visible = defineModel<boolean>('show', { default: false })

const {
  loading,
  devices,
  unverifiedDevices,
  blockedDevices,
  loadDevices,
  trustDevice,
  untrustDevice,
  blockDevice,
  unblockDevice,
  loadUnverifiedDevicesInRoom
} = useDeviceTrust()

const activeTab = ref('devices')
const actionLoading = ref<string | null>(null)
const selectedRoomId = ref<string | null>(null)
const showVerifyDialog = ref(false)
const verifyTargetDeviceId = ref<string | undefined>()
const verifyTargetDeviceName = ref<string | undefined>()

const currentDeviceId = computed(() => matrixEncryptionService.getCurrentDeviceId())

const roomOptions = computed(() => {
  const rooms: RoomInfo[] = roomStore.roomList || []
  return rooms
    .filter((room: RoomInfo) => room.isEncrypted)
    .map((room: RoomInfo) => ({
      label: room.name || room.roomId,
      value: room.roomId
    }))
})

function getTrustTagType(device: DeviceTrustInfo): 'success' | 'warning' | 'error' | 'default' {
  if (device.isVerified) return 'success'
  if (device.isCrossSigningVerified) return 'warning'
  return 'error'
}

function getTrustLabel(device: DeviceTrustInfo): string {
  if (device.isVerified) return t('encryption.device_trust.verified')
  if (device.isCrossSigningVerified) return t('encryption.device_trust.cross_signed')
  return t('encryption.device_trust.unverified')
}

function formatTimestamp(ts: number): string {
  if (!ts) return ''
  const date = new Date(ts)
  return date.toLocaleString()
}

async function handleTrustDevice(device: DeviceTrustInfo) {
  actionLoading.value = `trust-${device.deviceId}`
  try {
    await trustDevice(device.userId, device.deviceId)
    showFeedback(t('encryption.device_trust.trust_success'), 'success')
  } catch (err) {
    logger.error('Failed to trust device:', err)
    showFeedback(t('encryption.device_trust.trust_failed'), 'error')
  } finally {
    actionLoading.value = null
  }
}

async function handleUntrustDevice(device: DeviceTrustInfo) {
  actionLoading.value = `untrust-${device.deviceId}`
  try {
    await untrustDevice(device.userId, device.deviceId)
    showFeedback(t('encryption.device_trust.untrust_success'), 'success')
  } catch (err) {
    logger.error('Failed to untrust device:', err)
    showFeedback(t('encryption.device_trust.untrust_failed'), 'error')
  } finally {
    actionLoading.value = null
  }
}

async function handleBlockDevice(device: DeviceTrustInfo) {
  actionLoading.value = `block-${device.deviceId}`
  try {
    await blockDevice(device.userId, device.deviceId)
    showFeedback(t('encryption.device_trust.block_success'), 'success')
  } catch (err) {
    logger.error('Failed to block device:', err)
    showFeedback(t('encryption.device_trust.block_failed'), 'error')
  } finally {
    actionLoading.value = null
  }
}

async function handleUnblockDevice(device: DeviceTrustInfo) {
  actionLoading.value = `unblock-${device.deviceId}`
  try {
    await unblockDevice(device.userId, device.deviceId)
    showFeedback(t('encryption.device_trust.unblock_success'), 'success')
  } catch (err) {
    logger.error('Failed to unblock device:', err)
    showFeedback(t('encryption.device_trust.unblock_failed'), 'error')
  } finally {
    actionLoading.value = null
  }
}

function handleVerifyDevice(device: DeviceTrustInfo) {
  verifyTargetDeviceId.value = device.deviceId
  verifyTargetDeviceName.value = device.displayName || device.deviceId
  showVerifyDialog.value = true
}

function handleVerifySuccess() {
  showVerifyDialog.value = false
  handleRefresh()
}

async function handleRoomSelect(roomId: string | null) {
  selectedRoomId.value = roomId
  if (roomId) {
    await loadUnverifiedDevicesInRoom(roomId)
  } else {
    unverifiedDevices.value = []
  }
}

async function handleRefresh() {
  try {
    const client = matrixEncryptionService['getClient']()
    const userId = (client as unknown as { getUserId?: () => string }).getUserId?.()
    if (userId) {
      await loadDevices(userId)
    }
    if (selectedRoomId.value) {
      await loadUnverifiedDevicesInRoom(selectedRoomId.value)
    }
  } catch (err) {
    logger.error('Failed to refresh:', err)
  }
}

function handleClose() {
  visible.value = false
}

watch(visible, async (val) => {
  if (val) {
    await handleRefresh()
  }
})
</script>

<style scoped lang="scss">
.device-trust-manager {
  :deep(.n-card-header) {
    padding: 16px 20px;
  }

  :deep(.n-card__content) {
    padding: 16px 20px;
  }

  :deep(.n-card__footer) {
    padding: 12px 20px;
    border-top: 1px solid var(--tjg-border-default);
  }
}

.device-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.device-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px;
  background: var(--tjg-surface-panel-muted);
  border-radius: 8px;
  gap: 12px;
}

.device-info {
  display: flex;
  align-items: center;
  gap: 12px;
  flex: 1;
  min-width: 0;
}

.device-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--tjg-text-secondary);
}

.device-text {
  display: flex;
  flex-direction: column;
  min-width: 0;
}

.device-name {
  font-size: 14px;
  font-weight: 500;
  color: var(--tjg-text-primary);
  display: flex;
  align-items: center;
}

.device-id {
  font-size: 12px;
  font-family: monospace;
  color: var(--tjg-text-secondary);
  margin-top: 2px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.device-meta {
  font-size: 11px;
  color: var(--tjg-text-tertiary);
  margin-top: 4px;
  display: flex;
  align-items: center;
}

.device-actions {
  display: flex;
  align-items: center;
  flex-shrink: 0;
}

.room-selector-section {
  margin-bottom: 16px;
}

.selector-label {
  font-size: 13px;
  font-weight: 500;
  margin-bottom: 8px;
  color: var(--tjg-text-primary);
}

.unverified-section {
  margin-top: 12px;
}

.empty-state {
  padding: 32px 0;
  display: flex;
  justify-content: center;
}
</style>
