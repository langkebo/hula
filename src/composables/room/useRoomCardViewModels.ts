import { computed, type MaybeRefOrGetter, toValue, watch } from 'vue'
import type { RoomCardViewModel } from '@/components/room/RoomCardItem.vue'
import type { RoomTypeEnum } from '@/enums'
import type { MatrixGroupInfo } from '@/stores/domains/chat/group/types'

interface UseRoomCardViewModelsOptions {
  groupInfoMap: Record<string, MatrixGroupInfo>
  loadGroupInfo: (roomId: string) => Promise<MatrixGroupInfo | null>
}

interface SessionLike {
  roomId: string
  name: string
  avatar?: string
  unreadCount: number
  top?: boolean
  type: number
}

export function useRoomCardViewModels(
  sessions: MaybeRefOrGetter<SessionLike[]>,
  options: UseRoomCardViewModelsOptions
) {
  const roomCardViewModels = computed<RoomCardViewModel[]>(() => {
    const sessionList = toValue(sessions)
    return sessionList.map((session) => {
      const groupInfo = options.groupInfoMap[session.roomId]
      return buildViewModel(session, groupInfo)
    })
  })

  const buildViewModel = (session: SessionLike, groupInfo: MatrixGroupInfo | undefined): RoomCardViewModel => {
    const memberCount = groupInfo?.memberCount ?? groupInfo?.memberNum ?? 0
    const onlineCount = groupInfo?.onlineCount ?? 0
    const topic = groupInfo?.topic ?? undefined
    const isEncrypted = groupInfo?.isEncrypted ?? false
    const _isPublic = groupInfo?.isPublic ?? true
    const creator = groupInfo?.creator ?? null

    const isFederated = checkFederated(session.roomId, creator)

    return {
      roomId: session.roomId,
      name: groupInfo?.name || session.name,
      avatar: groupInfo?.avatar || session.avatar,
      topic,
      memberCount,
      onlineCount,
      unreadCount: session.unreadCount ?? 0,
      isFederated,
      isEncrypted,
      isPinned: Boolean(session.top),
      roomType: session.type as RoomTypeEnum
    }
  }

  const checkFederated = (roomId: string, creator: string | null): boolean => {
    if (!creator) return false
    const homeserver = roomId.split(':')[1]
    const creatorHomeserver = creator.split(':')[1]
    return Boolean(homeserver && creatorHomeserver && homeserver !== creatorHomeserver)
  }

  const ensureGroupInfoLoaded = () => {
    const sessionList = toValue(sessions)
    for (const session of sessionList) {
      if (!options.groupInfoMap[session.roomId]) {
        void options.loadGroupInfo(session.roomId).catch(() => {
          // 加载失败静默处理，卡片仍可显示 session 基础信息
        })
      }
    }
  }

  watch(
    () => toValue(sessions).map((s) => s.roomId),
    () => {
      ensureGroupInfoLoaded()
    },
    { immediate: true }
  )

  return {
    roomCardViewModels
  }
}
