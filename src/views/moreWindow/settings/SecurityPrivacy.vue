<template>
  <n-flex vertical :size="40">
    <n-flex vertical class="text-(14px [--text-color])" :size="16">
      <span class="pl-10px">{{ t('setting.security_privacy.online_status') }}</span>

      <n-flex class="item p-12px" :size="12" vertical>
        <n-flex align="center" justify="space-between">
          <n-flex vertical :size="4">
            <span>{{ t('setting.security_privacy.presence_status') }}</span>
            <span class="text-(12px #909090)">{{ t('setting.security_privacy.presence_status_desc') }}</span>
          </n-flex>
          <PresenceSelector v-model:presence="currentPresence" @change="handlePresenceChange" />
        </n-flex>

        <span class="w-full h-1px bg-[--line-color]"></span>

        <n-flex align="center" justify="space-between">
          <n-flex vertical :size="4">
            <span>{{ t('setting.security_privacy.show_online_status') }}</span>
            <span class="text-(12px #909090)">{{ t('setting.security_privacy.show_online_status_desc') }}</span>
          </n-flex>
          <n-switch size="small" v-model:value="showOnlineStatus" @update:value="handleOnlineStatusChange" />
        </n-flex>

        <span class="w-full h-1px bg-[--line-color]"></span>

        <n-flex align="center" justify="space-between">
          <n-flex vertical :size="4">
            <span>{{ t('setting.security_privacy.show_typing_status') }}</span>
            <span class="text-(12px #909090)">{{ t('setting.security_privacy.show_typing_status_desc') }}</span>
          </n-flex>
          <n-switch size="small" v-model:value="showTypingStatus" />
        </n-flex>

        <span class="w-full h-1px bg-[--line-color]"></span>

        <n-flex align="center" justify="space-between">
          <n-flex vertical :size="4">
            <span>{{ t('setting.security_privacy.share_read_receipts') }}</span>
            <span class="text-(12px #909090)">{{ t('setting.security_privacy.share_read_receipts_desc') }}</span>
          </n-flex>
          <n-switch size="small" v-model:value="shareReadReceipts" />
        </n-flex>

        <span class="w-full h-1px bg-[--line-color]"></span>

        <n-flex align="center" justify="space-between">
          <n-flex vertical :size="4">
            <span>{{ t('setting.security_privacy.hide_presence_strangers') }}</span>
            <span class="text-(12px #909090)">{{ t('setting.security_privacy.hide_presence_strangers_desc') }}</span>
          </n-flex>
          <n-switch size="small" v-model:value="hidePresenceStrangers" />
        </n-flex>
      </n-flex>
    </n-flex>

    <n-flex vertical class="text-(14px [--text-color])" :size="16">
      <span class="pl-10px">{{ t('setting.security_privacy.blocked_users') }}</span>

      <n-flex class="item p-12px" :size="12" vertical>
        <n-flex class="mb-12px" justify="space-between" align="center">
          <n-input
            v-model:value="searchKeyword"
            size="small"
            :placeholder="t('setting.security_privacy.search_placeholder')"
            clearable
            style="width: 200px">
            <template #prefix>
              <svg class="size-14px"><use href="#search"></use></svg>
            </template>
          </n-input>
          <n-button size="small" type="primary" @click="showAddModal = true">
            {{ t('setting.security_privacy.add_user') }}
          </n-button>
        </n-flex>

        <div v-if="filteredBlockedUsers.length === 0" class="text-(12px #909090) text-center py-20px">
          {{ t('setting.security_privacy.no_blocked_users') }}
        </div>

        <n-scrollbar v-else style="max-height: 300px">
          <template v-for="(user, index) in filteredBlockedUsers" :key="user.user_id">
            <n-flex align="center" justify="space-between" class="py-12px">
              <n-flex align="center" :size="12">
                <img :src="user.avatar" class="w-32px h-32px rounded-full" :alt="user.name" />
                <n-flex vertical :size="2">
                  <span class="text-14px">{{ user.name }}</span>
                  <span class="text-(12px #909090)">{{ user.user_id }}</span>
                </n-flex>
              </n-flex>
              <n-button size="small" type="error" secondary @click="handleUnblockUser(user)">
                {{ t('setting.security_privacy.unblock') }}
              </n-button>
            </n-flex>
            <span v-if="index < filteredBlockedUsers.length - 1" class="w-full h-1px bg-[--line-color] block"></span>
          </template>
        </n-scrollbar>
      </n-flex>
    </n-flex>
  </n-flex>

  <n-modal v-model:show="showAddModal" preset="card" :title="t('setting.security_privacy.add_user')" style="width: 400px">
    <n-input
      v-model:value="newUserId"
      :placeholder="t('setting.security_privacy.enter_user_id')"
      clearable />
    <template #footer>
      <n-flex justify="flex-end" :size="12">
        <n-button @click="showAddModal = false">{{ t('common.cancel') }}</n-button>
        <n-button type="primary" @click="handleAddUser">{{ t('common.confirm') }}</n-button>
      </n-flex>
    </template>
  </n-modal>
