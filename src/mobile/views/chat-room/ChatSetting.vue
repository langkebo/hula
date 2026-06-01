<template>
  <AutoFixHeightPage :show-footer="false">
    <template #header>
      <HeaderBar
        :isOfficial="false"
        border
        :hidden-right="true"
        :room-name="t('mobile_chat_setting.title', { t: title })" />
    </template>

    <template #container>
      <div class="flex flex-col overflow-auto h-full">
        <div class="flex flex-col gap-15px py-15px px-20px flex-1 min-h-0 z-1">
          <div class="bg-[--hula-surface-panel] rounded-10px p-0">
            <div class="flex py-10px rounded-10px w-full items-center gap-10px" @click="clickInfo">
              <!-- 群头像 -->
              <div class="flex justify-center">
                <div
                  class="rounded-full relative bg-[--hula-surface-panel] w-38px h-38px overflow-hidden"
                  style="margin-left: 10px">
                  <img
                    class="absolute size-38px rounded-full object-cover"
                    style="top: 50%; left: 50%; transform: translate(-50%, -50%)"
                    :src="AvatarUtils.getAvatarUrl(activeItem?.avatar || '')"
                    alt="群头像"
                    @error="($event.target as HTMLImageElement).src = '/logo.png'" />
                </div>
                <input
                  v-if="isGroup"
                  ref="fileInput"
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  class="hidden"
                  @change="handleFileChange" />
                <AvatarCropper
                  ref="cropperRef"
                  v-model:show="showCropper"
                  :image-url="localImageUrl"
                  @crop="handleCrop" />
              </div>

              <div class="text-14px flex items-center h-full gap-5px">
                <span>
                  {{ activeItem?.name || '' }}
                </span>
                <span v-if="activeItem?.hotFlag === 1">
                  <svg class="w-18px h-18px iconpark-icon text-[--color-primary]">
                    <use href="#auth"></use>
                  </svg>
                </span>
              </div>
            </div>
          </div>

          <!-- 群成员  -->
          <div v-if="isGroup" class="bg-[--hula-surface-panel] rounded-10px">
            <div class="flex items-center justify-between p-[15px_15px_0px_15px]">
              <span class="text-14px font-medium">{{ t('mobile_chat_setting.group_members_title') }}</span>
              <div
                @click="toGroupChatMember"
                class="text-12px text-[--hula-text-secondary] flex flex-wrap gap-10px items-center">
                <i18n-t keypath="mobile_chat_setting.member_count">
                  <template #count>
                    <span class="text-[--color-primary]">{{ groupStore.countInfo?.memberNum || 0 }}</span>
                  </template>
                </i18n-t>
                <div>
                  <svg class="w-14px h-14px iconpark-icon">
                    <use href="#right"></use>
                  </svg>
                </div>
              </div>
            </div>
            <div class="p-[15px_15px_0px_15px]">
              <div class="py-15px px-5px grid grid-cols-5 gap-15px text-12px">
                <div
                  @click="toFriendInfo(i.uid)"
                  v-for="i in groupMemberListSliced"
                  :key="i.uid"
                  class="flex flex-col justify-center items-center gap-5px">
                  <div
                    class="rounded-full relative bg-[--hula-color-primary-100] w-36px h-36px flex items-center justify-center">
                    <div
                      v-if="i.activeStatus !== OnlineEnum.ONLINE"
                      class="w-36px h-36px absolute rounded-full bg-[--bg-offline-avatar-overlay] z-4"></div>
                    <img
                      class="absolute z-3 size-36px rounded-full object-cover"
                      :src="avatarSrc(i.avatar)"
                      alt="用户头像"
                      @error="($event.target as HTMLImageElement).src = '/logo.png'" />
                  </div>
                  <div class="truncate max-w-full text-[--hula-text-secondary]">{{ i.name }}</div>
                </div>
                <div class="flex flex-col justify-center items-center gap-5px cursor-pointer">
                  <van-button plain round size="small" icon="plus" @click="toInviteGroupMember" />
                  <div>{{ t('mobile_chat_setting.group_invite_member') }}</div>
                </div>
              </div>
            </div>
          </div>

          <!-- 管理群成员 -->
          <div
            v-if="isGroup && groupStore.isAdminOrLord() && globalStore.currentSessionRoomId !== '1'"
            class="bg-[--hula-surface-panel] p-15px rounded-10px shadow text-14px flex cursor-pointer"
            @click="toManageGroupMember">
            {{ t('mobile_chat_setting.manage_group_members') }}
          </div>

          <div class="bg-[--hula-surface-panel] rounded-10px p-15px cursor-pointer" @click="handleSearchChatContent">
            {{ t('mobile_chat_setting.search_history') }}
          </div>

          <!-- 群公告 & 信息 -->
          <div class="bg-[--hula-surface-panel] rounded-10px">
            <div class="p-15px!">
              <div @click="handleCopy(activeItem?.account || '')" class="flex justify-between items-center">
                <div class="text-14px">
                  {{
                    t('mobile_chat_setting.id_card.qr_code_label', {
                      t: isGroup
                        ? t('mobile_chat_setting.id_card.type.group')
                        : t('mobile_chat_setting.id_card.type.single_chat')
                    })
                  }}
                </div>
                <div class="text-12px text-[--hula-text-secondary] flex flex-wrap gap-10px items-center">
                  <div>{{ activeItem?.account || '' }}</div>
                  <div>
                    <svg class="w-14px h-14px iconpark-icon">
                      <use href="#saoma-i3589iic"></use>
                    </svg>
                  </div>
                </div>
              </div>
            </div>
            <div class="mx-15px border-b border-[--hula-border-default]"></div>
            <!-- 公告内容 -->
            <div @click="goToNotice" v-if="isGroup" class="flex flex-col text-14px gap-10px p-15px">
              <div>{{ t('mobile_chat_setting.group_notice.title') }}</div>
              <div class="text-[--hula-text-secondary] line-clamp-2 text-12px line-height-20px">
                {{ announList.length > 0 ? announList[0]?.content : '' }}
              </div>
            </div>

            <div v-if="isGroup" class="mx-15px border-b border-[--hula-border-default]"></div>

            <!-- 群名称 -->
            <div class="flex justify-between p-15px items-center">
              <div class="text-14px">{{ t('mobile_chat_setting.group_name') }}</div>
              <div class="text-12px text-[--hula-text-secondary] flex flex-wrap gap-10px items-center">
                <van-field
                  v-model="nameValue"
                  :border="false"
                  input-align="right"
                  :placeholder="t('mobile_chat_setting.input.group_name')"
                  @blur="handleGroupInfoUpdate"
                  class="!bg-transparent !p-0 !min-w-0 inline-block" />
              </div>
            </div>

            <div class="mx-15px border-b border-[--hula-border-default]"></div>

            <!-- 群别名 -->
            <div v-if="isGroup" class="flex justify-between p-15px items-center">
              <div class="text-14px">{{ t('mobile_chat_setting.group_alias') }}</div>
              <div class="text-12px text-[--hula-text-secondary] flex flex-wrap gap-10px items-center">
                <van-field
                  v-model="nicknameValue"
                  :border="false"
                  input-align="right"
                  :placeholder="t('mobile_chat_setting.input.group_alias')"
                  @blur="handleInfoUpdate"
                  class="!bg-transparent !p-0 !min-w-0 inline-block" />
              </div>
            </div>
          </div>

          <!-- 备注 -->
          <div class="w-full flex flex-col gap-15px rounded-10px">
            <div class="ps-15px text-14px">
              <span class="dark:text-white">{{ t('mobile_chat_setting.remark') }}</span>
              <span class="text-[--hula-text-secondary] ml-1">
                {{ t('mobile_chat_setting.remar_kprivate_visible') }}
              </span>
            </div>
            <van-field
              v-model="remarkValue"
              :placeholder="t('mobile_chat_setting.input.remark')"
              @blur="handleInfoUpdate"
              class="rounded-10px" />
          </div>

          <!-- 设置 -->
          <div class="bg-[--hula-surface-panel] rounded-10px">
            <div class="p-15px text-14px font-medium">
              {{ t('mobile_chat_setting.setting_type', { t: title }) }}
            </div>
            <div class="flex justify-between items-center px-15px pb-12px">
              <div class="text-14px">{{ t('mobile_chat_setting.pintop') }}</div>
              <van-switch :model-value="!!activeItem?.top" @update:model-value="handleTop" size="20px" />
            </div>
            <div class="mx-15px border-b border-[--hula-border-default]"></div>
            <div class="flex justify-between p-15px items-center">
              <div class="text-14px">{{ t('mobile_chat_setting.silent') }}</div>
              <van-switch
                :model-value="activeItem?.muteNotification === NotificationTypeEnum.NOT_DISTURB"
                @update:model-value="handleNotification"
                size="20px" />
            </div>
          </div>

          <van-button plain class="cursor-pointer text-red text-14px rounded-10px w-full mb-20px">
            {{ t('mobile_chat_setting.delete_chat_history') }}
          </van-button>

          <div class="mt-auto flex justify-center mb-20px">
            <van-button
              class="w-full"
              v-if="isGroup && globalStore.currentSessionRoomId !== '1'"
              plain
              round
              type="danger"
              size="large"
              @click="handleExit">
              {{
                isGroup
                  ? isLord
                    ? t('mobile_chat_setting.disband_group')
                    : t('mobile_chat_setting.leave_group')
                  : t('mobile_chat_setting.delete_friend')
              }}
            </van-button>
            <div class="h-1px"></div>
          </div>
        </div>
      </div>
    </template>
  </AutoFixHeightPage>
