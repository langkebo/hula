import { useGroupStore } from '@/stores/domains/chat/group'
import { useUserStore } from '@/stores/domains/user/user'
import { AvatarUtils } from '@/utils/AvatarUtils'

/**
 * 统一解析用户头像 URL（"非房间上下文"场景：历史消息、合并转发、机器人消息等）。
 *
 * 规则：自己 → 当前账号头像；他人 → 用户资料/群成员缓存中的头像；
 * 都取不到时交给 `AvatarUtils` 回落到默认头像。
 *
 * 该逻辑曾在 chatHistory / multiMsgWindow / BotMessage 中各写一份，
 * 收敛到此处避免头像回落规则在多处漂移。
 */
export const useUserAvatar = () => {
  const userStore = useUserStore()
  const groupStore = useGroupStore()

  const resolveAvatarUrl = (uid: string): string => {
    const avatar = uid === userStore.userInfo?.uid ? userStore.userInfo?.avatar : groupStore.getUserInfo(uid)?.avatar
    return AvatarUtils.getAvatarUrl(avatar)
  }

  return { resolveAvatarUrl }
}
