<template>
  <!-- New Chat Dialog -->
  <van-dialog
    :show="showNewChatDialog"
    :title="t('mobile_home.new_chat_title')"
    show-cancel-button
    :confirm-button-text="t('common.confirm')"
    :cancel-button-text="t('common.cancel')"
    :before-close="beforeCloseNewChat"
    @update:show="emit('update:showNewChatDialog', $event)">
    <van-field
      :model-value="newChatUserId"
      :placeholder="t('mobile_home.user_id_placeholder')"
      class="mx-16px my-12px rounded-8px"
      @update:model-value="emit('update:newChatUserId', $event)" />
  </van-dialog>

  <!-- Create Group Chat Dialog -->
  <van-dialog
    :show="showCreateGroupDialog"
    :title="t('mobile_home.create_group_title')"
    show-cancel-button
    :confirm-button-text="t('common.confirm')"
    :cancel-button-text="t('common.cancel')"
    :before-close="beforeCloseCreateGroup"
    @update:show="emit('update:showCreateGroupDialog', $event)">
    <van-field
      :model-value="createGroupName"
      :placeholder="t('mobile_home.group_name_placeholder')"
      class="mx-16px mt-12px rounded-8px"
      @update:model-value="emit('update:createGroupName', $event)" />
    <van-field
      :model-value="createGroupMemberIds"
      :placeholder="t('mobile_home.group_members_placeholder')"
      class="mx-16px mt-8px mb-12px rounded-8px"
      @update:model-value="emit('update:createGroupMemberIds', $event)" />
  </van-dialog>
</template>

<script setup lang="ts">
import { useI18n } from 'vue-i18n'

defineOptions({ name: 'MobileCreateDialogs' })

defineProps<{
  showNewChatDialog: boolean
  newChatUserId: string
  showCreateGroupDialog: boolean
  createGroupName: string
  createGroupMemberIds: string
  beforeCloseNewChat: (action: string) => Promise<boolean>
  beforeCloseCreateGroup: (action: string) => Promise<boolean>
}>()

const emit = defineEmits<{
  (e: 'update:showNewChatDialog', value: boolean): void
  (e: 'update:newChatUserId', value: string): void
  (e: 'update:showCreateGroupDialog', value: boolean): void
  (e: 'update:createGroupName', value: string): void
  (e: 'update:createGroupMemberIds', value: string): void
}>()

const { t } = useI18n()
</script>
