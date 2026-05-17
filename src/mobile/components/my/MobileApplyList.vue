<template>
  <div class="select-none flex flex-col">
    <div
      v-if="props.closeHeader === true ? false : true"
      class="flex items-center justify-between color-[--hula-text-primary] px-20px py-10px">
      <p class="text-16px">
        {{
          props.type === 'friend' ? t('mobile_mymessage.notification.friend') : t('mobile_mymessage.notification.group')
        }}
      </p>
      <svg class="size-18px cursor-pointer">
        <use href="#delete"></use>
      </svg>
    </div>

    <div
      :style="{
        maxHeight: props.customHeight ? props.customHeight + 'px' : 'calc(100vh / var(--page-scale, 1) - 80px)',
        overflowY: 'auto'
      }"
      @scroll="handleScroll"
      ref="scrollRef">
      <div v-for="item in applyList" :key="item.applyId" class="flex gap-2 w-full text-14px mb-15px">
        <div class="flex h-full">
          <img
            class="w-40px h-40px rounded-full object-cover flex-shrink-0"
            :src="
              props.type === 'friend'
                ? avatarSrc(getUserInfo(item)?.avatar || '')
                : avatarSrc(groupDetailsMap[item.roomId ?? '']?.avatar || '/default-group-avatar.png')
            " />
        </div>
        <div class="flex-1 flex flex-col gap-10px min-w-0">
          <div
            @click="
              isCurrentUser(item.senderId || '')
                ? (currentUserId = item.operateId || '')
                : (currentUserId = item.senderId || '')
            "
            class="flex justify-between text-14px text-[--hula-color-primary-500]">
            {{ getUserInfo(item)?.name || t('mobile_mymessage.unknown_user') }}
          </div>
          <div class="flex text-gray-500 text-12px min-w-0">
            <span class="truncate w-full block">
              {{ applyMsg(item) }}
            </span>
          </div>
          <div v-if="isFriendApplyOrGroupInvite(item)" class="flex gap-2 flex-1 text-12px text-gray-500 min-w-0">
            <div class="whitespace-nowrap flex-shrink-0">{{ t('mobile_mymessage.message_label') }}</div>
            <span
              class="flex-1 min-w-0 line-clamp-1"
              style="max-width: 100%"
              @click="($event.target as HTMLElement)?.classList?.toggle('line-clamp-1')">
              {{ item.content }}
            </span>
          </div>
          <div v-else class="flex gap-2 flex-1 text-12px text-gray-500 min-w-0">
            <div class="whitespace-nowrap flex-shrink-0">{{ t('mobile_mymessage.handler_label') }}</div>
            <span
              class="flex-1 min-w-0 line-clamp-1"
              style="max-width: 100%"
              @click="($event.target as HTMLElement)?.classList?.toggle('line-clamp-1')">
              {{ groupStore.getUserInfo(item.senderId || '')?.name || t('mobile_mymessage.unknown_user') }}
            </span>
          </div>
        </div>
        <div
          v-if="isFriendApplyOrGroupInvite(item)"
          class="flex min-w-70px w-70px max-h-64px flex-col items-center justify-center flex-shrink-0">
          <div
            class="flex items-center gap-10px"
            v-if="item.status === RequestNoticeAgreeStatus.UNTREATED && !isCurrentUser(item.senderId || '')">
            <van-button size="small" plain :loading="loadingMap[item.applyId]" @click="handleAgree(item)">
              {{ t('mobile_mymessage.accept') }}
            </van-button>
          </div>
          <van-popover
            trigger="click"
            :actions="popoverActions"
            @select="(action: { value: string }) => handleFriendAction(action.value, item.applyId)"
            v-if="item.status === RequestNoticeAgreeStatus.UNTREATED && !isCurrentUser(item.senderId || '')">
            <template #reference>
              <div
                class="cursor-pointer px-15px py-3px rounded-5px mt-10px bg-gray-300 h-50% flex items-center justify-center">
                <svg class="size-16px color-[--hula-text-primary]">
                  <use href="#more"></use>
                </svg>
              </div>
            </template>
          </van-popover>
          <span
            class="text-(12px [--hula-color-primary-400])"
            v-else-if="item.status === RequestNoticeAgreeStatus.ACCEPTED">
            {{ t('mobile_mymessage.approved') }}
          </span>
          <span
            class="text-(12px [--hula-color-danger-500])"
            v-else-if="item.status === RequestNoticeAgreeStatus.REJECTED">
            {{ t('mobile_mymessage.refused') }}
          </span>
          <span class="text-(12px [--hula-text-tertiary])" v-else-if="item.status === RequestNoticeAgreeStatus.IGNORE">
            {{ t('mobile_mymessage.ignored') }}
          </span>
          <span
            class="text-(12px [--hula-color-primary-400])"
            :class="{ 'text-(12px [--hula-color-danger-500])': item.status === RequestNoticeAgreeStatus.REJECTED }"
            v-else-if="isCurrentUser(item.senderId || '')">
            {{
              isAccepted(item)
                ? t('mobile_mymessage.agreed')
                : item.status === RequestNoticeAgreeStatus.REJECTED
                  ? t('mobile_mymessage.declined')
                  : t('mobile_mymessage.pending')
            }}
          </span>
        </div>
      </div>
    </div>

    <div v-if="applyList.length === 0" class="flex flex-col items-center justify-center py-40px">
      <van-empty
        :description="
          props.type === 'friend' ? t('mobile_mymessage.empty_require') : t('mobile_mymessage.empty_group_require')
        " />
    </div>
  </div>
