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
          <div class="bg-[--tjg-surface-panel] rounded-10px p-0">
            <div v-clickable class="flex py-10px rounded-10px w-full items-center gap-10px" @click="clickInfo">
              <!-- 群头像 -->
              <div class="flex justify-center">
                <div class="rounded-full relative bg-[--tjg-surface-panel] w-38px h-38px overflow-hidden ml-10px">
                  <img
                    class="absolute size-38px rounded-full object-cover centered-overlay"
                    :src="AvatarUtils.getAvatarUrl(activeItem?.avatar || '')"
                    :alt="t('mobile_contact.avatar.group')"
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
                  <svg class="w-18px h-18px iconpark-icon text-[--tjg-color-primary-500]">
                    <use href="#auth"></use>
                  </svg>
                </span>
              </div>
            </div>
          </div>

          <!-- 群成员  -->
          <ChatSettingMembers v-if="isGroup" />

          <!-- 管理群成员 -->
          <div
            v-if="isGroup && groupStore.isAdminOrLord() && globalStore.currentSessionRoomId !== '1'"
            v-clickable
            class="bg-[--tjg-surface-panel] p-15px rounded-10px shadow text-14px flex cursor-pointer"
            @click="toManageGroupMember">
            {{ t('mobile_chat_setting.manage_group_members') }}
          </div>

          <div
            v-clickable
            class="bg-[--tjg-surface-panel] rounded-10px p-15px cursor-pointer"
            @click="handleSearchChatContent">
            {{ t('mobile_chat_setting.search_history') }}
          </div>

          <!-- 群公告 & 信息 -->
          <ChatSettingRoomInfo
            :avatar-mxc="avatarValue"
            :group-info="groupInfo"
            :announcements="announList"
            :initial-remark="initialRoomRemark" />

          <!-- 设置 -->
          <ChatSettingToggles
            :can-upgrade="isGroup && roomUpgradeFlow.canUpgrade.value"
            :current-version="roomUpgradeFlow.currentVersion.value"
            :can-manage="isGroup && listMgmt.canManage.value"
            :allowlist-count="listMgmt.allowlistCount.value"
            :denylist-count="listMgmt.denylistCount.value"
            @upgrade="showRoomUpgrade = true"
            @manage="openListManagement" />

          <van-button
            plain
            class="cursor-pointer text-red text-14px rounded-10px w-full mb-20px"
            @click="handleClearHistory">
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
  <MobileRoomUpgradeDialog v-model:visible="showRoomUpgrade" :room-id="currentSessionRoomId" :can-upgrade="!!isAdmin" />
  <MobileListManagementDialog
    v-model:visible="showListManagement"
    :room-id="currentSessionRoomId"
    :can-manage="!!isAdmin"
    :initial-tab="listManagementTab" />
</template>

<script setup lang="ts">
import { showConfirmDialog } from 'vant'
import { useI18n } from 'vue-i18n'
import MobileListManagementDialog from '#/views/chat-room/MobileListManagementDialog.vue'
import MobileRoomUpgradeDialog from '#/views/chat-room/MobileRoomUpgradeDialog.vue'
import { useActionFeedback } from '@/composables/common/useActionFeedback'
import { useMitt } from '@/composables/common/useMitt'
import { useRoomListManagement } from '@/composables/room/useRoomListManagement'
import { useRoomUpgradeFlow } from '@/composables/room/useRoomUpgradeFlow'
import { useAvatarUpload } from '@/composables/user/useAvatarUpload'
import { MittEnum, RoleEnum, RoomTypeEnum, TauriCommand } from '@/enums'
import ChatSettingMembers from '@/mobile/views/chat-room/components/ChatSettingMembers.vue'
import ChatSettingRoomInfo from '@/mobile/views/chat-room/components/ChatSettingRoomInfo.vue'
import ChatSettingToggles from '@/mobile/views/chat-room/components/ChatSettingToggles.vue'
import router from '@/router'
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
import { invokeWithErrorHandler } from '@/utils/TauriInvokeHandler'

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

const showRoomUpgrade = ref(false)
const roomUpgradeFlow = useRoomUpgradeFlow({
  roomId: currentSessionRoomId.value,
  canUpgrade: isAdmin.value
})

const showListManagement = ref(false)
const listManagementTab = ref<'allowlist' | 'denylist'>('allowlist')
const listMgmt = useRoomListManagement({
  roomId: currentSessionRoomId.value,
  canManage: isAdmin.value
})

const openListManagement = (tab: 'allowlist' | 'denylist') => {
  listManagementTab.value = tab
  showListManagement.value = true
}

const announError = ref(false)
const announNum = ref(0)
const isAddAnnoun = ref(false)
const announList = ref<GroupAnnouncementListItem[]>([])

const groupInfo = ref<MatrixGroupInfo | null>(null)
const avatarValue = ref('')
const initialRoomRemark = ref('')
const options = ref<Array<{ name: string; src: string }>>([])
const { currentSession: activeItem } = storeToRefs(globalStore)
const friend = computed(() => contactStore.contactsList.find((item) => item.userId === activeItem.value?.detailId))

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

const toManageGroupMember = () => {
  router.push({ name: 'manageGroupMember' })
}

async function handleClearHistory() {
  const roomId = currentSessionRoomId.value
  if (!roomId) {
    showFeedback(t('mobile_chat_setting.session_not_ready'), 'warning')
    return
  }

  try {
    await showConfirmDialog({
      title: t('components.common.confirm'),
      message: t('mobile_chat_setting.confirm_clear_history'),
      confirmButtonText: t('components.common.confirm'),
      cancelButtonText: t('components.common.cancel')
    })
  } catch {
    return
  }

  try {
    await invokeWithErrorHandler<number>(TauriCommand.DELETE_ROOM_MESSAGES, { roomId })
    chatStore.clearRoomMessages(roomId)
    showFeedback(t('mobile_chat_setting.clear_history_success'), 'success')
  } catch (error) {
    logger.error('Failed to clear chat history:', error)
    showFeedback(t('mobile_chat_setting.clear_history_failed'), 'error')
  }
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
      logger.error('Operation failed:', error)
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
      logger.error('No roomId for current session')
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
    logger.error('Failed to load group announcements:', error)
    announError.value = true
  }
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
    logger.error('Failed to fetch group members:', error)
  }
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
        avatarValue.value = response.avatar || response.avatarUrl || ''
        await fetchGroupMembers(roomId)
      }
    } catch (e: unknown) {
      logger.error('Failed to fetch group details:', e)
    }
  } else {
    initialRoomRemark.value = friend.value?.remark || ''
  }
})
</script>

<style scoped lang="scss">
.centered-overlay {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
}
</style>
