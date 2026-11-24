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
                        <svg class="w-20px h-20px" aria-hidden="true">
                          <use :href="device.deviceId === currentDeviceId ? '#cellphone-check' : '#cellphone'" />
                        </svg>
                      </div>
                    </template>
                    <template #right-icon>
                      <div class="flex gap-8px items-center">
                        <van-tag v-if="device.deviceId === currentDeviceId" type="primary" size="medium">
                          {{ t('encryption.device_trust.current_device') }}
                        </van-tag>
                        <van-tag v-if="device.isCrossSigningVerified" type="success" size="medium">
                          {{ t('encryption.device_trust.verified') }}
                        </van-tag>
                        <van-tag v-else-if="device.isBlocked" type="danger" size="medium">
                          {{ t('encryption.device_trust.blocked') }}
                        </van-tag>
                        <van-tag v-else-if="device.isVerified" type="default" size="medium">
                          {{ t('encryption.device_trust.local_only') }}
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
              <!-- 没建立交叉签名时，所有设备都会显示未验证：不解释就等于把用户困在满屏红标里 -->
              <div v-if="crossSigningEstablished === false" class="cross-signing-notice">
                <p class="cross-signing-notice__title">
                  {{ t('encryption.device_trust.no_cross_signing_title') }}
                </p>
                <p class="cross-signing-notice__desc">
                  {{ t('encryption.device_trust.no_cross_signing_mobile_desc') }}
                </p>
                <van-button size="small" type="primary" block @click="emit('setup-cross-signing')">
                  {{ t('encryption.device_trust.no_cross_signing_mobile_action') }}
                </van-button>
              </div>

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
                        <svg class="w-20px h-20px color-[--tjg-color-warning-500]" aria-hidden="true">
                          <use href="#caution" />
                        </svg>
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
                        <svg class="w-20px h-20px color-[--tjg-color-danger-500]" aria-hidden="true">
                          <use href="#cellphone-remove" />
                        </svg>
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
              <svg class="w-16px h-16px mr-4px" aria-hidden="true">
                <use href="#refresh" />
              </svg>
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
            <van-cell :title="t('encryption.device_trust.verified')" :value="trustStateLabel(selectedDevice)" />
          </van-cell-group>

          <div class="device-actions-sheet">
            <van-button
              v-if="selectedDevice && !selectedDevice.isVerified"
              type="primary"
              block
              @click="handleTrustDevice">
              {{ t('mobile_devices.trust_local_only') }}
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
import { showConfirmDialog, showToast } from 'vant'
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { type DeviceTrustInfo, useDeviceTrust } from '@/composables/encryption/useDeviceTrust'
import MobileAsyncState from '@/mobile/components/common/MobileAsyncState.vue'
import { cryptoSDKAdapter } from '@/services/matrix/crypto/CryptoSDKAdapter'
import type { DeviceInfo } from '@/services/matrix/crypto/cryptoAdapterTypes'
import { matrixEncryptionService } from '@/services/matrix/crypto/MatrixEncryptionService'
import { matrixClientService } from '@/services/matrix/MatrixClientService'
import { useRoomStore } from '@/stores/domains/chat/room'

defineOptions({ name: 'MobileDeviceTrustManager' })

const props = defineProps<{
  show: boolean
}>()

const emit = defineEmits<{
  (e: 'update:show', value: boolean): void
  (e: 'complete'): void
  /** 交叉签名未建立：父组件应引导用户完成「安全检查」 */
  (e: 'setup-cross-signing'): void
}>()

const { t } = useI18n()

const { loading, devices, blockedDevices, loadDevices, trustDevice, untrustDevice, blockDevice, unblockDevice } =
  useDeviceTrust()

const roomStore = useRoomStore()

/**
 * 未通过**交叉签名**验证的设备（跨全部已加密房间聚合去重）。
 *
 * 唯一事实源是 `CryptoDeviceAdapter.getUnverifiedDevicesInRoom`：此处原先依赖
 * `useDeviceTrust` 里的第二份实现，而那份实现从未被调用 ⇒ 这个 Tab 恒为空
 * （看起来像"全部设备都已验证"）。现在按房间逐个取并去重。
 */
const unverifiedDevices = ref<DeviceInfo[]>([])

/**
 * 交叉签名是否已在本机建立。
 *
 * 没建立时**所有**设备都会落进未验证清单（`crossSigningVerified` 恒 false），
 * 必须解释原因，否则用户只会看到满屏「未验证」而无从下手。
 */
const crossSigningEstablished = ref<boolean | null>(null)

async function loadCrossSigningEstablished(): Promise<void> {
  try {
    const status = await cryptoSDKAdapter.getCrossSigningStatus()
    crossSigningEstablished.value = status.publicKeysOnDevice
  } catch {
    crossSigningEstablished.value = null
  }
}

async function loadAllUnverifiedDevices(): Promise<void> {
  const roomIds = (roomStore.roomList || []).filter((room) => room.isEncrypted).map((room) => room.roomId)
  const seen = new Set<string>()
  const acc: DeviceInfo[] = []
  for (const roomId of roomIds) {
    try {
      for (const device of await cryptoSDKAdapter.getUnverifiedDevicesInRoom(roomId)) {
        const key = `${device.userId}:${device.deviceId}`
        if (seen.has(key)) continue
        seen.add(key)
        acc.push(device)
      }
    } catch {
      // 单个房间取不到不阻断其它房间（与 Adapter 的"成员级失败跳过"同策略）
    }
  }
  unverifiedDevices.value = acc
}

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
    // 未验证 Tab 也必须有数据，否则空列表会被读成「全部设备都已验证」
    void loadAllUnverifiedDevices()
    void loadCrossSigningEstablished()
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

/**
 * 信任状态的**三态**展示。
 *
 * `isVerified`（SDK 的 `isVerified()`）把「本机手动标记」也算作已验证，
 * 而本机标记没有密码学凭据。这里必须与「交叉签名已验证」区分，否则用户会以为
 * 点一下「信任」就完成了身份验证。
 */
function trustStateLabel(device: DeviceTrustInfo | null): string {
  if (!device) return ''
  if (device.isCrossSigningVerified) return t('encryption.device_trust.cross_signed')
  if (device.isVerified) return t('encryption.device_trust.local_only')
  return t('encryption.device_trust.unverified')
}

async function handleTrustDevice() {
  if (!selectedDevice.value) return
  const device = selectedDevice.value
  // 「信任」只是往本地 crypto store 写一个布尔，不做任何密码学验证。
  // 必须先讲清楚，否则用户会把「本机标记」当成「已验证身份」。
  try {
    await showConfirmDialog({
      title: t('mobile_devices.trust_confirm_title'),
      message: t('mobile_devices.trust_confirm_message'),
      confirmButtonText: t('mobile_devices.trust_local_only')
    })
  } catch {
    return // 用户取消
  }

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
/* 未建立交叉签名时的解释横幅：与移动端其它警示块保持同一套 token */
.cross-signing-notice {
  margin: 12px 16px;
  padding: 12px;
  border-radius: var(--tjg-radius-sm, 8px);
  background-color: var(--tjg-color-warning-100);

  &__title {
    margin: 0 0 4px;
    font-size: var(--tjg-font-size-sm);
    font-weight: 600;
    color: var(--tjg-text-primary);
  }

  &__desc {
    margin: 0 0 8px;
    font-size: var(--tjg-font-size-xs);
    line-height: 1.5;
    color: var(--tjg-text-secondary);
  }
}

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
