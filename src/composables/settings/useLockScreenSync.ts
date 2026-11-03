import { listen } from '@tauri-apps/api/event'
import { useTauriListener } from '@/composables/common/useTauriListener'
import { EventEnum } from '@/enums'
import { useSettingStore } from '@/stores/domains/settings/setting'
import { hasTauriRuntime } from '@/utils/AppHarness'

/**
 * 跨窗口同步锁屏状态（需求 5.12.2）：
 * 任一窗口锁定/解锁后广播事件，其余窗口跟随切换，避免只有发起窗口进入锁屏。
 */
export function useLockScreenSync() {
  if (!hasTauriRuntime()) return

  const settingStore = useSettingStore()
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
