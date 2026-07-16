import type { ComputedRef, Ref } from 'vue'
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useActionFeedback } from '@/composables/common/useActionFeedback'
import type { ServerNotification } from '@/services/matrix/notifications/MatrixServerNotificationService'
import { matrixServerNotificationService } from '@/services/matrix/notifications/MatrixServerNotificationService'
import { createLogger } from '@/utils/Logger'

const logger = createLogger('useServerNotifications')

export interface UseServerNotificationsResult {
  notifications: Ref<ServerNotification[]>
  loading: Ref<boolean>
  updating: Ref<boolean>
  errorMessage: Ref<string | null>
  activeNotifications: ComputedRef<ServerNotification[]>
  unreadNotifications: ComputedRef<ServerNotification[]>
  hasUnread: ComputedRef<boolean>
  count: ComputedRef<number>
  load: () => Promise<void>
  refresh: () => Promise<void>
  markAsRead: (id: number) => Promise<boolean>
  markAllAsRead: () => Promise<boolean>
  dismiss: (id: number) => Promise<boolean>
  deleteNotification: (id: number) => Promise<boolean>
  getById: (id: number) => ServerNotification | undefined
}

/**
 * 跨端服务器通知 composable
 *
 * PC 端 ServerNotificationsPanel.vue 与移动端 MobileServerNotifications.vue 共用此逻辑。
 * 封装 synapse-rust 下发的系统通知的拉取、已读、忽略、删除操作,组件保持声明式。
 *
 * 服务层能力来源:
 * - matrixServerNotificationService.listActive()
 * - matrixServerNotificationService.markAsRead(id)
 * - matrixServerNotificationService.dismiss(id)
 * - matrixServerNotificationService.delete(id)
 */
export function useServerNotifications(): UseServerNotificationsResult {
  const { t } = useI18n()
  const { showFeedback } = useActionFeedback()

  const notifications = ref<ServerNotification[]>([])
  const loading = ref(false)
  const updating = ref(false)
  const errorMessage = ref<string | null>(null)

  /** 未被忽略的通知(已忽略的不再展示) */
  const activeNotifications = computed(() => notifications.value.filter((n) => !n.dismissed))

  /** 未读通知(从未被忽略的活跃通知中筛选) */
  const unreadNotifications = computed(() => activeNotifications.value.filter((n) => !n.read))

  const hasUnread = computed(() => unreadNotifications.value.length > 0)

  /** 当前展示的通知数量 */
  const count = computed(() => activeNotifications.value.length)

  /**
   * 按 id 倒序排序
   * 后端 id 单调递增,作为创建时间的代理(实际类型未直接暴露 createdAt)
   */
  function sortByNewest(list: ServerNotification[]): ServerNotification[] {
    return [...list].sort((a, b) => b.id - a.id)
  }

  /**
   * 拉取未过期的服务器通知
   */
  async function load(): Promise<void> {
    loading.value = true
    errorMessage.value = null

    try {
      const list = await matrixServerNotificationService.listActive()
      notifications.value = sortByNewest(list ?? [])
    } catch (err) {
      logger.error('加载服务器通知失败', err)
      errorMessage.value = t('server_notifications.load_failed')
      showFeedback(errorMessage.value as string, 'error')
    } finally {
      loading.value = false
    }
  }

  /**
   * 重新加载通知列表
   */
  async function refresh(): Promise<void> {
    await load()
  }

  /**
   * 标记单条通知为已读
   * @param id 通知 id
   * @returns 是否标记成功
   */
  async function markAsRead(id: number): Promise<boolean> {
    updating.value = true
    errorMessage.value = null

    try {
      const ok = await matrixServerNotificationService.markAsRead(id)
      if (ok) {
        const target = notifications.value.find((n) => n.id === id)
        if (target) {
          target.read = true
        }
        showFeedback(t('server_notifications.mark_read_success'), 'success')
        return true
      }
      errorMessage.value = t('server_notifications.mark_read_failed')
      showFeedback(errorMessage.value as string, 'error')
      return false
    } catch (err) {
      logger.error('标记服务器通知已读失败', err)
      errorMessage.value = t('server_notifications.mark_read_failed')
      showFeedback(errorMessage.value as string, 'error')
      return false
    } finally {
      updating.value = false
    }
  }

  /**
   * 批量标记所有未读通知为已读
   * @returns 是否全部标记成功
   */
  async function markAllAsRead(): Promise<boolean> {
    const unreadIds = unreadNotifications.value.map((n) => n.id)
    if (unreadIds.length === 0) {
      return true
    }

    updating.value = true
    errorMessage.value = null

    try {
      const results = await Promise.all(unreadIds.map((id) => matrixServerNotificationService.markAsRead(id)))
      const allOk = results.every(Boolean)
      if (allOk) {
        for (const id of unreadIds) {
          const target = notifications.value.find((n) => n.id === id)
          if (target) {
            target.read = true
          }
        }
        showFeedback(t('server_notifications.mark_read_success'), 'success')
        return true
      }
      errorMessage.value = t('server_notifications.mark_read_failed')
      showFeedback(errorMessage.value as string, 'error')
      return false
    } catch (err) {
      logger.error('批量标记服务器通知已读失败', err)
      errorMessage.value = t('server_notifications.mark_read_failed')
      showFeedback(errorMessage.value as string, 'error')
      return false
    } finally {
      updating.value = false
    }
  }

  /**
   * 忽略(标记为已处理)通知,本地从 activeNotifications 移除
   * @param id 通知 id
   * @returns 是否忽略成功
   */
  async function dismiss(id: number): Promise<boolean> {
    updating.value = true
    errorMessage.value = null

    try {
      const ok = await matrixServerNotificationService.dismiss(id)
      if (ok) {
        const target = notifications.value.find((n) => n.id === id)
        if (target) {
          target.dismissed = true
        }
        showFeedback(t('server_notifications.dismiss_success'), 'success')
        return true
      }
      errorMessage.value = t('server_notifications.dismiss_failed')
      showFeedback(errorMessage.value as string, 'error')
      return false
    } catch (err) {
      logger.error('忽略服务器通知失败', err)
      errorMessage.value = t('server_notifications.dismiss_failed')
      showFeedback(errorMessage.value as string, 'error')
      return false
    } finally {
      updating.value = false
    }
  }

  /**
   * 删除通知,本地从列表移除
   * @param id 通知 id
   * @returns 是否删除成功
   */
  async function deleteNotification(id: number): Promise<boolean> {
    updating.value = true
    errorMessage.value = null

    try {
      const ok = await matrixServerNotificationService.delete(id)
      if (ok) {
        notifications.value = notifications.value.filter((n) => n.id !== id)
        showFeedback(t('server_notifications.delete_success'), 'success')
        return true
      }
      errorMessage.value = t('server_notifications.delete_failed')
      showFeedback(errorMessage.value as string, 'error')
      return false
    } catch (err) {
      logger.error('删除服务器通知失败', err)
      errorMessage.value = t('server_notifications.delete_failed')
      showFeedback(errorMessage.value as string, 'error')
      return false
    } finally {
      updating.value = false
    }
  }

  /**
   * 从本地列表查找通知
   */
  function getById(id: number): ServerNotification | undefined {
    return notifications.value.find((n) => n.id === id)
  }

  return {
    notifications,
    loading,
    updating,
    errorMessage,
    activeNotifications,
    unreadNotifications,
    hasUnread,
    count,
    load,
    refresh,
    markAsRead,
    markAllAsRead,
    dismiss,
    deleteNotification,
    getById
  }
}
