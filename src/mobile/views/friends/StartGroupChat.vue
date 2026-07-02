<template>
  <div class="flex w-full flex-col h-full">
    <HeaderBar
      :isOfficial="false"
      :hidden-right="true"
      :enable-default-background="false"
      :enable-shadow="false"
      :room-name="t('mobile_chat_setting.start_group_chat')" />

    <!-- 顶部搜索框 -->
    <div class="px-16px mt-10px flex gap-3">
      <div class="flex-1 py-5px shrink-0">
        <van-field
          v-model="keyword"
          placeholder="搜索联系人~"
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

    <!-- 联系人列表 -->
    <div ref="scrollArea" class="flex-1 overflow-y-auto px-16px mt-10px" :style="{ height: scrollHeight + 'px' }">
      <div style="max-height: calc(100vh - 150px); overflow-y: auto">
        <van-checkbox-group v-model="selectedList" class="flex flex-col gap-2">
          <div
            v-for="item in filteredContacts"
            :key="item.uid"
            class="rounded-10px border border-[--hula-border-default] overflow-hidden">
            <van-checkbox
              :name="item.uid"
              shape="square"
              class="w-full flex items-center px-5px"
              :class="[
                'cursor-pointer select-none transition-colors duration-150',
                selectedList.includes(item.uid)
                  ? 'bg-[--hula-surface-panel-muted] border-blue-300'
                  : 'hover:bg-[--hula-surface-panel-muted] border-[--hula-border-default]'
              ]">
              <template #default>
                <div class="flex items-center gap-10px px-8px py-10px">
                  <img
                    :src="AvatarUtils.getAvatarUrl(groupStore.getUserInfo(item.uid)!.avatar!)"
                    class="size-44px rounded-full object-cover"
                    style="border: 1px solid var(--avatar-border-color)"
                    alt="用户头像"
                    @error="($event.target as HTMLImageElement).src = '/logo.png'" />
                  <div class="flex flex-col leading-tight truncate">
                    <span class="text-14px font-medium truncate">
                      {{ groupStore.getUserInfo(item.uid)!.name }}
                    </span>
                    <div class="text-12px text-[--hula-text-tertiary] flex items-center gap-4px truncate">
                      <template v-if="getUserState(item.uid)">
                        <img
                          class="size-12px rounded-50%"
                          :src="getUserState(item.uid)?.url"
                          :alt="getUserState(item.uid)?.title" />
                        <span>{{ getUserState(item.uid)?.title }}</span>
                      </template>
                      <template v-else>
                        <span
                          class="inline-block size-8px rounded-full"
                          :style="{
                            backgroundColor:
                              item.activeStatus === OnlineEnum.ONLINE ? 'var(--color-online)' : 'var(--color-offline)'
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
      class="px-16px py-10px bg-[--hula-surface-panel] border-t border-[--hula-border-default] flex justify-between items-center">
      <span class="text-14px">已选择 {{ selectedList.length }} 人</span>
      <van-button type="primary" :disabled="selectedList.length === 0" @click="createGroup">发起群聊</van-button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { storeToRefs } from 'pinia'
import { useI18n } from 'vue-i18n'
import { useActionFeedback } from '@/composables/common/useActionFeedback'
import { OnlineEnum } from '@/enums'
import { matrixRoomCreationService } from '@/services/matrix/room/CreationService'
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
  const userInfo = groupStore.getUserInfo(uid)!
  const userStateId = userInfo.userStateId

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

const doSearch = () => {}

const filteredContacts = computed(() => {
  const contactsList = contactStore.contactsList.filter((c) => {
    if (c.uid === '1') {
      return false
    }
    return true
  })

  if (!keyword.value) return contactsList
  return contactsList.filter((c) => {
    const name = groupStore.getUserInfo(c.uid)!.name
    if (name) {
      return name.includes(keyword.value)
    }
    return false
  })
})

const createGroup = async () => {
  if (selectedList.value.length < 2) {
    showFeedback('两个人无法建群哦', 'warning')
    return
  }

  try {
    const room = await matrixRoomCreationService.createRoom({
      invite: selectedList.value,
      is_direct: false,
      preset: 'private_chat' as any,
      visibility: 'private' as any
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
    showFeedback('创建群聊成功', 'success')
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
  border-radius: 20px;
  background: var(--hula-overlay-mobile-sheet);
}

:deep(.van-cell.van-field::after) {
  display: none;
}

:deep(.van-checkbox__label) {
  flex: 1;
}
</style>
