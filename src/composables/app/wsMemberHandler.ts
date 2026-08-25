import { RoomTypeEnum } from '@/enums'
import type { UserItem } from '@/services/types.ts'
import type { useSessionStore } from '@/stores/domains/chat/chat/session'
import type { useGroupStore } from '@/stores/domains/chat/group'
import type { MatrixRoomMember } from '@/stores/domains/chat/group/types.ts'
import type { useUserStore } from '@/stores/domains/user/user'
import type { useGlobalStore } from '@/stores/domains/widget/global'
import { createLogger } from '@/utils/Logger'
import { normalizeMatrixUserId } from '@/utils/userIdentity'

const logger = createLogger('WsMemberHandler')

interface MemberHandlerDeps {
  userStore: ReturnType<typeof useUserStore>
  sessionStore: ReturnType<typeof useSessionStore>
  groupStore: ReturnType<typeof useGroupStore>
  globalStore: ReturnType<typeof useGlobalStore>
}

/**
 * 群成员变更逻辑：处理本人/他人在群聊中的加入与退出，
 * 联动 sessionStore 与 groupStore 的数据。
 */
export function createMemberHandler(deps: MemberHandlerDeps) {
  const { userStore, sessionStore, groupStore, globalStore } = deps

  const isSelfUser = (uid: string): boolean => {
    return uid === (userStore.userInfo?.uid ?? '')
  }

  const handleSelfRemove = async (roomId: string) => {
    logger.info('本人退出群聊，移除会话数据')
    sessionStore.removeSession(roomId)
    groupStore.removeAllUsers(roomId)
    if (globalStore.currentSessionRoomId === roomId) {
      globalStore.updateCurrentSessionRoomId(sessionStore.sessionList[0].roomId)
    }
  }

  const handleOtherMemberRemove = async (uid: string, roomId: string) => {
    logger.info('群成员退出群聊，移除群内的成员数据')
    groupStore.removeUserItem(uid, roomId)
  }

  const handleMemberRemove = async (userList: UserItem[], roomId: string) => {
    for (const user of userList) {
      if (isSelfUser(user.uid)) {
        await handleSelfRemove(roomId)
      } else {
        await handleOtherMemberRemove(user.uid, roomId)
      }
    }
  }

  const handleOtherMemberAdd = async (user: UserItem, roomId: string) => {
    logger.info('群成员加入群聊，添加群成员数据')
    // WS 推送的 uid 可能是 localpart，规范化为完整 MXID，
    // 避免与 SDK 来源成员（完整 MXID）形成同人的两条记录。
    const normalizedUid = normalizeMatrixUserId(user.uid, userStore.userInfo?.uid)
    const matrixMember: MatrixRoomMember = {
      ...user,
      uid: normalizedUid || user.uid,
      userId: normalizedUid || user.uid,
      displayName: user.name,
      avatarUrl: user.avatar,
      membership: 'join',
      powerLevel: 0,
      isModerator: false,
      isCreator: false,
      roleId: 2
    }
    groupStore.addUserItem(matrixMember, roomId)
  }

  const handleSelfAdd = async (userList: UserItem[], roomId: string) => {
    // 本人通过 WS 加入房间：按成员数推导类型（2 人=单聊，其余=群聊），
    // 单聊时用「除自己外的另一名成员」填充 detailId/account，保证下游 counterpart 去重生效，
    // 避免同一联系人的 DM 在消息列表重复出现。
    const isDm = userList.length === 2
    const counterpartRaw = isDm ? userList.find((u) => !isSelfUser(u.uid))?.uid : undefined
    const counterpart = counterpartRaw
      ? normalizeMatrixUserId(counterpartRaw, userStore.userInfo?.uid) || counterpartRaw
      : undefined
    logger.info('本人加入会话，加载会话数据', { roomId, isDm, counterpart })
    await sessionStore.addSession({
      roomId,
      name: roomId,
      type: isDm ? RoomTypeEnum.SINGLE : RoomTypeEnum.GROUP,
      ...(counterpart ? { detailId: counterpart, account: counterpart } : {}),
      unreadCount: 0,
      activeTime: Date.now()
    })
    if (!isDm) {
      try {
        await groupStore.getGroupUserList(roomId, true)
      } catch (error) {
        logger.error('初始化群成员失败:', error)
      }
    }
  }

  const handleMemberAdd = async (userList: UserItem[], roomId: string) => {
    for (const user of userList) {
      if (isSelfUser(user.uid)) {
        await handleSelfAdd(userList, roomId)
      } else {
        await handleOtherMemberAdd(user, roomId)
      }
    }
  }

  return {
    handleMemberRemove,
    handleMemberAdd
  }
}