</template>

<script setup lang="ts">
import { showConfirmDialog } from 'vant'
import { I18nT, useI18n } from 'vue-i18n'
import { useActionFeedback } from '@/composables/common/useActionFeedback'
import { MittEnum, NotificationTypeEnum, OnlineEnum, RoleEnum, RoomTypeEnum } from '@/enums'
import { useAvatarUpload } from '@/hooks/useAvatarUpload'
import { useMitt } from '@/hooks/useMitt.ts'
import { useMyRoomInfoUpdater } from '@/hooks/useMyRoomInfoUpdater'
import router from '@/router'
import { roomListService } from '@/services/matrix/room/RoomListService'
import { roomStateService } from '@/services/matrix/room/RoomStateService'
import type { UserItem } from '@/services/types'
import { useAnnouncementStore } from '@/stores/domains/chat/announcement'
import { useChatStore } from '@/stores/domains/chat/chat'
import { useContactStore } from '@/stores/domains/chat/contacts'
import type { MatrixGroupInfo } from '@/stores/domains/chat/group'
import { useGroupStore } from '@/stores/domains/chat/group'
import { useUserStore } from '@/stores/domains/user/user'
import { useGlobalStore } from '@/stores/domains/widget/global'
import { AvatarUtils } from '@/utils/AvatarUtils'
import { createLogger } from '@/utils/Logger'
import { toFriendInfoPage } from '@/utils/RouterUtils'

