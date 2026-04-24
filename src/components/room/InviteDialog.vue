<template>
  <n-modal
    v-model:show="visible"
    preset="card"
    :title="t('room.invite.title')"
    :style="{ width: '400px' }"
    :bordered="false"
    @update:show="$emit('update:visible', $event)">
    <div class="invite-dialog">
      <n-input v-model:value="searchQuery" :placeholder="t('room.invite.search_placeholder')" clearable>
        <template #prefix>
          <svg class="size-16px">
            <use href="#search"></use>
          </svg>
        </template>
      </n-input>

      <div class="user-list">
        <n-scrollbar style="max-height: 300px">
          <div
            v-for="user in filteredUsers"
            :key="user.userId"
            class="user-item"
            :class="{ selected: selectedUsers.includes(user.userId) }"
            @click="toggleUser(user.userId)">
            <n-checkbox :checked="selectedUsers.includes(user.userId)" @update:checked="toggleUser(user.userId)" />
            <n-avatar round :size="36" :src="user.avatarUrl" :fallback-src="defaultAvatar" />
            <div class="user-info">
              <span class="user-name">{{ user.displayName || user.userId }}</span>
              <span class="user-id">{{ user.userId }}</span>
            </div>
          </div>
        </n-scrollbar>
      </div>

      <div class="manual-invite">
        <n-divider>{{ t('room.invite.or_enter_id') }}</n-divider>
        <n-input
          v-model:value="manualUserId"
          :placeholder="t('room.invite.user_id_placeholder')"
          @keydown.enter="addManualUser">
          <template #suffix>
            <n-button text size="small" @click="addManualUser">
              <template #icon>
                <svg class="size-16px">
                  <use href="#add"></use>
                </svg>
              </template>
            </n-button>
          </template>
        </n-input>
      </div>
    </div>

    <template #footer>
      <div class="dialog-footer">
        <n-button @click="$emit('update:visible', false)">{{ t('common.cancel') }}</n-button>
        <n-button type="primary" :disabled="selectedUsers.length === 0" :loading="inviting" @click="handleInvite">
          {{ t('room.invite.invite') }}
          <template v-if="selectedUsers.length > 0">({{ selectedUsers.length }})</template>
        </n-button>
      </div>
    </template>
  </n-modal>
</template>

<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import { matrixRoomService, matrixSearchService } from '@/services/matrix'
import { AvatarUtils } from '@/utils/AvatarUtils'
import { createLogger } from '@/utils/Logger'
const logger = createLogger('InviteDialog')

const props = defineProps<{
  visible: boolean
  roomId: string
}>()

const emit = defineEmits<{
  (e: 'update:visible', value: boolean): void
  (e: 'invited', userIds: string[]): void
}>()

const { t } = useI18n()
const searchQuery = ref('')
const selectedUsers = ref<string[]>([])
const manualUserId = ref('')
const inviting = ref(false)
const searchResults = ref<any[]>([])
const defaultAvatar = '/logoD.png'

const filteredUsers = computed(() => {
  return searchResults.value.map((user) => ({
    userId: user.user_id || user.userId,
    displayName: user.display_name || user.displayName,
    avatarUrl: AvatarUtils.getAvatarUrl(user.avatar_url || user.avatarUrl || '')
  }))
})

const searchUsers = async (query: string) => {
  if (!query.trim()) {
    searchResults.value = []
    return
  }

  try {
    const results = await matrixSearchService.searchUsers(query)
    searchResults.value = results
  } catch (error) {
    logger.error('搜索用户失败:', error)
  }
}

const toggleUser = (userId: string) => {
  const index = selectedUsers.value.indexOf(userId)
  if (index === -1) {
    selectedUsers.value.push(userId)
  } else {
    selectedUsers.value.splice(index, 1)
  }
}

const addManualUser = () => {
  const userId = manualUserId.value.trim()
  if (userId && !selectedUsers.value.includes(userId)) {
    if (userId.startsWith('@') && userId.includes(':')) {
      selectedUsers.value.push(userId)
      manualUserId.value = ''
    } else {
      window.$message?.warning(t('room.invite.invalid_user_id'))
    }
  }
}

const handleInvite = async () => {
  if (selectedUsers.value.length === 0) return

  inviting.value = true
  try {
    for (const userId of selectedUsers.value) {
      await matrixRoomService.inviteUser(props.roomId, userId)
    }

    window.$message?.success(t('room.invite.success', { count: selectedUsers.value.length }))
    emit('invited', selectedUsers.value)
    emit('update:visible', false)
    selectedUsers.value = []
  } catch (error) {
    logger.error('邀请失败:', error)
    window.$message?.error(t('room.invite.failed'))
  } finally {
    inviting.value = false
  }
}

watch(searchQuery, (query) => {
  searchUsers(query)
})

watch(
  () => props.visible,
  (visible) => {
    if (!visible) {
      selectedUsers.value = []
      searchQuery.value = ''
      manualUserId.value = ''
      searchResults.value = []
    }
  }
)
</script>

<style scoped lang="scss">
.invite-dialog {
  @apply flex flex-col gap-12px;
}

.user-list {
  @apply flex flex-col gap-4px;
}

.user-item {
  @apply flex items-center gap-12px p-8px rounded-8px cursor-pointer transition-all;

  &:hover {
    background: var(--emoji-hover);
  }

  &.selected {
    background: var(--color-primary-light);
  }
}

.user-info {
  @apply flex flex-col gap-2px flex-1 min-w-0;
}

.user-name {
  @apply text-14px truncate;
}

.user-id {
  @apply text-12px color-[--color-text-tertiary] truncate;
}

.manual-invite {
  @apply flex flex-col gap-8px;
}

.dialog-footer {
  @apply flex justify-end gap-12px;
}
</style>