</template>
<script setup lang="ts">
import { uniq } from 'es-toolkit'
import { useI18n } from 'vue-i18n'
import { matrixGroupService } from '@/services/matrix/room/MatrixGroupService'
import type { NoticeItem } from '@/services/types.ts'
import { NoticeType, RequestNoticeAgreeStatus } from '@/services/types.ts'
import type { FriendRequestItem } from '@/stores/domains/chat/contacts'
import { useContactStore } from '@/stores/domains/chat/contacts'
import type { MatrixGroupInfo } from '@/stores/domains/chat/group'
import { useGroupStore } from '@/stores/domains/chat/group'
import { useUserStore } from '@/stores/domains/user/user'
import { AvatarUtils } from '@/utils/AvatarUtils'
import { createLogger } from '@/utils/Logger'
import { useTimerManager } from '@/utils/TimerManager'

const logger = createLogger('MobileApplyList')
const timerManager = useTimerManager()

const { t } = useI18n()
const userStore = useUserStore()
const contactStore = useContactStore()
const groupStore = useGroupStore()
const currentUserId = ref('0')
const loadingMap = ref<Record<string, boolean>>({})
const isLoadingMore = ref(false)
const scrollRef = ref<HTMLElement>()
const props = defineProps<{
  type: 'friend' | 'group'
  customHeight?: number
  closeHeader?: boolean
}>()

const groupDetailsMap = ref<Record<string, MatrixGroupInfo>>({})
const loadingGroups = ref<Set<string>>(new Set())

const isAccepted = (item: FriendRequestItem) => {
  return item.status !== RequestNoticeAgreeStatus.UNTREATED
}

const applyList = computed(() => {
  return contactStore.requestFriendsList.filter((item) => {
    if (props.type === 'friend') {
      return item.type === 2
    } else {
      return item.type === 1
    }
  })
})

const getGroupDetail = async (roomId: string) => {
  if (!roomId) return null

  if (loadingGroups.value.has(roomId)) {
    return null
  }

  if (groupDetailsMap.value[roomId]) {
    return groupDetailsMap.value[roomId]
  }

  loadingGroups.value.add(roomId)
  try {
    const groupInfo = await groupStore.loadGroupInfo(roomId)
    if (groupInfo) {
      groupDetailsMap.value[roomId] = groupInfo
      return groupInfo
    }
  } catch (error) {
    logger.error('获取群组信息失败:', error)
  } finally {
    loadingGroups.value.delete(roomId)
  }

  return null
}

const applyMsg = computed(() => (item: FriendRequestItem) => {
  if (props.type === 'friend') {
    return isCurrentUser(item.senderId)
      ? isAccepted(item)
        ? t('mobile_mymessage.friend_request_status.accepted')
        : t('mobile_mymessage.friend_request_status.verifying')
      : t('mobile_mymessage.friend_request_status.sent')
  } else {
    const groupDetail = item.roomId ? groupDetailsMap.value[item.roomId] : undefined
    if (!groupDetail) {
      if (item.roomId && !loadingGroups.value.has(item.roomId)) {
        getGroupDetail(item.roomId)
      }
      return t('mobile_mymessage.loading', { tail: '...' })
    }

    if (item.eventType === NoticeType.GROUP_APPLY) {
      return t('mobile_mymessage.group.apply_to_join', { name: groupDetail.name })
    } else if (item.eventType === NoticeType.GROUP_INVITE) {
      const inviter = groupStore.getUserInfo(item.operateId ?? '')?.name || t('mobile_mymessage.unknown_user')
      return t('mobile_mymessage.group.invited_to_join', { inviter, group: groupDetail.name })
    } else if (isFriendApplyOrGroupInvite(item)) {
      return isCurrentUser(item.senderId)
        ? t('mobile_mymessage.group.joined_group', { group: groupDetail.name })
        : t('mobile_mymessage.group.invited_curr_to_join', { group: groupDetail.name })
    } else if (item.eventType === NoticeType.GROUP_MEMBER_DELETE) {
      const operator = groupStore.getUserInfo(item.senderId ?? '')?.name || t('mobile_mymessage.unknown_user')
      return t('mobile_mymessage.group.kicked_out', { operator, group: groupDetail.name })
    } else if (item.eventType === NoticeType.GROUP_SET_ADMIN) {
      return t('mobile_mymessage.group.set_as_admin', { group: groupDetail.name })
    } else if (item.eventType === NoticeType.GROUP_RECALL_ADMIN) {
      return t('mobile_mymessage.group.removed_as_admin', { group: groupDetail.name })
    }
  }
})

