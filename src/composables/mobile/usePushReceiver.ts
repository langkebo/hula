// src/composables/mobile/usePushReceiver.ts

import { isPermissionGranted, requestPermission as requestTauriPermission } from '@tauri-apps/plugin-notification'
import { ref } from 'vue'

export interface NotificationItem {
  id: string
  title: string
  body: string
  timestamp: number
  data?: Record<string, unknown>
}

export function usePushReceiver() {
  const notifications = ref<NotificationItem[]>([])
  const hasPermission = ref(false)

  isPermissionGranted().then((granted) => {
    hasPermission.value = granted
  })

  function receivePush(item: Omit<NotificationItem, 'timestamp'> & { timestamp?: number }) {
    notifications.value = [...notifications.value, { ...item, timestamp: item.timestamp || Date.now() }]
  }

  function removeNotification(id: string) {
    notifications.value = notifications.value.filter((n) => n.id !== id)
  }

  function clearAll() {
    notifications.value = []
  }

  async function requestPermission() {
    const result = await requestTauriPermission()
    hasPermission.value = result === 'granted'
    return result
  }

  return {
    notifications,
    hasPermission,
    receivePush,
    removeNotification,
    clearAll,
    requestPermission
  }
}
