import { onMounted } from 'vue'
import type { RouteLocationRaw } from 'vue-router'
import type { SessionItem } from '@/stores/domains/chat/chat/session'
import { isSecretChatUnlocked } from '@/stores/domains/settings/secretChatSession'
import { openSecretChatUnlock } from './useSecretChatGate'
import { useSecretChatSessions } from './useSecretChatSessions'

/** 移出私密的三种结果：成功 / 用户取消 / 登记表写入失败。 */
export type SecretChatUnmarkOutcome = 'unmarked' | 'cancelled' | 'failed'

/** 私密会话页面的平台差异注入项（列表与加密状态见 `useSecretChatSessions`）。 */
export interface SecretChatPageOptions {
  /** 解锁成功后的回跳目标（桌面 `/secretChat`，移动端 `/mobile/secretChat`）。 */
  returnTarget: RouteLocationRaw
  /** 进入私密会话（两端路由名不同；返回 router.push 的 Promise 亦可）。 */
  openSession: (session: SessionItem) => unknown
  /** 移出私密的二次确认；返回 false 表示用户取消。 */
  confirmUnmark: () => Promise<boolean>
  /** 是否已配置私密密码（移动端在未配置时引导去设置页，桌面端不传）。 */
  isPasswordConfigured?: () => boolean
  /** 未配置私密密码时的兜底动作；仅配合 `isPasswordConfigured` 使用。 */
  onMissingPassword?: () => void
}

/**
 * 私密会话页面的**页面级**公共逻辑。
 *
 * 两端此前各写一份「解锁回跳 + 会话跳转 + 移出私密确认 + 进入页面的锁定兜底」，
 * 其中锁定兜底涉及安全语义（守卫放行后瞬间被锁的竞态），规则调整必须同源。
 * 模板与提示方式保留平台差异，通过 `SecretChatPageOptions` 注入。
 */
export function useSecretChatPage(options: SecretChatPageOptions) {
  const sessions = useSecretChatSessions()

  /** 锁定态点「输入密码继续」：回跳目标仍是本页，解锁后由守卫放行。 */
  const handleUnlockClick = (): void => {
    openSecretChatUnlock(options.returnTarget)
  }

  const handleSessionClick = async (session: SessionItem): Promise<void> => {
    await options.openSession(session)
  }

  /** 移出私密：确认后取消房间登记，失败提示由平台层按返回值决定。 */
  const handleUnmark = async (session: SessionItem): Promise<SecretChatUnmarkOutcome> => {
    if (!(await options.confirmUnmark())) return 'cancelled'
    return (await sessions.unmarkSession(session.roomId)) ? 'unmarked' : 'failed'
  }

  /**
   * 进入页面时的解锁兜底：路由守卫挡的是「进入时未解锁」，但页面停留期间可能触发自动锁。
   *
   * @returns 已解锁（并已完成登记表刷新）时返回 true
   */
  const ensureUnlockedOnEnter = (): boolean => {
    if (!isSecretChatUnlocked()) {
      // 未配置密码时解锁必然失败，移动端改为引导去设置页
      if (options.isPasswordConfigured && options.onMissingPassword && !options.isPasswordConfigured()) {
        options.onMissingPassword()
        return false
      }
      openSecretChatUnlock(options.returnTarget)
      return false
    }
    sessions.refreshPrivateSessions()
    return true
  }

  onMounted(() => {
    ensureUnlockedOnEnter()
  })

  return {
    ...sessions,
    handleUnlockClick,
    handleSessionClick,
    handleUnmark
  }
}
