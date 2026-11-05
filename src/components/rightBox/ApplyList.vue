<template>
  <n-flex vertical class="select-none">
    <n-flex align="center" justify="space-between" class="color-[--tjg-text-primary] px-20px py-10px">
      <p class="text-[length:var(--tjg-font-size-lg)]">
        {{ t(props.type === 'friend' ? 'home.apply_list.friend_notice' : 'home.apply_list.group_notice') }}
      </p>
    </n-flex>

    <n-virtual-list
      class="max-h-[calc(100vh/var(--page-scale,1)-80px)]"
      :items="applyList"
      :item-size="102"
      :item-resizable="true"
      @scroll="handleScroll"
      ref="virtualListRef">
      <template #default="{ item }">
        <n-flex vertical :size="10" class="p-[10px_30px] box-border">
          <n-flex
            align="center"
            justify="space-between"
            :size="10"
            class="bg-[--tjg-surface-panel] rounded-10px p-20px box-border border-(1px solid [--tjg-border-default])">
            <n-flex align="center" :size="10" class="min-w-0 flex-1">
              <n-avatar
                round
                size="large"
                :src="
                  props.type === 'friend'
                    ? avatarSrc(getUserInfo(item)?.avatar || '')
                    : avatarSrc(groupDetailsMap[item.roomId]?.avatar || '/default-group-avatar.png')
                "
                class="mr-10px" />
              <n-flex vertical :size="12" class="min-w-0 flex-1">
                <n-flex align="center" :size="10" class="min-w-0 flex-1 gap-10px">
                  <p
                    @click="
                      isCurrentUser(item.senderId) ? (currentUserId = item.operateId) : (currentUserId = item.senderId)
                    "
                    class="text-(14px --tjg-color-primary-500) cursor-pointer shrink-0 max-w-150px truncate">
                    {{
                      item.eventType === NoticeType.GROUP_MEMBER_DELETE && item.operateId == item.receiverId
                        ? t('home.apply_list.you')
                        : getUserInfo(item)?.name || t('home.apply_list.unknown_user')
                    }}
                  </p>

                  <div class="flex items-center min-w-0 flex-1 gap-6px">
                    <p class="text-(14px [--tjg-text-primary]) min-w-0 truncate whitespace-nowrap">
                      {{ applyMsg(item) }}
                    </p>

                    <p class="text-(12px --tjg-text-tertiary) shrink-0 whitespace-nowrap">
                      {{ formatChatTime(item.createTime) }}
                    </p>
                  </div>
                </n-flex>
                <p
                  :title="t('home.apply_list.message_label') + item.content"
                  v-if="isFriendApplyOrGroupInvite(item)"
                  class="text-(12px [--tjg-text-primary]) cursor-default w-340px truncate">
                  {{ t('home.apply_list.message_label') }}{{ item.content }}
                </p>
                <p v-else class="text-(12px [--tjg-text-primary])">
                  {{
                    t('home.apply_list.handler_label', {
                      name: groupStore.getUserInfo(item.senderId)?.name || t('home.apply_list.unknown_user')
                    })
                  }}
                </p>
              </n-flex>
            </n-flex>

            <div v-if="isFriendApplyOrGroupInvite(item)" class="shrink-0 flex items-center gap-10px">
              <n-flex
                align="center"
                :size="10"
                class="shrink-0"
                v-if="item.status === RequestNoticeAgreeStatus.UNTREATED && !isCurrentUser(item.senderId)">
                <n-button secondary :loading="loadingMap[item.applyId]" @click="handleAgree(item)">
                  {{ t('home.apply_list.accept') }}
                </n-button>
                <n-dropdown
                  trigger="click"
                  :options="dropdownOptions"
                  @select="(key: string) => handleFriendAction(key, item.applyId)">
                  <n-icon class="cursor-pointer px-6px">
                    <svg class="size-16px color-[--tjg-text-primary]">
                      <use href="#more"></use>
                    </svg>
                  </n-icon>
                </n-dropdown>
              </n-flex>
              <span
                class="text-(12px [--tjg-color-primary-500])"
                v-else-if="item.status === RequestNoticeAgreeStatus.ACCEPTED">
                {{ t('home.apply_list.status.accepted') }}
              </span>
              <span
                class="text-(12px [--tjg-color-danger-500])"
                v-else-if="item.status === RequestNoticeAgreeStatus.REJECTED">
                {{ t('home.apply_list.status.rejected') }}
              </span>
              <span class="text-(12px --tjg-text-tertiary)" v-else-if="item.status === RequestNoticeAgreeStatus.IGNORE">
                {{ t('home.apply_list.status.ignored') }}
              </span>
              <span
                class="text-(12px [--tjg-color-primary-500])"
                :class="{ 'text-(12px [--tjg-color-danger-500])': item.status === RequestNoticeAgreeStatus.REJECTED }"
                v-else-if="isCurrentUser(item.senderId)">
                {{
                  isAccepted(item)
                    ? t('home.apply_list.status.accepted')
                    : item.status === RequestNoticeAgreeStatus.REJECTED
                      ? t('home.apply_list.status.rejected_by_other')
                      : t('home.apply_list.status.pending')
                }}
              </span>
            </div>
          </n-flex>
        </n-flex>
      </template>
    </n-virtual-list>

    <!-- 空数据提示：加载失败时换文案 + 出重试，避免把「读取失败」显示成「暂无好友申请」 -->
    <n-flex v-if="applyList.length === 0" vertical justify="center" align="center" class="py-40px">
      <n-empty :description="emptyDescription" />
      <n-button v-if="showLoadError" size="small" tertiary type="primary" @click="handleRetryLoad">
        {{ t('common.retry') }}
      </n-button>
    </n-flex>
  </n-flex>
