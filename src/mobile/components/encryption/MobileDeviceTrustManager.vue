<template>
  <van-popup
    :show="props.show"
    position="right"
    class="device-trust-popup"
    :style="{ width: '100%', height: '100%' }"
    @update:show="handleVisibleUpdate">
    <div class="device-trust-manager-mobile">
      <van-nav-bar
        :title="t('encryption.device_trust.title')"
        left-arrow
        safe-area-inset-top
        @click-left="handleClose" />

      <div class="device-trust-manager-mobile__body">
        <!-- 加载状态 -->
        <div v-if="loading" class="flex justify-center items-center py-40px">
          <van-loading size="24px">{{ t('mobile_devices.loading') }}</van-loading>
        </div>

        <div v-else class="flex flex-col">
          <!-- 设备列表 Tab -->
          <van-tabs v-model:active="activeTab" sticky>
            <van-tab :title="t('encryption.device_trust.device_list_tab')" name="devices">
              <MobileAsyncState
                v-if="devices.length === 0"
                state="empty"
                :empty-text="t('encryption.device_trust.no_devices')"
                min-height="160px" />
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
              <MobileAsyncState
                v-if="unverifiedDevices.length === 0"
                state="empty"
                :empty-text="t('encryption.device_trust.no_unverified_devices')"
                min-height="160px" />
              <div v-else class="device-list">
                <van-cell-group inset>
                  <van-cell
                    v-for="device in unverifiedDevices"
                    :key="`${device.userId}-${device.deviceId}`"
                    :title="device.displayName || device.deviceId"
                    :label="`${device.userId} / ${device.deviceId}`"
                    is-link
                    @click="handleVerifyClick()">
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
              <MobileAsyncState
                v-if="blockedDevices.length === 0"
                state="empty"
                :empty-text="t('encryption.device_trust.no_blocked_devices')"
                min-height="160px" />
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
      <van-action-sheet
        v-model:show="showDeviceSheet"
        :title="(selectedDevice?.displayName || selectedDevice?.deviceId) ?? ''">
        <div class="device-detail-sheet">
          <van-cell-group>
            <van-cell
              :title="t('setting.encryption.device_id')"
              v-bind="selectedDevice?.deviceId !== undefined ? { value: selectedDevice.deviceId } : {}" />
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
    </div>
  </van-popup>
</template>

<script setup lang="ts">
import { Icon } from '@iconify/vue'
import { showConfirmDialog, showToast } from 'vant'
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { type DeviceTrustInfo, useDeviceTrust } from '@/composables/encryption/useDeviceTrust'
import MobileAsyncState from '@/mobile/components/common/MobileAsyncState.vue'
import { matrixEncryptionService } from '@/services/matrix/crypto/MatrixEncryptionService'
import { matrixClientService } from '@/services/matrix/MatrixClientService'

defineOptions({ name: 'MobileDeviceTrustManager' })

const props = defineProps<{
  show: boolean
}>()

const emit = defineEmits<{
  (e: 'update:show', value: boolean): void
  (e: 'complete'): void
}>()

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

const loadCurrentUserDevices = async () => {
  const userId = matrixClientService.getUserId()
  if (userId) {
    await loadDevices(userId)
  }
}

watch(
  () => props.show,
  async (visible) => {
    if (!visible) return
    showDeviceSheet.value = false
    await loadCurrentUserDevices()
  },
  { immediate: true }
)

function handleVisibleUpdate(value: boolean) {
  emit('update:show', value)
}

function handleClose() {
  emit('update:show', false)
  emit('complete')
}

function handleDeviceClick(device: DeviceTrustInfo) {
  selectedDevice.value = device
  showDeviceSheet.value = true
}

function handleVerifyClick() {
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
    emit('complete')
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
    emit('complete')
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
    emit('complete')
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
    emit('complete')
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
  await loadCurrentUserDevices()
}
</script>

<style scoped lang="scss">
.device-trust-popup {
  display: flex;
  flex-direction: column;
}

.device-trust-manager-mobile {
  display: flex;
  flex-direction: column;
  height: 100%;
  padding: 0;
  background: var(--van-background-2);

  &__body {
    flex: 1;
    min-height: 0;
    overflow-y: auto;
    -webkit-overflow-scrolling: touch;
  }
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
