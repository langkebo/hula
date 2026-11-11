import { showDialog, showToast } from 'vant'
import { ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'
import { useSessionActions } from '@/composables/user/useSessionActions'
import { useSettingStore } from '@/stores/domains/settings/setting'
import { useGlobalStore } from '@/stores/domains/widget/global'
import { createLogger } from '@/utils/Logger'

/**
 * 移动端登出（**唯一入口**）。
 *
 * 必须走 `useSessionActions().logoutCurrentSession`（SessionOrchestrator 的显式清理），
 * 不能直接调 `matrixClientService.logout()` —— 后者只拆 SDK 客户端，会漏掉
 * sessionUnread、DND 镜像与邀请策略缓存（整分支评审 I3 的结论）。
 *
 * 抽出来的原因：此前「我的」首屏与设置页各写了一份登出逻辑（一个走 useSessionActions、
 * 一个走 useLoginFlow），行为一致但路径分叉，改动容易只改一处。现在只有一个实现。
 */
export function useMobileLogout() {
  const { t } = useI18n()
  const router = useRouter()
  const settingStore = useSettingStore()
  const globalStore = useGlobalStore()
  const { logoutCurrentSession } = useSessionActions()
  const logger = createLogger('MobileLogout')

  const isLoggingOut = ref(false)

  async function handleLogout(): Promise<void> {
    if (isLoggingOut.value) return

    try {
      await showDialog({
        title: t('mobile_setting.logout_confirm.title'),
        message: t('mobile_setting.logout_confirm.message'),
        showCancelButton: true,
        confirmButtonText: t('mobile_setting.logout_confirm.confirm'),
        cancelButtonText: t('mobile_setting.logout_confirm.cancel')
      })
    } catch {
      return // 用户取消
    }

    isLoggingOut.value = true
    try {
      await logoutCurrentSession()
      settingStore.toggleLogin(false, false)
      globalStore.isTrayMenuShow = false
      showToast({ type: 'success', message: t('mobile_setting.logout_success') })
      await router.push('/mobile/login')
    } catch (error) {
      logger.error('Logout failed:', error)
      showToast({ type: 'fail', message: t('mobile_setting.logout_failed') })
    } finally {
      isLoggingOut.value = false
    }
  }

  return { isLoggingOut, handleLogout }
}
