import { computed, onMounted, onUnmounted, ref } from 'vue'
import { useActionFeedback } from '@/composables/common/useActionFeedback'
import { useI18nGlobal } from '@/services/i18n'
import {
  canOpenSystemNotificationSettings,
  getSystemNotificationPermissionStatus,
  openSystemNotificationSettings,
  requestSystemNotificationPermission,
  type SystemNotificationPermissionStatus
} from '@/services/matrix/notifications/systemNotificationPermission'

/**
 * 系统通知权限状态（C-12）。
 *
 * 权限只能从 Tauri 插件 API 读取真实状态，浏览器 `Notification.permission`
 * 在桌面端与系统实际授权不一致，因此统一收敛到这里。
 */
export const useSystemNotificationPermission = () => {
  const { t } = useI18nGlobal()
  const { showFeedback } = useActionFeedback()

  const permissionStatus = ref<SystemNotificationPermissionStatus>('unsupported')
  const canOpenSystemSettings = canOpenSystemNotificationSettings()
  const permissionStatusText = computed(() => {
    if (permissionStatus.value === 'granted') return t('setting.notification.desktop.permission_granted')
    if (permissionStatus.value === 'denied') return t('setting.notification.desktop.permission_denied')
    return t('setting.notification.desktop.permission_unsupported')
  })

  const refresh = async () => {
    permissionStatus.value = await getSystemNotificationPermissionStatus()
  }

  /** 请求权限并刷新状态；返回是否已授权。 */
  const request = async (): Promise<boolean> => {
    const granted = await requestSystemNotificationPermission()
    await refresh()
    return granted
  }

  const openSystemSettings = async () => {
    const opened = await openSystemNotificationSettings()
    if (!opened) {
      showFeedback(t('setting.notification.desktop.open_system_settings_failed'), 'warning')
    }
  }

  onMounted(() => {
    void refresh()
    // 从系统设置返回时窗口重新获得焦点，刷新一次以反映真实状态
    window.addEventListener('focus', refresh)
  })

  onUnmounted(() => {
    window.removeEventListener('focus', refresh)
  })

  return { permissionStatus, canOpenSystemSettings, permissionStatusText, refresh, request, openSystemSettings }
}
