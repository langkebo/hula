<template>
  <div class="flex w-full flex-col h-full">
    <HeaderBar
      :isOfficial="false"
      :hidden-right="true"
      :enable-default-background="false"
      :enable-shadow="false"
      :room-name="t('mobile_chat_setting.start_group_chat')" />

    <!-- 顶部搜索框 -->
    <div class="px-16px mt-10px">
      <van-field
        v-model="keyword"
        :placeholder="t('mobile_chat_setting.search_contacts_hint')"
        clearable
        autocomplete="off"
        :spellcheck="false"
        autocorrect="off"
        autocapitalize="off">
        <template #left-icon>
          <svg class="w-12px h-12px" aria-hidden="true"><use href="#search"></use></svg>
        </template>
      </van-field>
    </div>

    <!-- 联系人列表 -->
    <div ref="scrollArea" class="flex-1 overflow-y-auto px-16px mt-10px" :style="{ height: scrollHeight + 'px' }">
      <div class="max-h-[calc(100dvh-150px)] overflow-y-auto">
        <MobileAsyncState
          v-if="showNoContactResult"
          state="empty"
          :empty-text="t('mobile_contact.search_no_result')"
          min-height="240px" />
        <van-checkbox-group v-else v-model="selectedList" class="flex flex-col gap-2">
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
                  ? 'bg-[--tjg-surface-panel-muted] border-blue-300'
                  : 'hover:bg-[--tjg-surface-panel-muted] border-[--tjg-border-default]'
              ]">
              <template #default>
                <div class="flex items-center gap-10px px-8px py-10px">
                  <img
                    :src="AvatarUtils.getAvatarUrl(groupStore.getUserInfo(item.userId)?.avatar, 96)"
                    class="size-44px rounded-full object-cover border-(1px solid var(--avatar-border-color))"
                    :alt="t('mobile_contact.avatar.user')"
                    @error="($event.target as HTMLImageElement).src = '/logo.png'" />
                  <div class="flex flex-col leading-tight truncate">
                    <span class="text-14px font-medium truncate">
                      {{ groupStore.getUserInfo(item.userId)?.name }}
                    </span>
                    <div class="text-12px text-[--tjg-text-tertiary] flex items-center gap-4px truncate">
                      <template v-if="getUserState(item.userId)">
                        <img
                          class="size-12px rounded-50%"
                          :src="getUserState(item.userId)?.url"
                          :alt="getUserState(item.userId)?.title" />
                        <span>{{ getUserState(item.userId)?.title }}</span>
                      </template>
                      <template v-else>
                        <span
                          class="inline-block size-8px rounded-full"
                          :style="{
                            backgroundColor:
                              item.activeStatus === OnlineEnum.ONLINE
                                ? 'var(--tjg-status-online)'
                                : 'var(--tjg-status-offline)'
                          }"></span>
                        <span>
                          {{
                            item.activeStatus === OnlineEnum.ONLINE
                              ? t('mobile_contact.status.online')
                              : t('mobile_contact.status.offline')
                          }}
                        </span>
                      </template>
                    </div>
                  </div>
                </div>
              </template>
            </van-checkbox>
          </div>
        </van-checkbox-group>
      </div>
    </div>

    <!-- 底部操作栏 -->
    <div
      class="px-16px py-10px bg-[--tjg-surface-panel] border-t border-[--tjg-border-default] flex justify-between items-center">
      <div class="flex flex-col gap-2px">
        <span class="text-14px">{{ t('mobile_chat_setting.selected_count', { count: selectedList.length }) }}</span>
        <span v-if="selectedList.length === 1" class="text-12px text-[--tjg-color-warning-700]">
          {{ t('mobile_chat_setting.create_group_need_two') }}
        </span>
      </div>
      <van-button type="primary" :disabled="selectedList.length < 2" @click="createGroup">
        {{ t('mobile_chat_setting.start_group_chat') }}
      </van-button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { storeToRefs } from 'pinia'
