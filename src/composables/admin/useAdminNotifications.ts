import { type Ref, ref } from 'vue'
import { adminService } from '@/services/matrix/admin'

export interface UseAdminNotificationsResult {
  notificationSettings: Ref<Record<string, unknown> | null>
  settingsLoading: Ref<boolean>
  pushers: Ref<Array<Record<string, unknown>>>
  pushersLoading: Ref<boolean>
  saving: Ref<boolean>

  loadNotificationSettings: (userId: string) => Promise<void>
  saveNotificationSettings: (userId: string, settings: Record<string, unknown>) => Promise<boolean>
  loadPushers: (userId: string) => Promise<void>
  deletePusher: (userId: string, pushkey: string, appId: string) => Promise<boolean>
}

export function useAdminNotifications(): UseAdminNotificationsResult {
  const notificationSettings = ref<Record<string, unknown> | null>(null)
  const settingsLoading = ref(false)
  const pushers = ref<Array<Record<string, unknown>>>([])
  const pushersLoading = ref(false)
  const saving = ref(false)

  async function loadNotificationSettings(userId: string) {
    settingsLoading.value = true
    try {
      notificationSettings.value = await adminService.getUserNotificationSettings(userId)
    } finally {
      settingsLoading.value = false
    }
  }

  async function saveNotificationSettings(userId: string, settings: Record<string, unknown>): Promise<boolean> {
    saving.value = true
    try {
      await adminService.setUserNotificationSettings(userId, settings)
      notificationSettings.value = settings
      return true
    } finally {
      saving.value = false
    }
  }

  async function loadPushers(userId: string) {
    pushersLoading.value = true
    try {
      pushers.value = await adminService.getUserPushers(userId)
    } finally {
      pushersLoading.value = false
    }
  }

  async function deletePusher(userId: string, pushkey: string, appId: string): Promise<boolean> {
    await adminService.deleteUserPusher(userId, pushkey, appId)
    await loadPushers(userId)
    return true
  }

  return {
    notificationSettings,
    settingsLoading,
    pushers,
    pushersLoading,
    saving,
    loadNotificationSettings,
    saveNotificationSettings,
    loadPushers,
    deletePusher
  }
}
