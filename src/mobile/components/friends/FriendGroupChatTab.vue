<template>
  <van-collapse :model-value="activeCollapseNames" @update:model-value="onCollapseUpdate">
    <van-collapse-item :title="t('mobile_contact.group.title')" name="1">
      <template #value>
        <span class="text-[length:var(--tjg-font-size-xs)] text-[--tjg-text-secondary]">
          {{ groupChatList.length }}
        </span>
      </template>
      <div class="max-h-[var(--friends-list-max-height)] overflow-y-auto">
        <div
          @click="emit('select', item.roomId)"
          :class="[{ active: activeId === item.roomId }, 'item-box w-full h-[var(--friends-item-height)] mb-5px']"
          v-for="item in groupChatList"
          :key="item.roomId">
          <div class="flex items-center gap-10px h-[var(--friends-item-height)] pl-6px pr-8px flex-1 truncate">
            <img
              class="size-44px rounded-full object-cover border-(1px solid var(--avatar-border-color))"
              :src="AvatarUtils.getAvatarUrl(item.avatar, 96)"
              :alt="t('mobile_contact.avatar.group')"
              @error="($event.target as HTMLImageElement).src = '/logo.png'" />
            <span class="text-[length:var(--tjg-font-size-base)] leading-tight flex-1 truncate">
              {{ item.remark || item.groupName }}
            </span>
          </div>
        </div>
      </div>
    </van-collapse-item>
  </van-collapse>
</template>

<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import { AvatarUtils } from '@/utils/AvatarUtils'

interface FriendGroupChatItem {
  roomId: string
  avatar: string
  groupName: string
  remark?: string | undefined
}

defineProps<{
  groupChatList: FriendGroupChatItem[]
  activeCollapseNames: string[]
  activeId: string | null
}>()

const emit = defineEmits<{
  'update:activeCollapseNames': [value: string[]]
  select: [roomId: string]
}>()

const { t } = useI18n()

const onCollapseUpdate = (value: string[]) => emit('update:activeCollapseNames', value)
</script>
