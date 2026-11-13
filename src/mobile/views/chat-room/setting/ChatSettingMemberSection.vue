<template>
  <ChatSettingMembers v-if="show" />

  <div
    v-if="showManageEntry"
    v-clickable
    class="bg-[--tjg-surface-panel] p-15px rounded-10px shadow text-14px flex cursor-pointer"
    @click="emit('manage-members')">
    {{ t('mobile_chat_setting.manage_group_members') }}
  </div>
</template>

<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import ChatSettingMembers from '@/mobile/views/chat-room/components/ChatSettingMembers.vue'

defineOptions({
  name: 'ChatSettingMemberSection'
})

defineProps<{
  show: boolean
  /** 管理群成员入口：权限判定由父组件完成，缺省视为无权 */
  showManageEntry?: boolean
}>()

const emit = defineEmits<{
  'manage-members': []
}>()

const { t } = useI18n()
</script>