const logger = createLogger('ChatSetting')

defineOptions({
  name: 'mobileChatSetting'
})

const { t } = useI18n()
const { showFeedback } = useActionFeedback()

const chatStore = useChatStore()
const globalStore = useGlobalStore()
const groupStore = useGroupStore()
const announcementStore = useAnnouncementStore()
const contactStore = useContactStore()
const { currentSessionRoomId } = storeToRefs(globalStore)
const { persistMyRoomInfo } = useMyRoomInfoUpdater()

type GroupAnnouncementListResponse = Awaited<ReturnType<typeof announcementStore.getGroupAnnouncementList>>
type GroupAnnouncementListItem = GroupAnnouncementListResponse['records'][number]

const title = computed(() =>
  isGroup.value ? t('mobile_chat_setting.type.group') : t('mobile_chat_setting.type.single_chat')
)
const isGroup = computed(() => globalStore.currentSession?.type === RoomTypeEnum.GROUP)

const isLord = computed(() => {
  const currentUser = groupStore.userList.find((user) => user.uid === useUserStore().userInfo?.uid)
  return currentUser?.roleId === RoleEnum.LORD
})
const isAdmin = computed(() => {
  const currentUser = groupStore.userList.find((user) => user.uid === useUserStore().userInfo?.uid)
  return currentUser?.roleId === RoleEnum.ADMIN
})

