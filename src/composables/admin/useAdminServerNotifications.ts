import { type Ref, ref } from 'vue'
import { adminService, type SystemNotificationInfo } from '@/services/matrix/admin'

/** 创建 / 编辑系统通知时页面收集的草稿字段。 */
interface SystemNotificationDraft {
  content: string
  type: string
  targetUsers: string[]
}

interface UseAdminServerNotificationsResult {
  notifications: Ref<SystemNotificationInfo[]>
  loading: Ref<boolean>
  error: Ref<string | null>
  saving: Ref<boolean>
  removingId: Ref<string | null>

  loadNotifications: () => Promise<void>
  loadDetail: (notificationId: string) => Promise<SystemNotificationInfo | null>
  createNotification: (draft: SystemNotificationDraft) => Promise<boolean>
  updateNotification: (notificationId: string, draft: SystemNotificationDraft) => Promise<boolean>
  removeNotification: (notificationId: string) => Promise<boolean>
}

function toMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err)
}

/**
 * 系统通知管理 composable。
 *
 * 复用 `AdminServerNotificationService`（7 条系统通知端点），供后台「系统通知」tab 使用，
 * 与「用户通知设置」页保持分区。
 */
export function useAdminServerNotifications(): UseAdminServerNotificationsResult {
  const notifications = ref<SystemNotificationInfo[]>([])
  const loading = ref(false)
  const error = ref<string | null>(null)
  const saving = ref(false)
  const removingId = ref<string | null>(null)

  async function loadNotifications(): Promise<void> {
    loading.value = true
    error.value = null
    try {
      const page = await adminService.serverNotifications.getSystemNotifications(50, undefined, true)
      notifications.value = page.notifications
    } catch (err) {
      notifications.value = []
      error.value = toMessage(err)
    } finally {
      loading.value = false
    }
  }

  async function loadDetail(notificationId: string): Promise<SystemNotificationInfo | null> {
    error.value = null
    try {
      return await adminService.serverNotifications.getSystemNotification(notificationId, true)
    } catch (err) {
      error.value = toMessage(err)
      return null
    }
  }

  async function createNotification(draft: SystemNotificationDraft): Promise<boolean> {
    saving.value = true
    error.value = null
    try {
      const targets = draft.targetUsers.map((item) => item.trim()).filter(Boolean)
      await adminService.serverNotifications.createSystemNotification(
        draft.content.trim(),
        draft.type,
        targets.length > 0 ? targets : undefined
      )
      await loadNotifications()
      return true
    } catch (err) {
      error.value = toMessage(err)
      return false
    } finally {
      saving.value = false
    }
  }

  async function updateNotification(notificationId: string, draft: SystemNotificationDraft): Promise<boolean> {
    saving.value = true
    error.value = null
    try {
      await adminService.serverNotifications.updateSystemNotification(notificationId, {
        content: draft.content.trim(),
        type: draft.type,
        target_users: draft.targetUsers.map((item) => item.trim()).filter(Boolean)
      })
      await loadNotifications()
      return true
    } catch (err) {
      error.value = toMessage(err)
      return false
    } finally {
      saving.value = false
    }
  }

  async function removeNotification(notificationId: string): Promise<boolean> {
    removingId.value = notificationId
    error.value = null
    try {
      await adminService.serverNotifications.deleteSystemNotification(notificationId)
      await loadNotifications()
      return true
    } catch (err) {
      error.value = toMessage(err)
      return false
    } finally {
      removingId.value = null
    }
  }

  return {
    notifications,
    loading,
    error,
    saving,
    removingId,
    loadNotifications,
    loadDetail,
    createNotification,
    updateNotification,
    removeNotification
  }
}
