<template>
  <AutoFixHeightPage :show-footer="false">
    <template #header>
      <HeaderBar
        :isOfficial="false"
        :hidden-right="true"
        :enable-default-background="false"
        :enable-shadow="false"
        :room-name="t('mobile_chat_setting.invite_group_member_title')" />
    </template>

    <template #container>
      <!-- 顶部搜索框 -->
      <div class="px-16px mt-10px flex gap-3">
        <div class="flex-1 shrink-0">
          <van-field
            v-model="keyword"
            :placeholder="t('mobile_chat_setting.search_contacts_hint')"
            clearable
            autocomplete="off"
            :spellcheck="false"
            autocorrect="off"
            autocapitalize="off">
            <template #left-icon>
              <svg class="w-12px h-12px"><use href="#search"></use></svg>
            </template>
          </van-field>
        </div>
        <div class="flex justify-end items-center">
          <van-button size="small" type="primary" plain round @click="doSearch">
            {{ t('mobile_chat_setting.search_button') }}
          </van-button>
        </div>
      </div>

      <!-- 好友列表 -->
      <div class="flex-1 min-h-0 overflow-y-auto px-16px mt-10px">
        <van-checkbox-group v-model="selectedList" class="flex flex-col gap-2">
          <div
            v-for="item in filteredContacts"
            :key="item.userId"
            class="rounded-10px border border-[--tjg-border-default] overflow-hidden">
            <van-checkbox
              :name="item.userId"
              shape="square"
              class="w-full flex items-center px-5px"
              :class="[
                'cursor-pointer select-none transition-colors duration-150',
                selectedList.includes(item.userId)
                  ? 'bg-[--tjg-color-primary-100] text-[--tjg-color-primary-600] dark:bg-[--tjg-color-primary-100] dark:text-[--tjg-color-primary-400]'
                  : 'hover:bg-[--tjg-color-primary-100] dark:hover:bg-[--tjg-color-primary-100]'
              ]">
              <template #default>
                <div class="flex items-center gap-10px px-8px py-10px">
                  <img
                    :src="AvatarUtils.getAvatarUrl(groupStore.getUserInfo(item.userId)?.avatar!, 96)"
                    class="size-44px rounded-full object-cover border-[1px] border-[--avatar-border-color]"
                    :alt="t('mobile_contact.avatar.user')"
                    @error="($event.target as HTMLImageElement).src = '/logo.png'" />
                  <div class="flex flex-col leading-tight truncate">
                    <span class="text-14px font-medium truncate">
                      {{ groupStore.getUserInfo(item.userId)?.name }}
                    </span>
                    <div class="text-12px text-[--tjg-text-tertiary] flex items-center gap-4px truncate">
                      <span
                        class="inline-block size-8px rounded-full"
                        :style="{
                          backgroundColor:
                            item.activeStatus === OnlineEnum.ONLINE
                              ? 'var(--tjg-status-online)'
                              : 'var(--tjg-status-offline)'
                        }"></span>
                      {{
                        item.activeStatus === OnlineEnum.ONLINE
                          ? t('mobile_contact.status.online')
                          : t('mobile_contact.status.offline')
                      }}
                    </div>
                  </div>
                </div>
              </template>
            </van-checkbox>
          </div>
        </van-checkbox-group>
      </div>
    </template>

    <template #footer>
      <!-- 底部操作栏 -->
      <div class="px-16px py-10px border-t border-[--tjg-border-default] flex justify-between items-center">
        <span class="text-14px">{{ t('mobile_chat_setting.selected_count', { count: selectedList.length }) }}</span>
        <van-button type="primary" :disabled="selectedList.length === 0" :loading="isLoading" @click="handleInvite">
          {{ t('mobile_chat_setting.invite_button') }}
        </van-button>
      </div>
    </template>
  </AutoFixHeightPage>
</template>

<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import { useActionFeedback } from '@/composables/common/useActionFeedback'
import { OnlineEnum } from '@/enums'
import router from '@/router'
import { matrixRoomMembershipService } from '@/services/matrix/room/MembershipService'
import { useChatStore } from '@/stores/domains/chat/chat'
import { useContactStore } from '@/stores/domains/chat/contacts'
import { useGroupStore } from '@/stores/domains/chat/group'
import { useGlobalStore } from '@/stores/domains/widget/global'
import { AvatarUtils } from '@/utils/AvatarUtils'
import { createLogger } from '@/utils/Logger'

const logger = createLogger('MobileInviteGroupMember')
const { t } = useI18n()
const { showFeedback } = useActionFeedback()

defineOptions({
  name: 'mobileInviteGroupMember'
})

const contactStore = useContactStore()
const globalStore = useGlobalStore()
const groupStore = useGroupStore()

const keyword = ref('')
const selectedList = ref<string[]>([])
const isLoading = ref(false)

const allContacts = computed(() => {
  return contactStore.contactsList.filter((item) => {
    if (item.userId === '1') {
      return false
    }
    const isInGroup = groupStore.memberList.some((member) => member.uid === item.userId)
    return !isInGroup
  })
})

const filteredContacts = computed(() => {
  if (!keyword.value.trim()) {
    return allContacts.value
  }

  const searchKeyword = keyword.value.toLowerCase()
  return allContacts.value.filter((item) => {
    const userInfo = groupStore.getUserInfo(item.userId)
    if (!userInfo) return false
    return userInfo.name.toLowerCase().includes(searchKeyword) || userInfo.account.toLowerCase().includes(searchKeyword)
  })
})

const doSearch = () => {}

const handleInvite = async () => {
  if (selectedList.value.length === 0) {
    showFeedback(t('mobile_chat_setting.select_friends_to_invite'), 'warning')
    return
  }

  isLoading.value = true
  try {
    await Promise.all(
      selectedList.value.map((uid: string) =>
        matrixRoomMembershipService.inviteUser(globalStore.currentSessionRoomId, uid)
      )
    )

    showFeedback(t('mobile_chat_setting.invite_success', { count: selectedList.value.length }), 'success')
    router.back()
  } catch (error) {
    logger.error('Failed to invite:', error)
    showFeedback(t('mobile_chat_setting.invite_failed'), 'error')
  } finally {
    isLoading.value = false
  }
}

onMounted(async () => {
  try {
    const chatStore = useChatStore()
    const groupSessions = chatStore.getGroupSessions()

    if (globalStore.currentSessionRoomId) {
      await groupStore.getGroupUserList(globalStore.currentSessionRoomId)
    }

    await Promise.all(
      groupSessions
        .filter((session) => session.roomId !== globalStore.currentSessionRoomId)
        .map((session) => groupStore.getGroupUserList(session.roomId))
    )
  } catch (error) {
    logger.error('Failed to load user info:', error)
  }
})
</script>

<style scoped lang="scss">
:deep(.van-cell.van-field) {
  padding: 8px 12px;
  border-radius: 10px;
  background: var(--tjg-overlay-mobile-sheet);
}

:deep(.van-cell.van-field::after) {
  display: none;
}

:deep(.van-checkbox__label) {
  flex: 1;
}
</style>
