<template>
  <n-drawer :show="visible" :width="320" placement="right" :mask-closable="true" @update:show="(val: boolean) => emit('update:visible', val)">
    <n-drawer-content :title="drawerTitle" closable>
      <div class="sidebar-content">
        <div v-if="isGroup" class="group-info-section">
          <div class="info-item">
            <span class="label">{{ t('home.chat_header.group_name') }}</span>
            <div class="value-row">
              <span v-if="!isEditingName" class="value" @click="startEditName">
                {{ groupName }}
              </span>
              <n-input
                v-else
                v-model:value="editingName"
                size="small"
                :placeholder="t('home.chat_header.input_group_name')"
                @blur="handleUpdateName"
                @keyup.enter="handleUpdateName" />
              <n-button v-if="!isEditingName && isGroupOwner" quaternary circle size="tiny" @click="startEditName">
                <template #icon>
                  <n-icon size="14">
                    <svg><use href="#edit"></use></svg>
                  </n-icon>
                </template>
              </n-button>
            </div>
          </div>

          <div class="info-item">
            <span class="label">{{ t('home.chat_header.my_name_in_group') }}</span>
            <div class="value-row">
              <n-input
                :value="localMyName"
                size="small"
                :placeholder="t('home.chat_header.input_my_name')"
                @update:value="(val: string) => emit('update:localMyName', val)"
                @blur="handleUpdateMyName"
                @keyup.enter="handleUpdateMyName" />
            </div>
          </div>

          <div class="info-item">
            <span class="label">{{ t('home.chat_header.group_members') }}</span>
            <div class="member-list">
              <n-avatar
                v-for="user in memberList"
                :key="user.uid"
                :src="user.avatar"
                :size="32"
                round
                :title="user.name" />
              <n-button v-if="isGroupOwner" quaternary circle size="small" @click="handleManageMembers">
                <template #icon>
                  <n-icon size="16">
                    <svg><use href="#add"></use></svg>
                  </n-icon>
                </template>
              </n-button>
            </div>
          </div>
        </div>

        <div v-else class="user-info-section">
          <div class="info-item">
            <span class="label">{{ t('home.chat_header.remark') }}</span>
            <div class="value-row">
              <n-input
                :value="localRemark"
                size="small"
                :placeholder="t('home.chat_header.input_remark')"
                @update:value="(val: string) => emit('update:localRemark', val)"
                @blur="handleUpdateRemark"
                @keyup.enter="handleUpdateRemark" />
            </div>
          </div>
        </div>

        <n-divider />

        <div class="settings-section">
          <div class="setting-item" @click="handlePinRoom">
            <span class="setting-label">{{ t('home.chat_header.pin_room') }}</span>
            <n-switch :value="isPinned" size="small" />
          </div>

          <div class="setting-item">
            <span class="setting-label">{{ t('home.chat_header.message_setting') }}</span>
            <n-select
              v-model:value="messageSettingValue"
              :options="messageOptions"
              size="small"
              style="width: 120px"
              @update:value="handleMuteChange" />
          </div>

          <div class="setting-item danger" @click="handleClearMessages">
            <span class="setting-label">{{ t('home.chat_header.clear_messages') }}</span>
            <n-icon size="18">
              <svg><use href="#delete"></use></svg>
            </n-icon>
          </div>
        </div>

        <n-divider />

        <div class="actions-section">
          <n-button v-if="isGroup && isGroupOwner" type="error" block @click="handleDissolve">
            {{ t('home.chat_header.dissolve_group') }}
          </n-button>
          <n-button v-else-if="isGroup" type="warning" block @click="handleExit">
            {{ t('home.chat_header.exit_group') }}
          </n-button>
          <n-button v-if="!isGroup && showDeleteFriend" type="error" block @click="handleDeleteFriend">
            {{ t('home.chat_header.delete_friend') }}
          </n-button>
          <n-button type="error" block @click="handleDeleteRoom">
            {{ t('home.chat_header.delete_room') }}
          </n-button>
        </div>
      </div>
    </n-drawer-content>
  </n-drawer>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { RoomTypeEnum, RoleEnum } from '@/enums'
import type { UserItem } from '@/services/types'

const props = defineProps<{
  visible: boolean
  isGroup: boolean
  isGroupOwner: boolean
  groupName: string
  localMyName: string
  localRemark: string
  memberList: UserItem[]
  isPinned: boolean
  showDeleteFriend: boolean
  messageOptions: Array<{ label: string; value: string }>
}>()

const emit = defineEmits<{
  (e: 'update:visible', value: boolean): void
  (e: 'update:localMyName', value: string): void
  (e: 'update:localRemark', value: string): void
  (e: 'update-name', name: string): void
  (e: 'update-my-name', name: string): void
  (e: 'update-remark', remark: string): void
  (e: 'pin-room'): void
  (e: 'mute-change', type: string): void
  (e: 'clear-messages'): void
  (e: 'manage-members'): void
  (e: 'dissolve'): void
  (e: 'exit'): void
  (e: 'delete-friend'): void
  (e: 'delete-room'): void
}>()

const { t } = useI18n()

const isEditingName = ref(false)
const editingName = ref('')
const messageSettingValue = ref('notification')

const drawerTitle = computed(() => (props.isGroup ? t('home.chat_header.group_info') : t('home.chat_header.chat_info')))

watch(
  () => props.visible,
  (val) => {
    if (val) {
      editingName.value = props.groupName
    }
  }
)

const startEditName = () => {
  isEditingName.value = true
  editingName.value = props.groupName
}

const handleUpdateName = () => {
  if (editingName.value.trim() && editingName.value !== props.groupName) {
    emit('update-name', editingName.value.trim())
  }
  isEditingName.value = false
}

const handleUpdateMyName = () => {
  emit('update-my-name', props.localMyName.trim())
}

const handleUpdateRemark = () => {
  emit('update-remark', props.localRemark.trim())
}

const handlePinRoom = () => emit('pin-room')
const handleMuteChange = (type: string) => emit('mute-change', type)
const handleClearMessages = () => emit('clear-messages')
const handleManageMembers = () => emit('manage-members')
const handleDissolve = () => emit('dissolve')
const handleExit = () => emit('exit')
const handleDeleteFriend = () => emit('delete-friend')
const handleDeleteRoom = () => emit('delete-room')
</script>

<style scoped lang="scss">
.sidebar-content {
  padding: 0 4px;
}

.info-item {
  margin-bottom: 16px;

  .label {
    display: block;
    font-size: 12px;
    color: var(--text-color-3);
    margin-bottom: 8px;
  }

  .value-row {
    display: flex;
    align-items: center;
    gap: 8px;

    .value {
      flex: 1;
      font-size: 14px;
      cursor: pointer;

      &:hover {
        color: var(--primary-color);
      }
    }
  }
}

.member-list {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.settings-section {
  .setting-item {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 12px 0;
    cursor: pointer;

    &:not(:last-child) {
      border-bottom: 1px solid var(--border-color);
    }

    &.danger {
      color: var(--error-color);
    }

    .setting-label {
      font-size: 14px;
    }
  }
}

.actions-section {
  display: flex;
  flex-direction: column;
  gap: 12px;
}
</style>
