import { computed } from 'vue'
import { applyGlobalStrict } from '@/services/matrix/crypto/strictDevicePolicy'
import { useSettingStore } from '@/stores/domains/settings/setting'
import { createLogger } from '@/utils/Logger'

const logger = createLogger('GlobalStrictMode')

/**
 * 全局严格模式（不向未验证设备发送消息）的双端共享实现。
 *
 * 桌面端设置页与移动端设置页共用同一份偏好与施加逻辑，避免两端各自维护一份状态：
 * - 偏好持久化在 `settingStore.blockUnverifiedDevicesEnabled`
 * - 写入后立即施加到 SDK 的 `crypto.globalBlacklistUnverifiedDevices`
 * - crypto 未就绪时仅持久化，由登录 / crypto 初始化后的 `reapplyPersistedStrictness()` 重放
 */
export function useGlobalStrictMode() {
  const settingStore = useSettingStore()

  const enabled = computed(() => settingStore.blockUnverifiedDevicesEnabled)

  function setEnabled(value: boolean) {
    settingStore.setBlockUnverifiedDevicesEnabled(value)
    if (!applyGlobalStrict(value)) {
      logger.warn('crypto not ready; strict-mode preference saved and will take effect after crypto init')
    }
  }

  return { enabled, setEnabled }
}
