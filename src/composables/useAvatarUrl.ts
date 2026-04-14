import { computed } from 'vue'
import { AvatarUtils } from '@/utils/AvatarUtils'

export function useAvatarUrl(avatarUrl: Ref<string | undefined | null>) {
  return computed(() => {
    if (avatarUrl.value) {
      return AvatarUtils.getAvatarUrl(avatarUrl.value)
    }
    return undefined
  })
}

export function useRoomAvatar(room: Ref<{ avatarUrl?: string | null; roomId?: string; name?: string } | null>) {
  return computed(() => {
    if (!room.value) return undefined
    if (room.value.avatarUrl) {
      return AvatarUtils.getAvatarUrl(room.value.avatarUrl)
    }
    return undefined
  })
}

import type { Ref } from 'vue'
