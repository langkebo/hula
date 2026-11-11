<template>
  <AutoFixHeightPage :show-footer="false">
    <template #header>
      <HeaderBar border :isOfficial="false" :hidden-right="true" :room-name="t('mobile_devices.title')" />
    </template>

    <template #container>
      <div class="flex flex-col overflow-auto h-full">
        <div v-if="loading" class="flex justify-center items-center py-40px">
          <van-loading size="24px">{{ t('mobile_devices.loading') }}</van-loading>
        </div>

        <div v-else class="flex flex-col p-16px gap-12px">
          <div class="text-14px text-gray-500 mb-8px">{{ t('mobile_devices.subtitle') }}</div>

          <van-cell-group inset>
            <van-cell
              v-for="device in devices"
              :key="device.deviceId"
              :title="device.displayName || t('mobile_devices.unnamed_device')"
              :label="formatDeviceLabel(device)"
              is-link
              @click="openDeviceActions(device)">
              <template #icon>
                <div class="w-40px h-40px rounded-full bg-gray-100 mr-12px flex items-center justify-center">
                  <Icon :icon="getDeviceIcon()" :width="20" color="var(--tjg-text-secondary)" />
                </div>
              </template>
              <template #right-icon>
                <div class="flex items-center gap-4px">
                  <van-tag v-if="device.deviceId === currentDeviceId" type="primary" size="medium">
                    {{ t('mobile_devices.current') }}
                  </van-tag>
                  <van-tag v-if="device.isVerified && !isCurrentDevice(device.deviceId)" type="success" size="medium">
                    {{ t('mobile_devices.verified') }}
                  </van-tag>
                </div>
              </template>
            </van-cell>
          </van-cell-group>

          <!-- 安全操作区（危险操作独立分区，远离高频区域；方案 3.1.3） -->
          <div v-if="otherDevices.length > 0" class="mt-16px px-16px flex flex-col gap-8px">
            <div class="text-14px text-[--tjg-text-secondary]">{{ t('mobile_devices.danger_section') }}</div>
            <div class="text-12px text-[--tjg-text-tertiary]">{{ t('mobile_devices.logout_other_desc') }}</div>
            <van-button type="danger" block plain @click="handleLogoutOtherDevices">
              {{ t('mobile_devices.logout_other') }}
            </van-button>
          </div>

          <!-- 设备操作面板 -->
          <van-action-sheet
            v-model:show="showDeviceActionSheet"
            :title="t('mobile_devices.actions')"
            :actions="deviceActions" />

          <!-- 重命名弹窗（方案 3.1.1） -->
          <van-dialog
            v-model:show="showRenameDialog"
            :title="t('mobile_devices.rename_device')"
            show-cancel-button
            :confirm-button-text="t('common.confirm')"
            :cancel-button-text="t('common.cancel')"
            @confirm="handleRenameConfirm">
            <div class="p-16px">
              <van-field
                v-model="renameInput"
                :aria-label="t('mobile_devices.rename_device')"
                :placeholder="t('mobile_devices.rename_placeholder')"
                maxlength="64" />
            </div>
          </van-dialog>
        </div>
      </div>
    </template>
  </AutoFixHeightPage>
</template>