const groupMemberListSliced = computed(() => {
  const list = groupStore.memberList.slice(0, 9)
  return list
})

const avatarSrc = (url: string) => AvatarUtils.getAvatarUrl(url)

const announError = ref(false)
const announNum = ref(0)
const isAddAnnoun = ref(false)
const announList = ref<GroupAnnouncementListItem[]>([])
const remarkValue = ref('')
const groupInfo = ref<MatrixGroupInfo | null>(null)
const nameValue = ref('')
const avatarValue = ref('')
const nicknameValue = ref('')
const options = ref<Array<{ name: string; src: string }>>([])
const { currentSession: activeItem } = storeToRefs(globalStore)
const friend = computed(() => contactStore.contactsList.find((item) => item.uid === activeItem.value?.detailId))

const initialRemarkValue = ref('')
const initialNicknameValue = ref('')
const initialNameValue = ref('')

const {
  localImageUrl,
  showCropper,
  openAvatarCropper,
  handleFileChange,
  handleCrop: onCrop
} = useAvatarUpload({
  onSuccess: async (mxcUrl) => {
    avatarValue.value = mxcUrl
  }
})

const handleCrop = async (cropBlob: Blob) => {
  await onCrop(cropBlob)
}

const handleCopy = (val: string) => {
  if (val) {
    navigator.clipboard.writeText(val)
    showFeedback(t('mobile_chat_setting.copy_id', { id: val }), 'success')
  }
}

const toFriendInfo = (uid: string) => {
  toFriendInfoPage(uid)
}

const toGroupChatMember = () => {
  router.push({ name: 'mobileGroupChatMember' })
}

const toInviteGroupMember = () => {
  router.push({ name: 'mobileInviteGroupMember' })
}

const toManageGroupMember = () => {
  router.push({ name: 'manageGroupMember' })
}

const goToNotice = () => {
  router.push({
    path: '/mobile/chatRoom/notice',
    query: {
      announList: JSON.stringify(announList.value),
      roomId: globalStore.currentSessionRoomId
    }
  })
}

async function handleExit() {
  try {
    await showConfirmDialog({
      title: t('components.common.confirm'),
      message: isGroup.value
        ? isLord.value
          ? t('mobile_chat_setting.confirm_disband_group')
          : t('mobile_chat_setting.confirm_leave_group')
        : t('mobile_chat_setting.confirm_delete_friend')
    })

    const session = activeItem.value
    if (!session) {
      showFeedback(t('mobile_chat_setting.session_not_exist'), 'warning')
      return
    }
    try {
      if (isGroup.value) {
        if (isLord.value) {
          if (currentSessionRoomId.value === '1') {
            showFeedback(t('mobile_chat_setting.disband_channel_failed'), 'warning')
            return
          }
          groupStore.exitGroup(currentSessionRoomId.value).then(() => {
            showFeedback(t('mobile_chat_setting.group_disbanded'), 'success')
            useMitt.emit(MittEnum.DELETE_SESSION, currentSessionRoomId.value)
          })
        } else {
          if (currentSessionRoomId.value === '1') {
            showFeedback(t('mobile_chat_setting.leave_channel_failed'), 'warning')
            return
          }
          groupStore.exitGroup(currentSessionRoomId.value).then(() => {
            showFeedback(t('mobile_chat_setting.group_left'), 'success')
            useMitt.emit(MittEnum.DELETE_SESSION, currentSessionRoomId.value)
          })
        }
      } else {
        const detailId = session.detailId
        if (!detailId) {
          showFeedback(t('mobile_chat_setting.get_friend_info_failed'), 'warning')
          return
        }
        await contactStore.onDeleteFriend(detailId)
        showFeedback(t('mobile_chat_setting.delete_friend_success'), 'success')
      }
      router.push('/mobile/message')
    } catch (error) {
      logger.error('操作失败:', error)
    }
  } catch {
    // user cancelled
  }
}

