import { useChatStore } from '@/stores/chat'
import { useGroupStore } from '@/stores/group'
import { useUserStore } from '@/stores/user.ts'
import { matrixRoomService } from '@/services/matrix'

type UpdatePayload = {
  roomId: string
  myName: string
  remark: string
}

export const useMyRoomInfoUpdater = () => {
  const chatStore = useChatStore()
  const groupStore = useGroupStore()
  const userStore = useUserStore()

  const persistMyRoomInfo = async ({ roomId, myName, remark }: UpdatePayload) => {
    await matrixRoomService.setMemberDisplayName(roomId, myName)

    groupStore.myNameInCurrentGroup = myName
    if (groupStore.countInfo) {
      groupStore.countInfo.remark = remark
    }
    chatStore.updateSession(roomId, { remark })
  }

  const resolveMyRoomNickname = ({ roomId, myName }: { roomId?: string; myName?: string }) => {
    if (myName) {
      return myName
    }
    if (!roomId) {
      return ''
    }
    const currentUid = userStore.userInfo?.uid
    if (!currentUid) {
      return ''
    }
    const currentUser = groupStore.getUser(roomId, currentUid) ?? groupStore.getUserInfo(currentUid, roomId)
    return currentUser?.name || userStore.userInfo?.name || ''
  }

  return {
    persistMyRoomInfo,
    resolveMyRoomNickname
  }
}