<script setup lang="ts">
import { Icon } from '@iconify/vue'
import { showConfirmDialog, showToast } from 'vant'
import { computed, onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { type DeviceSessionInfo, useDeviceSessions } from '@/composables/encryption/useDeviceSessions'
import { useDeviceTrust } from '@/composables/encryption/useDeviceTrust'
import AutoFixHeightPage from '@/mobile/components/chat-room/AutoFixHeightPage.vue'
import HeaderBar from '@/mobile/components/chat-room/HeaderBar.vue'
import { createLogger } from '@/utils/Logger'

const logger = createLogger('DeviceManagement')

const { t } = useI18n()

// 设备列表与写操作统一由 useDeviceSessions 提供（与加密设置页共用）
const {
  loading,
  devices,
  currentDeviceId,
  userId: currentUserId,
  otherDevices,
  isCurrentDevice,
  loadDevices: loadDeviceSessions,
  deleteDevice,
  deleteDevices,
  renameDevice
} = useDeviceSessions()
// 信任/取消信任仍走设备信任 composable
const { trustDevice, untrustDevice } = useDeviceTrust()

const showDeviceActionSheet = ref(false)
const selectedDevice = ref<DeviceSessionInfo | null>(null)
const showRenameDialog = ref(false)
const renameInput = ref('')

/**
 * 操作面板项。
 *
 * ⚠️ Vant 4 的 `ActionSheetAction` **只有 `name`**（就是显示文案），没有 `text`
 * 字段。原实现写的是 `{ name: 'rename', text: t(...) }`，于是弹层里直接把
 * 英文标识符渲染出来（用户看到「rename / logout」而不是「重命名设备 / 登出」）。
 *
 * 现在：`name` 放**本地化文案**（Vant 拿它显示），动作靠 `key` + `callback` 区分。
 */
interface DeviceAction {
  key: 'rename' | 'trust' | 'untrust' | 'logout'
  name: string
  callback: () => void
}

const deviceActions = computed<DeviceAction[]>(() => {
  const actions: DeviceAction[] = []
  const device = selectedDevice.value
  if (!device) {
    return actions
  }
  const push = (key: DeviceAction['key'], labelKey: string) =>
    actions.push({ key, name: t(labelKey), callback: () => void handleActionSelect({ name: key }) })

  // 方案 3.1 的原意是「当前设备不可**删除**」（在列表里点删除等于把自己踢下线），
  // 但此前写成了「当前设备不可操作」，顺手把**改名**也封了 ⇒ 单设备用户永远改不了自己这台的名字。
  // 桌面端一直允许改本机名（`SessionSettings` 的 `showRenameDialog(currentDevice)`），这里对齐。
  if (isCurrentDevice(device.deviceId)) {
    push('rename', 'mobile_devices.rename_device')
    return actions
  }

  push('rename', 'mobile_devices.rename_device')

  if (!device.isVerified) {
    push('trust', 'mobile_devices.trust_device')
  } else {
    push('untrust', 'mobile_devices.untrust_device')
  }

  // 屏蔽/解除屏蔽：SDK 未提供设备屏蔽写入 API，不再提供必然失败的操作项
  // （此前点击只会得到 "blockDevice is not a function" 类错误）

  push('logout', 'mobile_devices.logout_device')

  return actions
})

onMounted(async () => {
  await loadDevices()
})

async function loadDevices() {
  const loaded = await loadDeviceSessions()
  if (!loaded) {
    showToast({ type: 'fail', message: t('mobile_devices.load_failed') })
  }
}

/**
 * 设备图标。
 *
 * 历史缺陷：原实现把 `lastSeenIp`（一个 IP 地址）当作 User-Agent 字符串去匹配
 * `mobile`/`ipad`，恒不命中而永远返回笔记本图标。设备会话没有 UA 字段，
 * 因此这里返回中性图标而不是臆测设备类型。
 */
function getDeviceIcon(): string {
  return 'mdi:devices'
}

function formatDeviceLabel(device: DeviceSessionInfo): string {
  const parts: string[] = []
  if (device.lastSeenIp) {
    parts.push(device.lastSeenIp)
  }
  if (device.lastSeenTs) {
    const date = new Date(device.lastSeenTs)
    parts.push(date.toLocaleDateString())
  }
  return parts.join(' · ') || t('mobile_devices.no_info')
}

/** 打开某台设备的操作面板（替代原先非法的多语句内联表达式） */
function openDeviceActions(device: DeviceSessionInfo): void {
  selectedDevice.value = device
  showDeviceActionSheet.value = true
}

// 设备操作选择（信任/取消信任/屏蔽/解除屏蔽）
async function handleActionSelect(action: { name: string }) {
  if (!selectedDevice.value) return
  const device = selectedDevice.value
  const userId = currentUserId.value
  const deviceId = device.deviceId

  try {
    switch (action.name) {
      case 'trust':
        await showConfirmDialog({
          title: t('mobile_devices.trust_device'),
          message: t('mobile_devices.trust_confirm', { name: device.displayName || t('mobile_devices.unnamed_device') })
        })
        await trustDevice(userId, deviceId)
        showToast(t('mobile_devices.trust_success'))
        await loadDevices()
        break
      case 'untrust':
        await showConfirmDialog({
          title: t('mobile_devices.untrust_device'),
          message: t('mobile_devices.untrust_confirm')
        })
        await untrustDevice(userId, deviceId)
        showToast(t('mobile_devices.untrust_success'))
        await loadDevices()
        break
      case 'rename':
        renameInput.value = device.displayName || ''
        showRenameDialog.value = true
        break
      case 'logout':
        await showConfirmDialog({
          title: t('mobile_devices.logout_device'),
          message: t('mobile_devices.logout_confirm', {
            name: device.displayName || t('mobile_devices.unnamed_device')
          })
        })
        await deleteDevice(deviceId)
        showToast(t('mobile_devices.logout_success'))
        break
      case 'block':
      case 'unblock':
        // 不再提供这两个操作项；若被旧调用触达则明确告知能力缺失
        showToast(t('mobile_devices.block_unsupported'))
        break
    }
  } catch (error) {
    if (error !== 'cancel') {
      logger.error(`Device ${action.name} failed`, error)
      showToast(t(`mobile_devices.${action.name}_failed`))
    }
  }
  showDeviceActionSheet.value = false
}

/** 重命名确认（方案 3.1.1） */
async function handleRenameConfirm(): Promise<void> {
  const device = selectedDevice.value
  const name = renameInput.value.trim()
  if (!device) return
  if (!name) {
    showToast(t('mobile_devices.rename_empty'))
    return
  }
  try {
    await renameDevice(device.deviceId, name)
    showToast(t('mobile_devices.rename_success'))
    showRenameDialog.value = false
  } catch (error) {
    logger.error('Failed to rename device', error)
    showToast({ type: 'fail', message: t('mobile_devices.rename_failed') })
  }
}

/** 一键登出所有其他设备（方案 3.1.3） */
async function handleLogoutOtherDevices(): Promise<void> {
  const others = otherDevices.value
  if (others.length === 0) {
    showToast(t('mobile_devices.no_other_devices'))
    return
  }
  try {
    await showConfirmDialog({
      title: t('mobile_devices.logout_other_confirm.title'),
      message: t('mobile_devices.logout_other_confirm.message', { count: others.length }),
      confirmButtonText: t('mobile_devices.logout_other_confirm.confirm'),
      cancelButtonText: t('mobile_devices.logout_other_confirm.cancel')
    })
    await deleteDevices(others.map((d) => d.deviceId))
    showToast(t('mobile_devices.logout_other_success'))
  } catch (error) {
    if (error !== 'cancel') {
      logger.error('Failed to log out other devices', error)
      showToast({ type: 'fail', message: t('mobile_devices.logout_other_failed') })
    }
  }
}
</script>

<style scoped></style>
