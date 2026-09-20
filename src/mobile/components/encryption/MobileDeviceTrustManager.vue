<template>
  <AutoFixHeightPage :show-footer="false">
    <template #header>
      <HeaderBar border :isOfficial="false" :hidden-right="true" :room-name="t('encryption.device_trust.title')" />
    </template>

    <template #container>
      <div class="device-trust-manager-mobile">
        <!-- 加载状态 -->
        <div v-if="loading" class="flex justify-center items-center py-40px">
          <van-loading size="24px">{{ t('mobile_devices.loading') }}</van-loading>
        </div>

        <div v-else class="flex flex-col">
          <!-- 设备列表 Tab -->
          <van-tabs v-model:active="activeTab" sticky>
            <van-tab :title="t('encryption.device_trust.device_list_tab')" name="devices">
              <div v-if="devices.length === 0" class="empty-state">
                <van-empty :description="t('encryption.device_trust.no_devices')" />
              </div>
              <div v-else class="device-list">
                <van-cell-group inset>
                  <van-cell
                    v-for="device in devices"
                    :key="device.deviceId"
                    :title="device.displayName || t('encryption.device_trust.unnamed_device')"
                    :label="device.deviceId"
                    is-link
                    @click="handleDeviceClick(device)">
                    <template #icon>
                      <div class="device-icon-cell">
                        <Icon
                          :icon="device.deviceId === currentDeviceId ? 'mdi:cellphone-check' : 'mdi:cellphone'"
                          :width="20" />
                      </div>
                    </template>
                    <template #right-icon>
                      <div class="flex gap-8px items-center">
                        <van-tag v-if="device.deviceId === currentDeviceId" type="primary" size="medium">
                          {{ t('encryption.device_trust.current_device') }}
                        </van-tag>
                        <van-tag v-if="device.isVerified" type="success" size="medium">
                          {{ t('encryption.device_trust.verified') }}
                        </van-tag>
                        <van-tag v-else-if="device.isBlocked" type="danger" size="medium">
                          {{ t('encryption.device_trust.blocked') }}
                        </van-tag>
                        <van-tag v-else type="warning" size="medium">
                          {{ t('encryption.device_trust.unverified') }}
                        </van-tag>
                      </div>
                    </template>
                  </van-cell>
                </van-cell-group>
              </div>
            </van-tab>

            <!-- 未验证设备 Tab -->
            <van-tab :title="t('encryption.device_trust.unverified_tab')" name="unverified">
              <div v-if="unverifiedDevices.length === 0" class="empty-state">
                <van-empty :description="t('encryption.device_trust.no_unverified_devices')" />
              </div>
              <div v-else class="device-list">
                <van-cell-group inset>
                  <van-cell
                    v-for="device in unverifiedDevices"
                    :key="`${device.userId}-${device.deviceId}`"
                    :title="device.displayName || device.deviceId"
                    :label="`${device.userId} / ${device.deviceId}`"
                    is-link
                    @click="handleVerifyClick(device)">
                    <template #icon>
                      <div class="device-icon-cell">
                        <Icon icon="mdi:shield-alert" :width="20" color="var(--tjg-color-warning-500)" />
                      </div>
                    </template>
                    <template #right-icon>
                      <van-tag type="danger" size="medium">{{ t('encryption.device_trust.unverified') }}</van-tag>
                    </template>
                  </van-cell>
                </van-cell-group>
              </div>
            </van-tab>

            <!-- 已屏蔽设备 Tab -->
            <van-tab :title="t('encryption.device_trust.blocked_tab')" name="blocked">
              <div v-if="blockedDevices.length === 0" class="empty-state">
                <van-empty :description="t('encryption.device_trust.no_blocked_devices')" />
              </div>
              <div v-else class="device-list">
                <van-cell-group inset>
                  <van-cell
                    v-for="device in blockedDevices"
                    :key="device.deviceId"
                    :title="device.displayName || t('encryption.device_trust.unnamed_device')"
                    :label="device.deviceId"
                    is-link
                    @click="handleUnblockClick(device)">
                    <template #icon>
                      <div class="device-icon-cell">
                        <Icon icon="mdi:cellphone-remove" :width="20" color="var(--tjg-color-danger-500)" />
                      </div>
                    </template>
                    <template #right-icon>
                      <van-tag type="danger" size="medium">{{ t('encryption.device_trust.blocked') }}</van-tag>
                    </template>
                  </van-cell>
                </van-cell-group>
              </div>
            </van-tab>
          </van-tabs>

          <!-- 底部刷新按钮 -->
          <div class="p-16px">
            <van-button type="primary" block :loading="loading" @click="handleRefresh">
              <Icon icon="mdi:refresh" :width="16" class="mr-4px" />
              {{ t('common.refresh') }}
            </van-button>
          </div>
        </div>
      </div>

      <!-- 设备详情弹出层 -->
      <van-action-sheet v-model:show="showDeviceSheet" :title="selectedDevice?.displayName || selectedDevice?.deviceId">
        <div class="device-detail-sheet">
          <van-cell-group>
            <van-cell :title="t('setting.encryption.device_id')" :value="selectedDevice?.deviceId" />
            <van-cell
              :title="t('encryption.device_trust.current_device')"
              :value="
                selectedDevice?.deviceId === currentDeviceId ? t('encryption.device_trust.current_device') : ''
              " />
            <van-cell
              :title="t('encryption.device_trust.verified')"
              :value="
                selectedDevice?.isVerified
                  ? t('encryption.device_trust.verified')
                  : t('encryption.device_trust.unverified')
              " />
          </van-cell-group>

          <div class="device-actions-sheet">
            <van-button
              v-if="selectedDevice && !selectedDevice.isVerified"
              type="primary"
              block
              @click="handleTrustDevice">
              {{ t('encryption.device_trust.trust') }}
            </van-button>
            <van-button
              v-if="selectedDevice && selectedDevice.isVerified"
              type="warning"
              block
              @click="handleUntrustDevice">
              {{ t('encryption.device_trust.untrust') }}
            </van-button>
            <van-button
              v-if="selectedDevice && !selectedDevice.isBlocked"
              type="danger"
              block
              @click="handleBlockDevice">
              {{ t('encryption.device_trust.block') }}
            </van-button>
            <van-button
              v-if="selectedDevice && selectedDevice.isBlocked"
              type="success"
              block
              @click="handleUnblockDevice">
              {{ t('encryption.device_trust.unblock') }}
            </van-button>
          </div>
        </div>
      </van-action-sheet>
    </template>
  </AutoFixHeightPage>