</template>
<script setup lang="ts">
import { uniq } from 'es-toolkit'
import { useI18n } from 'vue-i18n'
import type { NoticeItem } from '@/services/types.ts'
import { NoticeType, RequestNoticeAgreeStatus } from '@/services/types.ts'
import { useContactStore } from '@/stores/domains/chat/contacts'
import type { MatrixGroupInfo } from '@/stores/domains/chat/group'
import { useGroupStore } from '@/stores/domains/chat/group'
import { useUserStore } from '@/stores/domains/user/user'
import { AvatarUtils } from '@/utils/AvatarUtils'
import { formatChatTime } from '@/utils/ComputedTime.ts'
import { createLogger } from '@/utils/Logger'
import { useTimerManager } from '@/utils/TimerManager'

const logger = createLogger('ApplyList')
const timerManager = useTimerManager()

const userStore = useUserStore()
const contactStore = useContactStore()
const groupStore = useGroupStore()
const { t } = useI18n()

const currentUserId = ref('0')
const loadingMap = ref<Record<string, boolean>>({})
const isLoadingMore = ref(false)
const props = defineProps<{
  type: 'friend' | 'group'
}>()

const groupDetailsMap = ref<Record<string, MatrixGroupInfo>>({})
const loadingGroups = ref<Set<string>>(new Set())

const isAccepted = (item: NoticeItem) => item.status !== RequestNoticeAgreeStatus.UNTREATED

// 加载失败态：群通知走另一条链路，不共用该信号
const showLoadError = computed(() => props.type === 'friend' && Boolean(contactStore.requestLoadError))
const emptyDescription = computed(() =>
  showLoadError.value
    ? t('common.error')
    : t(props.type === 'friend' ? 'home.apply_list.empty_friend' : 'home.apply_list.empty_group')
)
const handleRetryLoad = () => void contactStore.loadFriendRequests()

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

  if (loadingGroups.value.has(roomId)) return null
  if (groupDetailsMap.value[roomId]) return groupDetailsMap.value[roomId]

  loadingGroups.value.add(roomId)
  try {
    const groupInfo = await groupStore.loadGroupInfo(roomId)
    if (groupInfo) {
      groupDetailsMap.value[roomId] = groupInfo
      return groupInfo
    }
  } catch (error) {
    logger.error('Failed to fetch group info:', error)
  } finally {
    loadingGroups.value.delete(roomId)
  }

  return null
}

