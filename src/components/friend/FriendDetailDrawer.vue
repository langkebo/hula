<template>
  <n-drawer v-model:show="visible" :width="360" placement="right" class="friend-detail-drawer">
    <n-drawer-content :title="t('friend.detail.title')" closable>
      <n-spin :show="loading">
        <n-flex vertical :size="20">
          <n-flex align="center" :size="16" class="profile-section">
            <n-avatar
              :size="80"
              :src="AvatarUtils.getAvatarUrl(friend?.avatarUrl)"
              :fallback-src="themes.content === ThemeEnum.DARK ? '/logoL.png' : '/logoD.png'"
              round />
            <n-flex vertical :size="8" class="flex-1">
              <span class="text-18px font-semibold">{{ friend?.displayName || friend?.userId }}</span>
              <span class="text-14px text-gray-500">{{ friend?.userId }}</span>
            </n-flex>
          </n-flex>

          <n-divider style="margin: 0" />

          <n-flex vertical :size="12">
            <div class="info-row">
              <span class="label">{{ t('friend.detail.status') }}</span>
              <n-tag :type="getStatusType(friend?.friendStatus)" size="small">
                {{ getStatusText(friend?.friendStatus) }}
              </n-tag>
            </div>

            <div v-if="friend?.note" class="info-row">
              <span class="label">{{ t('friend.detail.note') }}</span>
              <span class="value">{{ friend.note }}</span>
            </div>

            <div v-if="friend?.since" class="info-row">
              <span class="label">{{ t('friend.detail.since') }}</span>
              <span class="value">{{ formatDate(friend.since) }}</span>
            </div>
          </n-flex>

          <n-divider style="margin: 0" />

          <n-flex vertical :size="12">
            <span class="section-title">{{ t('friend.detail.note_section') }}</span>
            <n-input
              v-model:value="editNote"
              type="textarea"
              :placeholder="t('friend.detail.note_placeholder')"
              :maxlength="200"
              :autosize="{ minRows: 2, maxRows: 4 }" />
            <n-button type="primary" size="small" :loading="savingNote" @click="handleSaveNote">
              {{ t('common.save') }}
            </n-button>
          </n-flex>

          <n-divider style="margin: 0" />

          <n-flex vertical :size="12">
            <span class="section-title">{{ t('friend.detail.status_section') }}</span>
            <n-flex :size="8" wrap>
              <n-button
                v-for="status in statusOptions"
                :key="status.value"
                :type="friend?.friendStatus === status.value ? 'primary' : 'default'"
                size="small"
                @click="handleSetStatus(status.value)">
                {{ status.label }}
              </n-button>
            </n-flex>
          </n-flex>

          <n-divider style="margin: 0" />

          <n-flex vertical :size="12">
            <span class="section-title">{{ t('friend.detail.actions') }}</span>
            <n-flex :size="8" vertical>
              <n-button block @click="handleStartChat">
                <template #icon>
                  <n-icon>
                    <svg><use href="#message" /></svg>
                  </n-icon>
                </template>
                {{ t('friend.detail.send_message') }}
              </n-button>
              <n-button block @click="handleStartEncryptedChat">
                <template #icon>
                  <n-icon>
                    <svg><use href="#lock" /></svg>
                  </n-icon>
                </template>
                {{ t('friend.detail.encrypted_chat') }}
              </n-button>
              <n-button block type="error" ghost :loading="removing" @click="handleRemove">
                <template #icon>
                  <n-icon>
                    <svg><use href="#delete" /></svg>
                  </n-icon>
                </template>
                {{ t('friend.detail.remove_friend') }}
              </n-button>
            </n-flex>
          </n-flex>
        </n-flex>
      </n-spin>
    </n-drawer-content>
  </n-drawer>
</template>

<script setup lang="ts">
import { storeToRefs } from 'pinia'
import { useI18n } from 'vue-i18n'
import { ThemeEnum } from '@/enums'
import { useContactStore, type MatrixContact } from '@/stores/contacts'
import { useSettingStore } from '@/stores/setting'
import { AvatarUtils } from '@/utils/AvatarUtils'
import { MittEnum } from '@/enums'
import { useMitt } from '@/hooks/useMitt'
import type { FriendStatus } from '@/services/matrix/MatrixFriendService'
import dayjs from 'dayjs'

