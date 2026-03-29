import { createSharedComposable } from '@vueuse/core'
import { ref, readonly } from 'vue'

export type NotificationPermission = 'granted' | 'denied' | 'default' | 'unsupported'

const useSharedNotificationPermission = createSharedComposable(() => {
  const permission = ref<NotificationPermission>('default')
  const isSupported = ref(false)

  async function checkPermission(): Promise<NotificationPermission> {
    if (!('Notification' in window)) {
      isSupported.value = false
      permission.value = 'unsupported'
      return 'unsupported'
    }

    isSupported.value = true

    if (Notification.permission === 'granted') {
      permission.value = 'granted'
    } else if (Notification.permission === 'denied') {
      permission.value = 'denied'
    } else {
      permission.value = 'default'
    }

    return permission.value
  }

  async function requestPermission(): Promise<NotificationPermission> {
    if (!('Notification' in window)) {
      permission.value = 'unsupported'
      return 'unsupported'
    }

    try {
      const result = await Notification.requestPermission()
      permission.value = result as NotificationPermission
      return permission.value
    } catch (err) {
      console.warn('[NotificationPermission] 请求权限失败:', err)
      permission.value = 'denied'
      return 'denied'
    }
  }

  async function initialize() {
    await checkPermission()
  }

  initialize()

  return {
    permission: readonly(permission),
    isSupported: readonly(isSupported),
    checkPermission,
    requestPermission
  }
})

export function useNotificationPermission() {
  return useSharedNotificationPermission()
}

export default useNotificationPermission