const popoverActions = [
  { text: t('mobile_mymessage.menu.decline'), value: 'reject' },
  { text: t('mobile_mymessage.menu.decline'), value: 'ignore' }
]

const avatarSrc = (url: string) => AvatarUtils.getAvatarUrl(url)

const isCurrentUser = (uid: string | undefined) => {
  return uid === userStore.userInfo!.uid
}

const getUserInfo = (item: FriendRequestItem) => {
  switch (item.eventType) {
    case NoticeType.FRIEND_APPLY:
    case NoticeType.GROUP_MEMBER_DELETE:
    case NoticeType.GROUP_SET_ADMIN:
    case NoticeType.GROUP_RECALL_ADMIN:
      return groupStore.getUserInfo(item.operateId ?? '')
    case NoticeType.ADD_ME:
    case NoticeType.GROUP_INVITE:
    case NoticeType.GROUP_INVITE_ME:
    case NoticeType.GROUP_APPLY:
      return groupStore.getUserInfo(item.senderId ?? '')
  }
}

const isFriendApplyOrGroupInvite = (item: FriendRequestItem) => {
  return (
    item.eventType === NoticeType.FRIEND_APPLY ||
    item.eventType === NoticeType.GROUP_APPLY ||
    item.eventType === NoticeType.GROUP_INVITE ||
    item.eventType === NoticeType.GROUP_INVITE_ME ||
    item.eventType === NoticeType.ADD_ME
  )
}

const handleScroll = (e: Event) => {
  if (isLoadingMore.value) return

  const { scrollTop, scrollHeight, clientHeight } = e.target as HTMLElement
  if (scrollHeight - scrollTop - clientHeight < 20) {
    loadMoreFriendRequests()
  }
}

const loadMoreFriendRequests = async () => {
  if (contactStore.applyPageOptions.isLast) {
    return
  }

  isLoadingMore.value = true
  try {
    await contactStore.getApplyPage(props.type, false)
  } finally {
    isLoadingMore.value = false
  }
}

const handleAgree = async (item: FriendRequestItem) => {
  const applyId = item.applyId
  loadingMap.value[applyId] = true
  try {
    await contactStore.onHandleInvite({
      applyId,
      state: RequestNoticeAgreeStatus.ACCEPTED,
      roomId: item.roomId,
      type: item.type,
      applyType: props.type,
      markAsRead: true
    })
  } finally {
    timerManager.setTimeout(() => {
      loadingMap.value[applyId] = false
    }, 600)
  }
}

const handleFriendAction = async (action: string, applyId: string) => {
  loadingMap.value[applyId] = true
  try {
    if (action === 'reject') {
      await contactStore.onHandleInvite({
        applyId,
        state: RequestNoticeAgreeStatus.REJECTED,
        applyType: props.type,
        markAsRead: true
      })
    } else if (action === 'ignore') {
      await contactStore.onHandleInvite({
        applyId,
        state: RequestNoticeAgreeStatus.IGNORE,
        applyType: props.type,
        markAsRead: true
      })
    }
  } finally {
    timerManager.setTimeout(() => {
      loadingMap.value[applyId] = false
    }, 600)
  }
}

onMounted(() => {
  contactStore.getApplyPage(props.type, true)
})

watch(
  () => applyList.value,
  (newList) => {
    const roomIds = uniq(newList.filter((item) => item.roomId && Number(item.roomId) > 0).map((item) => item.roomId))

    if (roomIds.length > 0) {
      roomIds.forEach((roomId) => {
        if (roomId && !groupDetailsMap.value[roomId] && !loadingGroups.value.has(roomId)) {
          getGroupDetail(roomId)
        }
      })
    }
  },
  { immediate: true, deep: true }
)
</script>

<style scoped lang="scss"></style>