const { t } = useI18n()
const contactStore = useContactStore()
const settingStore = useSettingStore()
const { themes } = storeToRefs(settingStore)

const visible = defineModel<boolean>('show', { default: false })
const userId = defineModel<string>('userId', { default: '' })

const friend = ref<MatrixContact | null>(null)
const loading = ref(false)
const savingNote = ref(false)
const removing = ref(false)
const editNote = ref('')

const statusOptions = computed(() => [
  { value: 'normal' as FriendStatus, label: t('friend.status.normal') },
  { value: 'favorite' as FriendStatus, label: t('friend.status.favorite') },
  { value: 'blocked' as FriendStatus, label: t('friend.status.blocked') },
  { value: 'hidden' as FriendStatus, label: t('friend.status.hidden') }
])

const getStatusType = (status?: FriendStatus) => {
  const types: Record<FriendStatus, 'default' | 'success' | 'warning' | 'error' | 'info'> = {
    normal: 'default',
    favorite: 'success',
    blocked: 'error',
    hidden: 'warning'
  }
  return types[status || 'normal']
}

const getStatusText = (status?: FriendStatus) => {
  const option = statusOptions.value.find((s) => s.value === status)
  return option?.label || t('friend.status.normal')
}

const formatDate = (timestamp: number) => {
  return dayjs(timestamp).format('YYYY-MM-DD')
}

const loadFriendInfo = async () => {
  if (!userId.value) return

  loading.value = true
  try {
    friend.value = contactStore.getContactByUserId(userId.value) || null
    if (friend.value) {
      editNote.value = friend.value.note || friend.value.remark || ''
    }
  } finally {
    loading.value = false
  }
}

const handleSaveNote = async () => {
  if (!userId.value) return

  savingNote.value = true
  try {
    await contactStore.setFriendNote(userId.value, editNote.value)
    window.$message.success(t('friend.detail.note_saved'))
  } catch (err) {
    window.$message.error(t('friend.detail.note_error'))
  } finally {
    savingNote.value = false
  }
}

const handleSetStatus = async (status: FriendStatus) => {
  if (!userId.value) return

  try {
    await contactStore.setFriendStatus(userId.value, status)
    window.$message.success(t('friend.detail.status_saved'))
  } catch (err) {
    window.$message.error(t('friend.detail.status_error'))
  }
}

const handleStartChat = async () => {
  if (!userId.value) return

  try {
    const roomId = await contactStore.startDirectRoom(userId.value, false)
    if (roomId) {
      useMitt.emit(MittEnum.DETAILS_SHOW, {
        context: { type: 1, uid: userId.value },
        detailsShow: true
      })
      visible.value = false
    }
  } catch (err) {
    window.$message.error(t('friend.detail.chat_error'))
  }
}

const handleStartEncryptedChat = async () => {
  if (!userId.value) return

  try {
    const roomId = await contactStore.startDirectRoom(userId.value, true)
    if (roomId) {
      useMitt.emit(MittEnum.DETAILS_SHOW, {
        context: { type: 1, uid: userId.value },
        detailsShow: true
      })
      visible.value = false
    }
  } catch (err) {
    window.$message.error(t('friend.detail.chat_error'))
  }
}

const handleRemove = async () => {
  if (!userId.value) return

  const confirmed = await window.$dialog.warning({
    title: t('friend.detail.remove_confirm.title'),
    content: t('friend.detail.remove_confirm.content'),
    positiveText: t('common.confirm'),
    negativeText: t('common.cancel')
  })

  if (confirmed) {
    removing.value = true
    try {
      await contactStore.removeFromContacts(userId.value)
      window.$message.success(t('friend.detail.remove_success'))
      visible.value = false
    } catch (err) {
      window.$message.error(t('friend.detail.remove_error'))
    } finally {
      removing.value = false
    }
  }
}

watch([visible, userId], () => {
  if (visible.value && userId.value) {
    loadFriendInfo()
  }
})
</script>

<style scoped lang="scss">
.friend-detail-drawer {
  :deep(.n-drawer-body-content) {
    padding: 20px;
  }
}

.profile-section {
  padding: 12px 0;
}

.info-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 8px 0;

  .label {
    color: var(--text-color-2);
    font-size: 14px;
  }

  .value {
    color: var(--text-color);
    font-size: 14px;
  }
}

.section-title {
  font-size: 14px;
  font-weight: 500;
  color: var(--text-color);
}
</style>