const clickInfo = () => {
  if (isGroup) {
    openAvatarCropper()
  } else {
    const detailId = activeItem.value?.detailId
    if (!detailId) {
      showFeedback(t('mobile_chat_setting.session_not_ready'), 'warning')
      return
    }
    router.push(`/mobile/mobileFriends/friendInfo/${detailId}`)
  }
}

const handleLoadGroupAnnoun = async () => {
  try {
    const roomId = globalStore.currentSessionRoomId
    if (!roomId) {
      logger.error('当前会话没有roomId')
      return
    }
    isAddAnnoun.value = isLord.value || isAdmin.value
    const data = await announcementStore.getGroupAnnouncementList(roomId, 1, 10)
    if (data) {
      announList.value = data.records
      if (announList.value && announList.value.length > 0) {
        const topAnnouncement = announList.value.find((item) => item.top)
        if (topAnnouncement) {
          announList.value = [topAnnouncement, ...announList.value.filter((item) => !item.top)]
        }
      }
      announNum.value = data.total
      announError.value = false
    } else {
      announError.value = false
    }
  } catch (error) {
    logger.error('加载群公告失败:', error)
    announError.value = true
  }
}

const handleTop = (value: boolean) => {
  const session = activeItem.value
  if (!session) return
  roomListService
    .setSessionTop(currentSessionRoomId.value, value)
    .then(() => {
      chatStore.updateSession(currentSessionRoomId.value, { top: value })
      showFeedback(
        value ? t('mobile_chat_setting.pinned_success') : t('mobile_chat_setting.unpinned_success'),
        'success'
      )
    })
    .catch(() => {
      showFeedback(t('mobile_chat_setting.pin_failed'), 'error')
    })
}

const handleInfoUpdate = async () => {
  const remarkChanged = remarkValue.value !== initialRemarkValue.value
  const nicknameChanged = nicknameValue.value !== initialNicknameValue.value

  if (!remarkChanged && !nicknameChanged) {
    return
  }

  if (isGroup.value) {
    await persistMyRoomInfo({
      roomId: globalStore.currentSessionRoomId,
      remark: remarkValue.value,
      myName: nicknameValue.value
    })
    initialRemarkValue.value = remarkValue.value
    initialNicknameValue.value = nicknameValue.value
  } else {
    if (!remarkChanged) {
      return
    }

    const detailId = activeItem.value?.detailId
    if (!detailId) {
      showFeedback(t('mobile_chat_setting.get_friend_info_failed'), 'warning')
      return
    }
    await contactStore.setFriendNote(detailId, remarkValue.value)

    if (friend.value) {
      friend.value.remark = remarkValue.value
    }
    initialRemarkValue.value = remarkValue.value
  }

  showFeedback(t('mobile_chat_setting.remark_updated', { n: title.value }), 'success')
}

