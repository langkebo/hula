<template>
  <n-modal
    v-model:show="visible"
    preset="card"
    :title="t('encryption.device_trust.title')"
    :bordered="false"
    :closable="true"
    :mask-closable="false"
    class="device-trust-manager w-[700px] max-w-[90vw]">
    <n-spin :show="loading">
      <n-tabs v-model:value="activeTab" type="line">
        <!-- Device List Tab -->
        <n-tab-pane name="devices" :tab="t('encryption.device_trust.device_list_tab')">
          <ErrorState
            v-if="devicesLoadError && devices.length === 0 && !loading"
            compact
            :title="t('common.load_failed')"
            :retry-text="t('common.retry')"
            @retry="handleRefresh" />
          <EmptyState
            v-else-if="devices.length === 0 && !loading"
            compact
            :description="t('encryption.device_trust.no_devices')" />
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
            <ErrorState
              v-if="unverifiedLoadError && unverifiedDevices.length === 0 && !loading"
              compact
              :title="t('common.load_failed')"
              :retry-text="t('common.retry')"
              @retry="handleRefresh" />
            <EmptyState
              v-else-if="unverifiedDevices.length === 0 && !loading"
              compact
              :description="t('encryption.device_trust.no_unverified_devices')" />
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
          <EmptyState v-else compact :description="t('encryption.device_trust.select_room_hint')" />
        </n-tab-pane>

        <!-- Blocked Devices Tab -->
        <n-tab-pane name="blocked" :tab="t('encryption.device_trust.blocked_tab')">
          <ErrorState
            v-if="devicesLoadError && blockedDevices.length === 0 && !loading"
            compact
            :title="t('common.load_failed')"
            :retry-text="t('common.retry')"
            @retry="handleRefresh" />
          <EmptyState
            v-else-if="blockedDevices.length === 0 && !loading"
            compact
            :description="t('encryption.device_trust.no_blocked_devices')" />
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
      :user-id="verifyTargetUserId"
      :device-id="verifyTargetDeviceId"
      :device-name="verifyTargetDeviceName"
      initial-mode="sas"
      @update:show="showVerifyDialog = $event"
      @success="handleVerifySuccess" />
  </n-modal>
</template>

<script setup lang="ts">
import { Icon } from '@iconify/vue'
import { NButton, NFlex, NModal, NPopconfirm, NSelect, NSpace, NSpin, NTabPane, NTabs, NTag } from 'naive-ui'
import { useI18n } from 'vue-i18n'
import DeviceVerifyDialog from '@/components/encryption/DeviceVerifyDialog.vue'
import { useDeviceTrustActions } from '@/composables/encryption/useDeviceTrustActions'

const { t } = useI18n()

const visible = defineModel<boolean>('show', { default: false })

const {
  loading,
  devices,
  unverifiedDevices,
  blockedDevices,
  activeTab,
  actionLoading,
  selectedRoomId,
  devicesLoadError,
  unverifiedLoadError,
  showVerifyDialog,
  verifyTargetUserId,
  verifyTargetDeviceId,
  verifyTargetDeviceName,
  currentDeviceId,
  roomOptions,
  getTrustTagType,
  getTrustLabel,
  formatTimestamp,
  handleTrustDevice,
  handleUntrustDevice,
  handleBlockDevice,
  handleUnblockDevice,
  handleVerifyDevice,
  handleVerifySuccess,
  handleRoomSelect,
  handleRefresh,
  handleClose
} = useDeviceTrustActions({ visible })
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
</style>
