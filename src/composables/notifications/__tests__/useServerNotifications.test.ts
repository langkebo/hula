import { beforeEach, describe, expect, it, vi } from 'vitest'

const { mockListActive, mockMarkAsRead, mockDismiss, mockDelete, mockShowFeedback } = vi.hoisted(() => ({
  mockListActive: vi.fn(),
  mockMarkAsRead: vi.fn(),
  mockDismiss: vi.fn(),
  mockDelete: vi.fn(),
  mockShowFeedback: vi.fn()
}))

vi.mock('@/services/matrix/notifications/MatrixServerNotificationService', () => ({
  matrixServerNotificationService: {
    listActive: mockListActive,
    markAsRead: mockMarkAsRead,
    dismiss: mockDismiss,
    delete: mockDelete
  }
}))

vi.mock('@/composables/common/useActionFeedback', () => ({
  useActionFeedback: () => ({
    showFeedback: mockShowFeedback
  })
}))

vi.mock('vue-i18n', () => ({
  useI18n: () => ({
    t: (key: string) => key
  })
}))

import type { ServerNotification } from '@/services/matrix/notifications/MatrixServerNotificationService'
import { useServerNotifications } from '../useServerNotifications'

/** 构造测试用服务器通知 */
function buildNotification(overrides: Partial<ServerNotification> = {}): ServerNotification {
  return {
    id: 1,
    title: '维护公告',
    content: '服务器将于今晚 22:00 维护',
    level: 'info',
    read: false,
    dismissed: false,
    ...overrides
  }
}

