<template>
  <div class="bg-[--tjg-surface-panel] rounded-10px">
    <div class="flex items-center justify-between p-[15px_15px_0px_15px]">
      <span class="text-14px font-medium">{{ t('mobile_chat_setting.group_members_title') }}</span>
      <div
        @click="toGroupChatMember"
        class="text-12px text-[--tjg-text-secondary] flex flex-wrap gap-10px items-center">
        <i18n-t keypath="mobile_chat_setting.member_count">
          <template #count>
            <span class="text-[--tjg-color-primary-500]">{{ groupStore.countInfo?.memberNum || 0 }}</span>
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
            class="rounded-full relative bg-[--tjg-color-primary-100] w-36px h-36px flex items-center justify-center">
            <div
              v-if="i.activeStatus !== OnlineEnum.ONLINE"
              class="w-36px h-36px absolute rounded-full bg-[--tjg-text-tertiary] opacity-60 z-4"></div>
            <img
              class="absolute z-3 size-36px rounded-full object-cover"
              :src="avatarSrc(i.avatar)"
              :alt="t('mobile_contact.avatar.user')"
              @error="($event.target as HTMLImageElement).src = '/logo.png'" />
          </div>
          <div class="truncate max-w-full text-[--tjg-text-secondary]">{{ i.name }}</div>
        </div>
        <div class="flex flex-col justify-center items-center gap-5px cursor-pointer">
          <van-button plain round size="small" icon="plus" @click="toInviteGroupMember" />
          <div>{{ t('mobile_chat_setting.group_invite_member') }}</div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { I18nT, useI18n } from 'vue-i18n'
import { OnlineEnum } from '@/enums'
import router from '@/router'
import { useGroupStore } from '@/stores/domains/chat/group'
import { AvatarUtils } from '@/utils/AvatarUtils'
import { toFriendInfoPage } from '@/utils/RouterUtils'

defineOptions({
  name: 'ChatSettingMembers'
})

const { t } = useI18n()
const groupStore = useGroupStore()

const groupMemberListSliced = computed(() => groupStore.memberList.slice(0, 9))

const avatarSrc = (url: string) => AvatarUtils.getAvatarUrl(url)

const toFriendInfo = (uid: string) => {
  toFriendInfoPage(uid)
}

const toGroupChatMember = () => {
  router.push({ name: 'mobileGroupChatMember' })
}

const toInviteGroupMember = () => {
  router.push({ name: 'mobileInviteGroupMember' })
}
</script>