const applyMsg = computed(() => (item: NoticeItem) => {
  if (props.type === 'friend') {
    return isCurrentUser(item.senderId)
      ? isAccepted(item)
        ? t('home.apply_list.friend.accepted_you')
        : t('home.apply_list.friend.pending')
      : t('home.apply_list.friend.request')
  }

  const groupDetail = groupDetailsMap.value[item.roomId]
  if (!groupDetail) {
    if (item.roomId && !loadingGroups.value.has(item.roomId)) {
      void getGroupDetail(item.roomId)
    }
    return t('home.apply_list.group.loading')
  }

  const groupName = groupDetail.name?.toString() ?? ''
  if (item.eventType === NoticeType.GROUP_APPLY) {
    return t('home.apply_list.group.apply', { group: groupName })
  }
  if (item.eventType === NoticeType.GROUP_INVITE) {
    const inviterName = item.operateId ? groupStore.getUserInfo(item.operateId)?.name : undefined
    return t('home.apply_list.group.invite', {
      name: inviterName ?? t('home.apply_list.unknown_user'),
      group: groupName
    })
  }
  if (isFriendApplyOrGroupInvite(item)) {
    return isCurrentUser(item.senderId)
      ? t('home.apply_list.group.invite_confirmed', { group: groupName })
      : t('home.apply_list.group.invite_you', { group: groupName })
  }
  if (item.eventType === NoticeType.GROUP_MEMBER_DELETE) {
    const operatorName = item.senderId ? groupStore.getUserInfo(item.senderId)?.name : undefined
    return t('home.apply_list.group.kicked', {
      operator: operatorName ?? t('home.apply_list.unknown_user'),
      group: groupName
    })
  }
  if (item.eventType === NoticeType.GROUP_SET_ADMIN) {
    return t('home.apply_list.group.set_admin', { group: groupName })
  }
  if (item.eventType === NoticeType.GROUP_RECALL_ADMIN) {
    return t('home.apply_list.group.remove_admin', { group: groupName })
  }
  return ''
})

const dropdownOptions = computed(() => [
  {
    label: t('home.apply_list.dropdown.reject'),
    key: 'reject'
  },
  {
    label: t('home.apply_list.dropdown.ignore'),
    key: 'ignore'
  }
])

const avatarSrc = (url: string) => AvatarUtils.getAvatarUrl(url)

const isCurrentUser = (uid: string) => uid === (userStore.userInfo?.uid ?? '')

/**
 * 获取当前用户查询视角
 * @param item 通知消息
 */
const getUserInfo = (item: NoticeItem) => {
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
      return groupStore.getUserInfo(item.senderId)
  }
}

// 判断是否为好友申请或者群申请、群邀请
const isFriendApplyOrGroupInvite = (item: NoticeItem) => {
  return (
    item.eventType === NoticeType.FRIEND_APPLY ||
    item.eventType === NoticeType.GROUP_APPLY ||
    item.eventType === NoticeType.GROUP_INVITE ||
    item.eventType === NoticeType.GROUP_INVITE_ME ||
    item.eventType === NoticeType.ADD_ME
  )
}

// 处理滚动事件
const handleScroll = (e: Event) => {
  if (isLoadingMore.value) return

  const { scrollTop, scrollHeight, clientHeight } = e.target as HTMLElement
  // 当滚动到距离底部20px以内时触发加载更多
  if (scrollHeight - scrollTop - clientHeight < 20) {
    loadMoreFriendRequests()
  }
}

// 加载更多好友申请
const loadMoreFriendRequests = async () => {
  // 如果已经是最后一页或正在加载中，则不再加载
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

const handleAgree = async (item: NoticeItem) => {
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

// 处理好友请求操作（拒绝或忽略）
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
  // 组件挂载时刷新一次列表
  contactStore.getApplyPage(props.type, true)
})

onUnmounted(() => {
  timerManager.clearAll()
})

// 待补详情的 roomId（原实现 deep watch 深遍历整个 applyList，实际只关心 roomId）
const pendingGroupIds = computed(() =>
  uniq(applyList.value.filter((item) => item.roomId && Number(item.roomId) > 0).map((item) => item.roomId))
)

// 听着「拼接签名」而不是数组引用：computed 每次重算都换引用，内容不变时不该触发
watch(
  () => pendingGroupIds.value.join(','),
  () => {
    for (const roomId of pendingGroupIds.value) {
      if (roomId && !groupDetailsMap.value[roomId] && !loadingGroups.value.has(roomId)) getGroupDetail(roomId)
    }
  },
  { immediate: true }
)
</script>

<style scoped lang="scss"></style>
