<template>
  <!-- 外层 ChatRoomLayout 已提供完整高度，此处不可再嵌套任何布局容器，否则键盘 inset 会叠加两次 -->
  <div class="flex w-full flex-col h-full">
    <HeaderBar
      :isOfficial="false"
      :hidden-right="true"
      :enable-default-background="false"
      :enable-shadow="false"
      :room-name="t('home.manage_group_member.title')" />

    <!-- 顶部搜索框 -->
    <div class="px-16px mt-10px">
      <van-search
        v-model="keyword"
        shape="round"
        background="transparent"
        :placeholder="t('home.manage_group_member.search_placeholder_mobile')" />
    </div>

    <!-- 成员列表：唯一滚动容器 -->
    <div class="flex-1 min-h-0 overflow-y-auto px-16px mt-10px pb-10px">
      <van-checkbox-group v-model="selectedList" class="flex flex-col gap-2">
        <div
          v-for="item in filteredMembers"
          :key="item.uid"
          class="rounded-10px border overflow-hidden transition-colors duration-150"
          :class="
            selectedList.includes(item.uid)
              ? 'border-[--tjg-color-primary-300] bg-[--tjg-color-primary-100]'
              : 'border-[--tjg-border-default]'
          ">
          <van-checkbox :name="item.uid" shape="square" class="w-full px-5px" icon-size="20px">
            <div class="flex items-center gap-10px px-8px py-10px w-full">
              <img
                :src="AvatarUtils.getAvatarUrl(groupStore.getUserInfo(item.uid)?.avatar!, 128)"
                :alt="groupStore.getUserInfo(item.uid)?.name || ''"
                class="size-44px rounded-full object-cover border-(1px solid var(--avatar-border-color))"
                @error="handleAvatarError" />
              <div class="flex flex-col leading-tight truncate">
                <span class="text-14px font-medium truncate text-[--tjg-text-primary]">
                  {{ groupStore.getUserInfo(item.uid)?.name }}
                </span>
                <div class="text-12px text-[--tjg-text-secondary] flex items-center gap-4px truncate">
                  <span
                    class="size-6px rounded-full flex-shrink-0"
                    :class="
                      item.activeStatus === OnlineEnum.ONLINE ? 'bg-[--tjg-status-online]' : 'bg-[--tjg-status-offline]'
                    "></span>
                  {{
                    item.activeStatus === OnlineEnum.ONLINE
                      ? t('home.friends_list.status.online')
                      : t('home.friends_list.status.offline')
                  }}
                </div>
              </div>
            </div>
          </van-checkbox>
        </div>
      </van-checkbox-group>
    </div>

    <div
      class="px-16px py-10px bg-[--tjg-surface-panel] border-t border-[--tjg-border-default] flex justify-between items-center">
      <span class="text-14px text-[--tjg-text-primary]">
        {{ t('home.manage_group_member.selected_count', { count: selectedList.length }) }}
      </span>
      <van-button
        type="danger"
        size="small"
        :disabled="selectedList.length === 0"
        :loading="isLoading"
        @click="handleMobileRemove">
        {{ t('home.manage_group_member.remove_button') }}
      </van-button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { showConfirmDialog } from 'vant'
import 'vant/es/dialog/style'
import { useI18n } from 'vue-i18n'
import HeaderBar from '#/components/chat-room/HeaderBar.vue'
import { useSafeBack } from '#/composables/useSafeBack'
import { useActionFeedback } from '@/composables/common/useActionFeedback'
import { OnlineEnum } from '@/enums'
import { useGroupStore } from '@/stores/domains/chat/group'
import { useGlobalStore } from '@/stores/domains/widget/global'
import { AvatarUtils } from '@/utils/AvatarUtils'
import { createLogger } from '@/utils/Logger'

const logger = createLogger('ManageGroupMember')

defineOptions({
  name: 'ManageGroupMember'
})

const groupStore = useGroupStore()
const globalStore = useGlobalStore()
const { t } = useI18n()
const { showFeedback } = useActionFeedback()
const { goBack } = useSafeBack()

const keyword = ref('')
const selectedList = ref<string[]>([])
const isLoading = ref(false)

// 请求期间用户可能已手动返回，成功后不能再触发一次返回
let isUnmounted = false

onUnmounted(() => {
  isUnmounted = true
})

// group store 的 roleId 使用 0 群主 / 1 管理员 / 2 普通成员，与 RoleEnum 取值不同
const ROLE_ID_NORMAL_MEMBER = 2

const normalMembers = computed(() => {
  return groupStore.memberList.filter((item) => item.roleId === ROLE_ID_NORMAL_MEMBER)
})

const filteredMembers = computed(() => {
  if (!keyword.value.trim()) {
    return normalMembers.value
  }

  const searchKeyword = keyword.value.toLowerCase()
  return normalMembers.value.filter((item) => {
    const userInfo = groupStore.getUserInfo(item.uid)
    if (!userInfo) return false
    return userInfo.name.toLowerCase().includes(searchKeyword) || userInfo.account.toLowerCase().includes(searchKeyword)
  })
})

const handleAvatarError = (event: Event) => {
  const target = event.target as HTMLImageElement
  if (target.src.endsWith('/logo.png')) return
  target.src = '/logo.png'
}

const handleClose = () => {
  goBack()
}

const validateRemoval = () => {
  if (globalStore.currentSessionRoomId === '1') {
    showFeedback(t('home.manage_group_member.channel_not_allowed'), 'warning')
    return false
  }

  if (selectedList.value.length === 0) {
    showFeedback(t('home.manage_group_member.select_member_warning'), 'warning')
    return false
  }

  return true
}

const handleRemove = async () => {
  if (isLoading.value) return false

  if (!validateRemoval()) {
    return false
  }

  const members = [...selectedList.value]
  const count = members.length

  isLoading.value = true
  try {
    await groupStore.removeGroupMembers(members, globalStore.currentSessionRoomId)

    showFeedback(t('home.manage_group_member.remove_success', { count }), 'success')
    selectedList.value = []
    if (!isUnmounted) handleClose()
    return true
  } catch (error) {
    logger.error('Failed to remove member:', error)
    showFeedback(t('home.manage_group_member.remove_failed'), 'error')
    return false
  } finally {
    isLoading.value = false
  }
}

const handleMobileRemove = async () => {
  if (isLoading.value) return

  if (!validateRemoval()) return

  try {
    await showConfirmDialog({
      title: t('home.manage_group_member.confirm_remove_title'),
      message: t('home.manage_group_member.remove_confirm', { count: selectedList.value.length }),
      confirmButtonText: t('home.manage_group_member.dialog_positive'),
      cancelButtonText: t('home.manage_group_member.dialog_negative')
    })
  } catch {
    return
  }

  await handleRemove()
}

onMounted(async () => {
  if (globalStore.currentSessionRoomId === '1') {
    showFeedback(t('home.manage_group_member.channel_manage_unsupported'), 'warning')
    handleClose()
    return
  }

  try {
    if (globalStore.currentSessionRoomId) {
      await groupStore.getGroupUserList(globalStore.currentSessionRoomId)
    }
  } catch (error) {
    logger.error('Failed to load member list:', error)
  }
})
</script>

<style scoped lang="scss">
:deep(.van-checkbox__label) {
  flex: 1;
  min-width: 0;
}

:deep(.van-search__content) {
  background: var(--tjg-surface-search);
}
</style>
