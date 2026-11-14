import { getCurrentWindow } from '@tauri-apps/api/window'
import { useDialog } from 'naive-ui'
import { useI18n } from 'vue-i18n'
import { useActionFeedback } from '@/composables/common/useActionFeedback'
import { useAccount } from '@/composables/user/useAccount'
import { useSessionActions } from '@/composables/user/useSessionActions'
import { hasTauriRuntime } from '@/utils/AppHarness'
import { createLogger } from '@/utils/Logger'

const logger = createLogger('AccountDeactivation')

/**
 * 账户注销编排：二次确认 → 调用注销接口 → 清理本地会话 → 切换到登录窗口。
 *
 * 注销会让服务端 token 立即失效，`logoutCurrentSession` 内部的 /logout 请求可能返回
 * M_UNKNOWN_TOKEN；本地清理与登录窗口切换不能因此中断，故失败时降级为纯本地重置。
 */
export function useAccountDeactivation() {
  const dialog = useDialog()
  const { t } = useI18n()
  const { showFeedback } = useActionFeedback()
  const { deactivateAccount } = useAccount()
  const { logoutCurrentSession, resetLocalSessionState } = useSessionActions()

  async function leaveDeactivatedSession(): Promise<void> {
    try {
      await logoutCurrentSession()
    } catch (error) {
      logger.warn('注销成功后退出本地会话失败，回退为本地状态重置:', error)
      try {
        await resetLocalSessionState()
      } catch (resetError) {
        logger.error('注销成功后重置本地会话状态失败:', resetError)
      }
    }

    try {
      // 桌面端设置页通常在独立窗口：登录窗口已由 logoutCurrentSession 创建，关闭当前窗口即可；
      // 主窗口（或浏览器环境）回退为整页刷新，与用户菜单退出登录保持一致。
      const currentWindow = getCurrentWindow()
      if (hasTauriRuntime() && currentWindow.label !== 'home') {
        await currentWindow.close()
        return
      }
      window.location.reload()
    } catch (error) {
      logger.warn('注销成功后切换窗口失败:', error)
    }
  }

  function confirmDeactivateAccount(): void {
    const instance = dialog.warning({
      title: t('setting.account.deactivate_confirm_title'),
      content: t('setting.account.deactivate_confirm_content'),
      positiveText: t('setting.common.confirm'),
      negativeText: t('setting.common.cancel'),
      // 注销不可逆：执行期间禁止 ESC / 点击遮罩关闭，只能等待结果或显式取消
      closeOnEsc: false,
      maskClosable: false,
      onPositiveClick: async () => {
        instance.loading = true
        try {
          await deactivateAccount()
        } catch (error) {
          logger.error('注销账户失败:', error)
          showFeedback(t('setting.account.deactivate_failed'), 'error')
          instance.loading = false
          // 重新抛出以阻止弹窗关闭，用户可重试或取消
          throw error
        }
        showFeedback(t('setting.account.deactivate_success'), 'success')
        await leaveDeactivatedSession()
      }
    })
  }

  return { confirmDeactivateAccount }
}
