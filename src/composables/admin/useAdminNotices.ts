import { type Ref, ref } from 'vue'
import { adminService } from '@/services/matrix/admin'
import type { ServerNoticeInfo } from '@/services/matrix/admin/AdminTypes'

export interface UseAdminNoticesResult {
  notices: Ref<ServerNoticeInfo[]>
  loading: Ref<boolean>
  sending: Ref<boolean>

  loadNotices: (limit?: number) => Promise<void>
  sendNotice: (userId: string, body: string) => Promise<void>
}

/**
 * Admin server-notices composable.
 *
 * Owns state + orchestration for the server-notices management page.
 * Wraps `adminService.getServerNotices` + `sendServerNotice` so desktop /
 * mobile views render the same sending UX and the view just exposes a form.
 */
export function useAdminNotices(): UseAdminNoticesResult {
  const notices = ref<ServerNoticeInfo[]>([])
  const loading = ref(false)
  const sending = ref(false)

  async function loadNotices(limit = 50) {
    loading.value = true
    try {
      const result = await adminService.getServerNotices(limit)
      notices.value = result?.notices ?? []
    } finally {
      loading.value = false
    }
  }

  async function sendNotice(userId: string, body: string) {
    sending.value = true
    try {
      await adminService.sendServerNotice(userId, {
        msgtype: 'm.text',
        body
      })
      await loadNotices()
    } finally {
      sending.value = false
    }
  }

  return {
    notices,
    loading,
    sending,
    loadNotices,
    sendNotice
  }
}