const handleGroupInfoUpdate = async () => {
  const session = activeItem.value
  if (!session) return
  if (nameValue.value === initialNameValue.value) {
    return
  }

  await roomStateService.setRoomName(currentSessionRoomId.value, nameValue.value)
  if (avatarValue.value && avatarValue.value !== session.avatar) {
    await roomStateService.setRoomAvatar(currentSessionRoomId.value, avatarValue.value)
  }
  session.avatar = avatarValue.value
  session.name = nameValue.value
  chatStore.updateSession(currentSessionRoomId.value, {
    avatar: avatarValue.value,
    name: nameValue.value
  })

  initialNameValue.value = nameValue.value
  showFeedback(t('mobile_chat_setting.group_name_updated'), 'success')
}

const fetchGroupMembers = async (roomId: string) => {
  try {
    const userList = groupStore.getUserListByRoomId(roomId)
    const memberDetails = userList.map((member: UserItem) => {
      const userInfo = groupStore.getUserInfo(member.uid)!
      return {
        name: userInfo.name || member.name || member.uid,
        src: userInfo.avatar || member.avatar
      }
    })

    options.value = memberDetails
  } catch (error) {
    logger.error('获取群成员失败:', error)
  }
}

const handleShield = (value: boolean) => {
  const session = activeItem.value
  if (!session) return
  roomStateService
    .setRoomShield(currentSessionRoomId.value, value)
    .then(() => {
      chatStore.updateSession(currentSessionRoomId.value, {
        shield: value
      })

      const tempRoomId = globalStore.currentSessionRoomId

      nextTick(() => {
        globalStore.updateCurrentSessionRoomId(tempRoomId)
      })

      showFeedback(
        value ? t('mobile_chat_setting.messages_muted') : t('mobile_chat_setting.messages_unmuted'),
        'success'
      )
    })
    .catch(() => {
      showFeedback(t('mobile_chat_setting.setting_failed'), 'error')
    })
}

const handleNotification = (value: boolean) => {
  const session = activeItem.value
  if (!session) return
  const newType = value ? NotificationTypeEnum.NOT_DISTURB : NotificationTypeEnum.RECEPTION
  if (session.shield) {
    handleShield(false)
  }
  roomStateService
    .setRoomNotification(currentSessionRoomId.value, newType)
    .then(() => {
      chatStore.updateSession(currentSessionRoomId.value, {
        muteNotification: newType
      })

      if (session.muteNotification === NotificationTypeEnum.NOT_DISTURB && newType === NotificationTypeEnum.RECEPTION) {
        chatStore.updateTotalUnreadCount()
      }

      if (newType === NotificationTypeEnum.NOT_DISTURB) {
        chatStore.updateTotalUnreadCount()
      }

      showFeedback(
        value ? t('mobile_chat_setting.notifications_silent') : t('mobile_chat_setting.notifications_enabled'),
        'success'
      )
    })
    .catch(() => {
      showFeedback(t('mobile_chat_setting.setting_failed'), 'error')
    })
}

const handleSearchChatContent = () => {
  router.push({
    name: 'mobileSearchChatContent'
  })
}

onMounted(async () => {
  await handleLoadGroupAnnoun()
  if (isGroup.value) {
    try {
      const roomId = globalStore.currentSessionRoomId
      const response = await groupStore.loadGroupInfo(roomId)
      await groupStore.loadRoomMembers(roomId, true)

      if (response) {
        groupInfo.value = response
        nameValue.value = response.groupName || response.name || ''
        avatarValue.value = response.avatar || response.avatarUrl || ''
        nicknameValue.value = response.myName || ''
        remarkValue.value = response.remark || ''

        initialNameValue.value = nameValue.value
        initialNicknameValue.value = nicknameValue.value
        initialRemarkValue.value = remarkValue.value
        await fetchGroupMembers(roomId)
      }
    } catch (e: unknown) {
      logger.error('获取群组详情失败:', e)
    }
  } else {
    remarkValue.value = friend.value?.remark || ''
    initialRemarkValue.value = remarkValue.value
  }
})
</script>

<style scoped lang="scss">
:deep(.van-cell.van-field) {
  padding: 8px 0;
}

:deep(.van-cell.van-field::after) {
  display: none;
}
</style>
