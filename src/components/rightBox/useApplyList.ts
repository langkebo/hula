import { uniq } from 'es-toolkit'
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
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

/**
 * ApplyList 的数据编排：申请列表过滤、群详情懒加载与失败重试、同意/拒绝/忽略动作、滚动分页。
 * 组件只保留模板。
 */
export function useApplyList(options: { props: { type: 'friend' | 'group' } }) {
  const { props } = options
  const timerManager = useTimerManager()

  const userStore = useUserStore()
  const contactStore = useContactStore()
  const groupStore = useGroupStore()
  const { t } = useI18n()

  const currentUserId = ref('0')
  const loadingMap = ref<Record<string, boolean>>({})
  const isLoadingMore = ref(false)

  const groupDetailsMap = ref<Record<string, MatrixGroupInfo>>({})
  const loadingGroups = ref<Set<string>>(new Set())
  // 群详情读取失败的 roomId：不得一直停留在「加载中」，也不能每次渲染都重试
  const failedGroupIds = ref<Set<string>>(new Set())

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
    failedGroupIds.value.delete(roomId)
    try {
      const groupInfo = await groupStore.loadGroupInfo(roomId)
      if (groupInfo) {
        groupDetailsMap.value[roomId] = groupInfo
        return groupInfo
      }
      failedGroupIds.value.add(roomId)
    } catch (error) {
      logger.error('Failed to fetch group info:', error)
      failedGroupIds.value.add(roomId)
    } finally {
      loadingGroups.value.delete(roomId)
    }

    return null
  }

  /** 群详情读取失败：展示失败文案与重试入口，而不是永远停在加载中 */
  const hasGroupDetailError = (item: NoticeItem) =>
    props.type === 'group' && Boolean(item.roomId) && failedGroupIds.value.has(item.roomId)

  const retryGroupDetail = (roomId: string) => {
    if (!roomId) return
    failedGroupIds.value.delete(roomId)
    void getGroupDetail(roomId)
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
      if (failedGroupIds.value.has(item.roomId)) {
        return t('common.load_failed')
      }
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
        if (
          roomId &&
          !groupDetailsMap.value[roomId] &&
          !loadingGroups.value.has(roomId) &&
          !failedGroupIds.value.has(roomId)
        ) {
          getGroupDetail(roomId)
        }
      }
    },
    { immediate: true }
  )

  return {
    t,
    groupStore,
    isAccepted,
    currentUserId,
    loadingMap,
    applyList,
    groupDetailsMap,
    showLoadError,
    emptyDescription,
    handleRetryLoad,
    hasGroupDetailError,
    retryGroupDetail,
    applyMsg,
    dropdownOptions,
    avatarSrc,
    isCurrentUser,
    getUserInfo,
    isFriendApplyOrGroupInvite,
    handleScroll,
    handleAgree,
    handleFriendAction,
    formatChatTime,
    NoticeType,
    RequestNoticeAgreeStatus
  }
}
