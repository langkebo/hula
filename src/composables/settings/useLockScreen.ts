import { listen } from '@tauri-apps/api/event'
import { storeToRefs } from 'pinia'
import { computed } from 'vue'
import { useRoute } from 'vue-router'
import { useTauriListener } from '@/composables/common/useTauriListener'
import { EventEnum } from '@/enums'
import { useSettingStore } from '@/stores/domains/settings/setting'
import { hasTauriRuntime } from '@/utils/AppHarness'

/** 这些窗口/页面不进入锁定层 */
const LOCK_EXCLUSION = new Set(['/login', '/tray', '/qrCode', '/about', '/onlineStatus', '/capture'])

/**
 * 锁屏状态（需求 5.12）：
 * - 派生 isLock：无密码凭据时不得进入锁定层，否则历史数据（enable=true / passwordHash 缺失）会自锁死
 * - 跨窗口同步（需求 5.12.2）：任一窗口锁定/解锁后广播事件，其余窗口跟随切换
 */
export function useLockScreen() {
  const settingStore = useSettingStore()
  const { lockScreen } = storeToRefs(settingStore)
  const route = useRoute()

  const isLock = computed(
    () => !LOCK_EXCLUSION.has(route.path) && lockScreen.value.enable && !!lockScreen.value.passwordHash
  )

  if (hasTauriRuntime()) {
    const { addListener } = useTauriListener()

    addListener(
      listen(EventEnum.LOCK_SCREEN, () => {
        settingStore.lockScreen.enable = true
      }),
      'lock_screen_sync'
    )

    addListener(
      listen(EventEnum.UNLOCK_SCREEN, () => {
        settingStore.lockScreen.enable = false
      }),
      'unlock_screen_sync'
    )
  }

  return { isLock }
}