describe('useServerNotifications', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('初始状态', () => {
    it('初始时 notifications 为空数组且各标志位为默认值', () => {
      const c = useServerNotifications()
      expect(c.notifications.value).toEqual([])
      expect(c.loading.value).toBe(false)
      expect(c.updating.value).toBe(false)
      expect(c.errorMessage.value).toBeNull()
    })

    it('空列表时计算属性均为空/0/false', () => {
      const c = useServerNotifications()
      expect(c.activeNotifications.value).toEqual([])
      expect(c.unreadNotifications.value).toEqual([])
      expect(c.hasUnread.value).toBe(false)
      expect(c.count.value).toBe(0)
    })
  })

  describe('load', () => {
    it('加载成功时填充 notifications 并清除 loading', async () => {
      const list = [buildNotification({ id: 1 }), buildNotification({ id: 2 })]
      mockListActive.mockResolvedValueOnce(list)

      const c = useServerNotifications()
      await c.load()

      expect(mockListActive).toHaveBeenCalledTimes(1)
      expect(c.notifications.value).toHaveLength(2)
      expect(c.loading.value).toBe(false)
      expect(c.errorMessage.value).toBeNull()
    })

    it('加载失败时设置 errorMessage 并显示错误反馈', async () => {
      mockListActive.mockRejectedValueOnce(new Error('network'))

      const c = useServerNotifications()
      await c.load()

      expect(c.notifications.value).toEqual([])
      expect(c.loading.value).toBe(false)
      expect(c.errorMessage.value).toBe('server_notifications.load_failed')
      expect(mockShowFeedback).toHaveBeenCalledWith('server_notifications.load_failed', 'error')
    })

    it('返回 null 时空数组兜底', async () => {
      mockListActive.mockResolvedValueOnce(null)

      const c = useServerNotifications()
      await c.load()

      expect(c.notifications.value).toEqual([])
      expect(c.loading.value).toBe(false)
    })

    it('加载后按 id 倒序排序', async () => {
      const list = [
        buildNotification({ id: 1, title: '旧' }),
        buildNotification({ id: 3, title: '新' }),
        buildNotification({ id: 2, title: '中' })
      ]
      mockListActive.mockResolvedValueOnce(list)

      const c = useServerNotifications()
      await c.load()

      expect(c.notifications.value.map((n) => n.id)).toEqual([3, 2, 1])
    })

    it('loading 在加载期间为 true,结束后恢复', async () => {
      mockListActive.mockResolvedValueOnce([])
      const c = useServerNotifications()
      const p = c.load()
      expect(c.loading.value).toBe(true)
      await p
      expect(c.loading.value).toBe(false)
    })
  })

  describe('refresh', () => {
    it('refresh 调用 load 重新拉取', async () => {
      mockListActive.mockResolvedValueOnce([])
      const c = useServerNotifications()
      await c.refresh()
      expect(mockListActive).toHaveBeenCalledTimes(1)
    })
  })

  describe('markAsRead', () => {
    it('标记成功时本地同步 read=true 并返回 true', async () => {
      mockListActive.mockResolvedValueOnce([buildNotification({ id: 1, read: false })])
      mockMarkAsRead.mockResolvedValueOnce(true)

      const c = useServerNotifications()
      await c.load()

      const result = await c.markAsRead(1)

      expect(result).toBe(true)
      expect(mockMarkAsRead).toHaveBeenCalledWith(1)
      expect(c.getById(1)?.read).toBe(true)
      expect(mockShowFeedback).toHaveBeenCalledWith('server_notifications.mark_read_success', 'success')
    })

    it('服务返回 false 时返回 false 并显示错误反馈', async () => {
      mockListActive.mockResolvedValueOnce([buildNotification({ id: 1, read: false })])
      mockMarkAsRead.mockResolvedValueOnce(false)

      const c = useServerNotifications()
      await c.load()

      const result = await c.markAsRead(1)

      expect(result).toBe(false)
      expect(c.getById(1)?.read).toBe(false)
      expect(c.errorMessage.value).toBe('server_notifications.mark_read_failed')
      expect(mockShowFeedback).toHaveBeenCalledWith('server_notifications.mark_read_failed', 'error')
    })

    it('抛错时返回 false 并显示错误反馈', async () => {
      mockListActive.mockResolvedValueOnce([buildNotification({ id: 1 })])
      mockMarkAsRead.mockRejectedValueOnce(new Error('forbidden'))

      const c = useServerNotifications()
      await c.load()

      const result = await c.markAsRead(1)

      expect(result).toBe(false)
      expect(c.errorMessage.value).toBe('server_notifications.mark_read_failed')
      expect(c.updating.value).toBe(false)
    })
  })

  describe('markAllAsRead', () => {
    it('无未读时直接返回 true 不调用服务', async () => {
      mockListActive.mockResolvedValueOnce([buildNotification({ id: 1, read: true })])
      const c = useServerNotifications()
      await c.load()

      const result = await c.markAllAsRead()

      expect(result).toBe(true)
      expect(mockMarkAsRead).not.toHaveBeenCalled()
    })

    it('批量标记所有未读成功时本地同步 read=true', async () => {
      mockListActive.mockResolvedValueOnce([
        buildNotification({ id: 1, read: false }),
        buildNotification({ id: 2, read: false }),
        buildNotification({ id: 3, read: true })
      ])
      mockMarkAsRead.mockResolvedValue(true)

      const c = useServerNotifications()
      await c.load()

      const result = await c.markAllAsRead()

      expect(result).toBe(true)
      expect(mockMarkAsRead).toHaveBeenCalledTimes(2)
      expect(mockMarkAsRead).toHaveBeenCalledWith(1)
      expect(mockMarkAsRead).toHaveBeenCalledWith(2)
      expect(c.unreadNotifications.value).toHaveLength(0)
      expect(c.hasUnread.value).toBe(false)
    })

    it('部分失败时返回 false 并显示错误反馈', async () => {
      mockListActive.mockResolvedValueOnce([
        buildNotification({ id: 1, read: false }),
        buildNotification({ id: 2, read: false })
      ])
      mockMarkAsRead.mockResolvedValueOnce(true).mockResolvedValueOnce(false)

      const c = useServerNotifications()
      await c.load()

      const result = await c.markAllAsRead()

      expect(result).toBe(false)
      expect(c.errorMessage.value).toBe('server_notifications.mark_read_failed')
      expect(mockShowFeedback).toHaveBeenCalledWith('server_notifications.mark_read_failed', 'error')
    })
  })

  describe('dismiss', () => {
    it('忽略成功时本地同步 dismissed=true,从 activeNotifications 移除', async () => {
      mockListActive.mockResolvedValueOnce([buildNotification({ id: 1, dismissed: false })])
      mockDismiss.mockResolvedValueOnce(true)

      const c = useServerNotifications()
      await c.load()

      const result = await c.dismiss(1)

      expect(result).toBe(true)
      expect(mockDismiss).toHaveBeenCalledWith(1)
      expect(c.getById(1)?.dismissed).toBe(true)
      expect(c.activeNotifications.value).toHaveLength(0)
      expect(mockShowFeedback).toHaveBeenCalledWith('server_notifications.dismiss_success', 'success')
    })

    it('忽略失败时返回 false 并显示错误反馈', async () => {
      mockListActive.mockResolvedValueOnce([buildNotification({ id: 1 })])
      mockDismiss.mockResolvedValueOnce(false)

      const c = useServerNotifications()
      await c.load()

      const result = await c.dismiss(1)

      expect(result).toBe(false)
      expect(c.errorMessage.value).toBe('server_notifications.dismiss_failed')
    })
  })

  describe('deleteNotification', () => {
    it('删除成功时从列表移除并返回 true', async () => {
      mockListActive.mockResolvedValueOnce([buildNotification({ id: 1 }), buildNotification({ id: 2 })])
      mockDelete.mockResolvedValueOnce(true)

      const c = useServerNotifications()
      await c.load()

      const result = await c.deleteNotification(1)

      expect(result).toBe(true)
      expect(mockDelete).toHaveBeenCalledWith(1)
      expect(c.notifications.value).toHaveLength(1)
      expect(c.getById(1)).toBeUndefined()
      expect(mockShowFeedback).toHaveBeenCalledWith('server_notifications.delete_success', 'success')
    })

    it('删除失败时返回 false 并保留列表', async () => {
      mockListActive.mockResolvedValueOnce([buildNotification({ id: 1 })])
      mockDelete.mockResolvedValueOnce(false)

      const c = useServerNotifications()
      await c.load()

      const result = await c.deleteNotification(1)

      expect(result).toBe(false)
      expect(c.notifications.value).toHaveLength(1)
      expect(c.errorMessage.value).toBe('server_notifications.delete_failed')
    })
  })

  describe('getById', () => {
    it('返回对应 id 的通知', async () => {
      mockListActive.mockResolvedValueOnce([buildNotification({ id: 5, title: '找到我' })])
      const c = useServerNotifications()
      await c.load()

      expect(c.getById(5)?.title).toBe('找到我')
    })

    it('不存在时返回 undefined', async () => {
      mockListActive.mockResolvedValueOnce([buildNotification({ id: 1 })])
      const c = useServerNotifications()
      await c.load()

      expect(c.getById(999)).toBeUndefined()
    })
  })

  describe('computed', () => {
    it('activeNotifications 过滤 dismissed 为 true 的通知', async () => {
      mockListActive.mockResolvedValueOnce([
        buildNotification({ id: 1, dismissed: false }),
        buildNotification({ id: 2, dismissed: true })
      ])
      const c = useServerNotifications()
      await c.load()

      expect(c.activeNotifications.value.map((n) => n.id)).toEqual([1])
    })

    it('unreadNotifications 过滤已读通知', async () => {
      mockListActive.mockResolvedValueOnce([
        buildNotification({ id: 1, read: false }),
        buildNotification({ id: 2, read: true }),
        buildNotification({ id: 3, read: false })
      ])
      const c = useServerNotifications()
      await c.load()

      expect(c.unreadNotifications.value.map((n) => n.id)).toEqual([3, 1])
    })

    it('hasUnread 在有未读时为 true', async () => {
      mockListActive.mockResolvedValueOnce([buildNotification({ id: 1, read: false })])
      const c = useServerNotifications()
      await c.load()

      expect(c.hasUnread.value).toBe(true)
    })

    it('hasUnread 在全部已读时为 false', async () => {
      mockListActive.mockResolvedValueOnce([buildNotification({ id: 1, read: true })])
      const c = useServerNotifications()
      await c.load()

      expect(c.hasUnread.value).toBe(false)
    })

    it('count 等于活跃通知数量', async () => {
      mockListActive.mockResolvedValueOnce([
        buildNotification({ id: 1, dismissed: false }),
        buildNotification({ id: 2, dismissed: false }),
        buildNotification({ id: 3, dismissed: true })
      ])
      const c = useServerNotifications()
      await c.load()

      expect(c.count.value).toBe(2)
    })
  })

  describe('updating 标志', () => {
    it('updating 在 markAsRead 期间为 true,结束后恢复', async () => {
      mockListActive.mockResolvedValueOnce([buildNotification({ id: 1 })])
      let resolveMark: (v: boolean) => void = () => {}
      mockMarkAsRead.mockImplementationOnce(() => new Promise<boolean>((resolve) => (resolveMark = resolve)))

      const c = useServerNotifications()
      await c.load()

      const promise = c.markAsRead(1)
      expect(c.updating.value).toBe(true)

      resolveMark(true)
      await promise

      expect(c.updating.value).toBe(false)
    })
  })
})
