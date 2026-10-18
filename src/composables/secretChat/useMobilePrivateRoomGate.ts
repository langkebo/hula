import { useRouter } from 'vue-router'
import { useActionFeedback } from '@/composables/common/useActionFeedback'
import { openSecretChatUnlock } from '@/composables/secretChat/useSecretChatGate'
import { useI18nGlobal } from '@/services/i18n'
import { ensurePrivateRoomRegistryReady, isPrivateRoom } from '@/services/matrix/privateChat/privateRoomRegistry'
import { useSessionStore } from '@/stores/domains/chat/chat/session'
import { isSecretChatUnlocked } from '@/stores/domains/settings/secretChatSession'
import { useSettingStore } from '@/stores/domains/settings/setting'
import { useGlobalStore } from '@/stores/domains/widget/global'
import { createLogger } from '@/utils/Logger'

const logger = createLogger('MobilePrivateRoomGate')

/** 被拦下后回到的消息列表（移动端）。 */
const MOBILE_MESSAGE_LIST = '/mobile/message'

/**
 * 移动端「进入房间」的私密门禁。
 *
 * 为什么不能像桌面那样放进 `router.beforeEach`：移动端聊天路由是
 * `/mobile/chatRoom/chatMain/:uid?`，参数是**对端 uid 而不是 roomId**，
 * 而 `secretChatGuard.extractRoomId` 只认 `message` / `windowChat` 两条路由的 `:roomId`，
 * 于是移动端这条路径**整个绕过门禁**（通知点击可直达私密房）。
 *
 * 所以改在聊天布局层（`ChatRoomLayout`）解析出房间号后再判，覆盖：
 * 会话列表点击、通知点击、以及冷启动深链（此时 currentSessionRoomId 可能为空，
 * 用 uid 反查会话拿 roomId）。
 */
export function useMobilePrivateRoomGate() {
  const router = useRouter()
  const sessionStore = useSessionStore()
  const settingStore = useSettingStore()
  const globalStore = useGlobalStore()

  /** 用对端 uid 反查房间号（冷启动深链时 currentSessionRoomId 还没被设置）。 */
  function resolveRoomIdByPeer(uid: string | undefined): string | null {
    if (!uid) return null
    const session = sessionStore.sessionList.find((item) => item.detailId === uid || item.account === uid)
    return session?.roomId ?? null
  }

  // 收「已翻译文案」而不是 key：key 必须在调用点以 t('...') 形式出现，
  // 否则 `check:i18n-dead-keys` 看不到引用，会把活文案判成孤儿（本仓已踩过）。
  const notify = (message: string) => {
    useActionFeedback().showFeedback(message, 'warning')
  }

  /**
   * 判断是否允许进入当前房间，拦下时由本函数完成重定向并提示。
   *
   * @returns `true` = 放行；`false` = 已拦下
   */
  async function assertAccess(uid?: string): Promise<boolean> {
    try {
      // 冷启动时登记表可能还没按当前账号加载，此时 isPrivateRoom 读的是 anonymous 缓存 →
      // 私密房会被当普通房放行。必须先等它加载完。
      await ensurePrivateRoomRegistryReady()
    } catch (err) {
      // 无法判定是否私密房时**不放行**：宁可拦错也不能漏。
      // 但必须给提示，否则用户只看到「点了又弹回列表」，像 bug。
      logger.error('加载私密房登记表失败，阻止进入房间:', err)
      notify(useI18nGlobal().t('home.secret_chat.registry_unavailable'))
      await router.replace(MOBILE_MESSAGE_LIST)
      return false
    }

    // 两个候选都要看，不能只看 currentSessionRoomId：
    // 通知点击时它可能还停在上一个**普通房**，只按它判会把私密房放行。
    const candidates = [globalStore.currentSessionRoomId, resolveRoomIdByPeer(uid)].filter((id): id is string => !!id)
    const privateRoomId = candidates.find((id) => isPrivateRoom(id)) ?? null
    if (!privateRoomId) return true
    if (isSecretChatUnlocked()) return true

    // 私密房存在但当前账号没有密码配置 = 数据不一致（换设备 / 清除过密码）。
    // 不放行，否则私密房会退化成普通房。
    if (!settingStore.isSecretChatConfigured()) {
      logger.warn(`私密房间 ${privateRoomId} 无可用密码配置，已拦截进入`)
      notify(useI18nGlobal().t('home.secret_chat.no_password'))
      await router.replace(MOBILE_MESSAGE_LIST)
      return false
    }

    openSecretChatUnlock(MOBILE_MESSAGE_LIST)
    await router.replace(MOBILE_MESSAGE_LIST)
    return false
  }

  return { assertAccess, resolveRoomIdByPeer }
}