import { useI18n } from 'vue-i18n'
import { useActionFeedback } from '@/composables/common/useActionFeedback'
import { OnlineEnum } from '@/enums'
import MobileAsyncState from '@/mobile/components/common/MobileAsyncState.vue'
import { matrixRoomCreationService } from '@/services/matrix/room/CreationService'
import { Preset, Visibility } from '@/services/matrix/sdk'
import { useChatStore } from '@/stores/domains/chat/chat'
import { useContactStore } from '@/stores/domains/chat/contacts'
import { useGroupStore } from '@/stores/domains/chat/group'
import { useUserStatusStore } from '@/stores/domains/user/userStatus'
import { useGlobalStore } from '@/stores/domains/widget/global'
import { AvatarUtils } from '@/utils/AvatarUtils'

const { t } = useI18n()
const { showFeedback } = useActionFeedback()
const userStatusStore = useUserStatusStore()
const { stateList } = storeToRefs(userStatusStore)
const groupStore = useGroupStore()
const chatStore = useChatStore()
const globalStore = useGlobalStore()

const getUserState = (uid: string) => {
  const userInfo = groupStore.getUserInfo(uid)
  const userStateId = userInfo?.userStateId

  if (userStateId && userStateId !== '1') {
    return stateList.value.find((state: { id: string }) => state.id === userStateId)
  }
  return null
}

const contactStore = useContactStore()

const keyword = ref('')

const selectedList = ref<string[]>([])

const scrollHeight = ref(600)
onMounted(() => {
  scrollHeight.value = window.innerHeight - 180
})

const filteredContacts = computed(() => {
  const contactsList = contactStore.contactsList.filter((c) => {
    if (c.userId === '1') {
      return false
    }
    return true
  })

  const kw = keyword.value.trim().toLowerCase()
  if (!kw) return contactsList
  return contactsList.filter((c) => {
    const info = groupStore.getUserInfo(c.userId)
    const name = info?.name?.toLowerCase() || ''
    const account = info?.account?.toLowerCase() || ''
    const userId = String(c.userId).toLowerCase()
    return name.includes(kw) || account.includes(kw) || userId.includes(kw)
  })
})

/** 已输入关键词且无匹配联系人：交给 MobileAsyncState 统一渲染空态 */
const showNoContactResult = computed(() => keyword.value.trim().length > 0 && filteredContacts.value.length === 0)

const createGroup = async () => {
  if (selectedList.value.length < 2) {
    showFeedback(t('mobile_chat_setting.create_group_need_two'), 'warning')
    return
  }

  try {
    const room = await matrixRoomCreationService.createRoom({
      invite: selectedList.value,
      is_direct: false,
      preset: Preset.PrivateChat,
      visibility: Visibility.Private
    })

    await chatStore.getSessionList(true)

    const resultRoomId = room?.roomId != null ? String(room.roomId) : undefined

    const matchedSession = chatStore.sessionList.find((session) => {
      const sessionRoomId = String(session.roomId)
      const sessionDetailId = session.detailId != null ? String(session.detailId) : undefined
      return (
        (resultRoomId !== undefined && sessionRoomId === resultRoomId) ||
        (resultRoomId !== undefined && (sessionDetailId === resultRoomId || sessionRoomId === resultRoomId))
      )
    })

    if (matchedSession?.roomId) {
      globalStore.updateCurrentSessionRoomId(matchedSession.roomId)
      await Promise.all([
        groupStore.addGroupDetail(matchedSession.roomId),
        groupStore.getGroupUserList(matchedSession.roomId, true)
      ])
    }

    resetCreateGroupState()
    showFeedback(t('mobile_chat_setting.create_group_success'), 'success')
  } catch (error) {
    showFeedback(t('mobile_chat_setting.create_group_failed'), 'error')
  }
}

const resetCreateGroupState = () => {
  selectedList.value = []
  keyword.value = ''
}
</script>

<style lang="scss" scoped>
:deep(.van-cell.van-field) {
  padding: 8px 12px;
  border-radius: var(--tjg-radius-2xl);
  background: var(--tjg-overlay-mobile-sheet);
}

:deep(.van-cell.van-field::after) {
  display: none;
}

:deep(.van-checkbox__label) {
  flex: 1;
}
</style>