</template>

<script setup lang="ts">
import { NButton, NSwitch, NInput, NModal, NScrollbar, useMessage } from 'naive-ui'
import { useI18n } from 'vue-i18n'
import { PresenceSelector } from '@/components/presence'
import matrixPresenceService from '@/services/matrix/MatrixPresenceService'
import type { PresenceStatus } from '@/services/matrix/MatrixPresenceService'

interface BlockedUser {
  user_id: string
  name: string
  avatar: string
}

const { t } = useI18n()
const message = useMessage()

const currentPresence = ref<PresenceStatus>('online')
const showOnlineStatus = ref(true)
const showTypingStatus = ref(true)
const shareReadReceipts = ref(true)
const hidePresenceStrangers = ref(false)

const searchKeyword = ref('')
const showAddModal = ref(false)
const newUserId = ref('')

const blockedUsers = ref<BlockedUser[]>([])

const filteredBlockedUsers = computed(() => {
  if (!searchKeyword.value) return blockedUsers.value
  return blockedUsers.value.filter(
    (user) =>
      user.name.toLowerCase().includes(searchKeyword.value.toLowerCase()) ||
      user.user_id.toLowerCase().includes(searchKeyword.value.toLowerCase())
  )
})

const handlePresenceChange = async (status: PresenceStatus) => {
  try {
    await matrixPresenceService.setPresence(status)
    message.success(t('setting.security_privacy.presence_updated', '在线状态已更新'))
  } catch {
    message.error(t('setting.security_privacy.presence_update_failed', '在线状态更新失败'))
  }
}

const handleOnlineStatusChange = async (value: boolean) => {
  try {
    if (value) {
      await matrixPresenceService.setPresence('online')
      currentPresence.value = 'online'
    } else {
      await matrixPresenceService.setPresence('offline')
      currentPresence.value = 'offline'
    }
  } catch {
    showOnlineStatus.value = !value
    message.error(t('setting.security_privacy.presence_update_failed', '在线状态更新失败'))
  }
}

const handleUnblockUser = (user: BlockedUser) => {
  const index = blockedUsers.value.findIndex((u) => u.user_id === user.user_id)
  if (index > -1) {
    blockedUsers.value.splice(index, 1)
  }
  message.success(t('setting.security_privacy.unblock_success'))
}

const handleAddUser = () => {
  if (!newUserId.value.trim()) {
    message.warning(t('setting.security_privacy.enter_user_id'))
    return
  }
  message.success(t('setting.security_privacy.add_success'))
  showAddModal.value = false
  newUserId.value = ''
}
</script>

<style scoped lang="scss">
.item {
  @apply bg-[--bg-setting-item] rounded-12px size-full p-12px box-border border-(solid 1px [--line-color]) custom-shadow;
}
</style>