</template>

<script setup lang="ts">
import { Icon } from '@iconify/vue'
import { showConfirmDialog, showToast } from 'vant'
import { computed, onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { type DeviceTrustInfo, useDeviceTrust } from '@/composables/encryption/useDeviceTrust'
import AutoFixHeightPage from '@/mobile/components/chat-room/AutoFixHeightPage.vue'
import HeaderBar from '@/mobile/components/chat-room/HeaderBar.vue'
import { matrixEncryptionService } from '@/services/matrix/crypto/MatrixEncryptionService'
import { matrixClientService } from '@/services/matrix/MatrixClientService'
import { createLogger } from '@/utils/Logger'

const logger = createLogger('MobileDeviceTrustManager')

const { t } = useI18n()

const {
  loading,
  devices,
  unverifiedDevices,
  blockedDevices,
  loadDevices,
  trustDevice,
  untrustDevice,
  blockDevice,
  unblockDevice
} = useDeviceTrust()

const activeTab = ref('devices')
const showDeviceSheet = ref(false)
const selectedDevice = ref<DeviceTrustInfo | null>(null)
const actionLoading = ref<string | null>(null)

const currentDeviceId = computed(() => matrixEncryptionService.getCurrentDeviceId() || '')

onMounted(async () => {
  // 默认加载自己的设备列表
  const userId = matrixClientService.getUserId()
  if (userId) {
    await loadDevices(userId)
  }
})

function handleDeviceClick(device: DeviceTrustInfo) {
  selectedDevice.value = device
  showDeviceSheet.value = true
}

function handleVerifyClick(_device: DeviceTrustInfo) {
  // 跳转到设备验证流程
  showToast(t('mobile_devices.verification_started'))
}

async function handleTrustDevice() {
  if (!selectedDevice.value) return
  const device = selectedDevice.value
  actionLoading.value = `trust-${device.deviceId}`
  try {
    await trustDevice(device.userId, device.deviceId)
    showToast(t('mobile_devices.trust_success'))
    showDeviceSheet.value = false
  } catch {
    showToast(t('mobile_devices.trust_failed'))
  } finally {
    actionLoading.value = null
  }
}

async function handleUntrustDevice() {
  if (!selectedDevice.value) return
  const device = selectedDevice.value
  try {
    await showConfirmDialog({
      title: t('encryption.device_trust.untrust'),
      message: t('mobile_devices.untrust_confirm')
    })
    actionLoading.value = `untrust-${device.deviceId}`
    await untrustDevice(device.userId, device.deviceId)
    showToast(t('mobile_devices.untrust_success'))
    showDeviceSheet.value = false
  } catch (e) {
    if (e !== 'cancel') showToast(t('mobile_devices.untrust_failed'))
  } finally {
    actionLoading.value = null
  }
}

async function handleBlockDevice() {
  if (!selectedDevice.value) return
  const device = selectedDevice.value
  try {
    await showConfirmDialog({
      title: t('encryption.device_trust.block'),
      message: t('mobile_devices.block_confirm')
    })
    actionLoading.value = `block-${device.deviceId}`
    await blockDevice(device.userId, device.deviceId)
    showToast(t('mobile_devices.block_success'))
    showDeviceSheet.value = false
  } catch (e) {
    if (e !== 'cancel') showToast(t('mobile_devices.block_failed'))
  } finally {
    actionLoading.value = null
  }
}

async function handleUnblockClick(device: DeviceTrustInfo) {
  actionLoading.value = `unblock-${device.deviceId}`
  try {
    await unblockDevice(device.userId, device.deviceId)
    showToast(t('mobile_devices.unblock_success'))
  } catch {
    showToast(t('mobile_devices.unblock_failed'))
  } finally {
    actionLoading.value = null
  }
}

async function handleUnblockDevice() {
  if (!selectedDevice.value) return
  await handleUnblockClick(selectedDevice.value)
  showDeviceSheet.value = false
}

const handleRefresh = async () => {
  const userId = matrixClientService.getUserId()
  if (userId) {
    await loadDevices(userId)
  }
}
</script>

<style scoped lang="scss">
.device-trust-manager-mobile {
  padding: 0;
  min-height: 100vh;
  background: var(--van-background-2);
}

.empty-state {
  padding: 40px 16px;
}

.device-list {
  padding: 0;
}

.device-icon-cell {
  width: 40px;
  height: 40px;
  border-radius: 50%;
  background: var(--tjg-color-primary-50);
  display: flex;
  align-items: center;
  justify-content: center;
  margin-right: 12px;
  flex-shrink: 0;
}

.device-detail-sheet {
  padding: 16px;

  .device-actions-sheet {
    margin-top: 16px;
    display: flex;
    flex-direction: column;
    gap: 12px;
  }
}
</style>
