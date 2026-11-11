import { storeToRefs } from 'pinia'
import { computed, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import {
  isPrivateRoom,
  loadPrivateRoomRegistry,
  migrateFromHiddenSessions
} from '@/services/matrix/privateChat/privateRoomRegistry'
import { type SessionItem, useSessionStore } from '@/stores/domains/chat/chat/session'
import { useSecretChatSession } from '@/stores/domains/settings/secretChatSession'
import { usePrivateRoomEncryption } from './usePrivateRoomEncryption'

/**
 * 私密会话列表视图模型（桌面 `SecretChatPage` 与移动端 `secretChat/SecretChatPage` 共用）。
 *
 * 之所以单独抽出来：两端此前各写了一份「锁定态清空 + isPrivateRoom 过滤 + 加密状态批量刷新
 * + 历史 hide 迁移」，规则调整要改两处，已经出现漂移风险。事实源仍是
 * `services/matrix/privateChat/privateRoomRegistry`（唯一登记表），本 composable 只做视图层聚合，
 * 不新增任何协议/存储实现。
 */
export const useSecretChatSessions = () => {
  const { t } = useI18n()
  const sessionStore = useSessionStore()
  const { sessionList } = storeToRefs(sessionStore)

  /**
   * 解锁态取自单例的响应式 computed（`isUnlocked`），不用事件：
   * 自动锁 / 重启 / 其它窗口上锁都能立刻反映到锁定态。
   */
  const { isUnlocked } = useSecretChatSession()
  const locked = computed(() => !isUnlocked.value)

  const hiddenSessions = computed(() => {
    // 锁定态一律返回空数组：即使模板被改坏，也不可能把会话名泄漏出去
    if (locked.value) return []
    // 数据源是房间级登记表（不再依赖 session.hide —— 那只代表展示态）
    return sessionList.value.filter((session: SessionItem) => isPrivateRoom(session.roomId))
  })

  const { refresh: refreshEncryption, isEncrypted } = usePrivateRoomEncryption()

  /** 列表变化时批量刷新加密状态；锁定态列表为空，快照随之清空。 */
  watch(
    // map() 每次求值都返回新数组，直接 watch 会因引用变化在无关更新时重复整批查询；
    // 用 join 后的字符串做稳定 key，只有房间集合真正变化才触发。
    () => hiddenSessions.value.map((session: SessionItem) => session.roomId).join('\n'),
    () => {
      void refreshEncryption(hiddenSessions.value.map((session: SessionItem) => session.roomId))
    },
    { immediate: true }
  )

  /** 行内容的无障碍描述（含未读）。文案走 i18n，避免模板里堆中文。 */
  const sessionAriaLabel = (session: SessionItem) =>
    session.unreadCount > 0
      ? `${session.name} ${t('home.secret_chat.unread_badge', { count: session.unreadCount })}`
      : session.name

  /**
   * 刷新登记表 + 把历史 `session.hide` 会话一次性迁入（幂等）。
   *
   * 只在**已解锁**时执行：登记表内容本身也算私密信息（哪些房间被标记），
   * 锁定态下不该去拉取。
   */
  const refreshPrivateSessions = () => {
    void loadPrivateRoomRegistry()
    void migrateFromHiddenSessions(
      sessionList.value.filter((session: SessionItem) => session.hide).map((session: SessionItem) => session.roomId)
    )
  }

  // 原地解锁后要补一次登记表加载：页面 onMounted 在锁定态会直接 return
  watch(isUnlocked, (value) => {
    if (value) refreshPrivateSessions()
  })

  return { locked, hiddenSessions, isEncrypted, sessionAriaLabel, refreshPrivateSessions }
}
