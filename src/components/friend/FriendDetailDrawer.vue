<template>
  <n-drawer v-model:show="visible" :width="400" placement="right">
    <n-drawer-content :title="t('friend.detail.title')" closable>
      <n-spin :show="loading">
        <n-flex v-if="profileData" vertical :size="16">
          <n-flex vertical align="center" :size="12">
            <n-avatar
              :size="80"
              :src="avatarSrc"
              round
              :fallback-src="settingStore.themeContent === ThemeEnum.DARK ? '/logoL.png' : '/logoD.png'" />
            <n-flex vertical align="center" :size="4">
              <span class="text-16px font-semibold">{{ displayName }}</span>
              <span class="text-12px text-[--hula-text-tertiary]">@{{ profileData.account }}</span>
            </n-flex>
          </n-flex>

          <n-divider style="margin: 0" />

          <n-flex vertical :size="12">
            <n-flex align="center" justify="space-between">
              <span class="text-14px text-[--hula-text-secondary]">{{ t('friend.detail.status') }}</span>
              <n-tag :type="statusTagType" size="small">
                {{ statusLabel }}
              </n-tag>
            </n-flex>

            <n-flex v-if="profileData.friendStatus" align="center" justify="space-between">
              <span class="text-14px text-[--hula-text-secondary]">{{ t('friend.detail.friend_status') }}</span>
              <n-tag :type="friendStatusTagType" size="small">
                {{ friendStatusLabel }}
              </n-tag>
            </n-flex>

            <n-flex v-if="lastSeenText" align="center" justify="space-between">
              <span class="text-14px text-[--hula-text-secondary]">{{ t('friend.detail.last_seen') }}</span>
              <span class="text-12px text-[--hula-text-tertiary]">{{ lastSeenText }}</span>
            </n-flex>

            <n-flex v-if="profileData.since" align="center" justify="space-between">
              <span class="text-14px text-[--hula-text-secondary]">{{ t('friend.detail.since') }}</span>
              <span class="text-12px text-[--hula-text-tertiary]">{{ formatDate(profileData.since) }}</span>
            </n-flex>
          </n-flex>

          <n-divider style="margin: 0" />

          <n-flex vertical :size="8">
            <n-flex align="center" justify="space-between">
              <span class="text-14px text-[--hula-text-secondary]">{{ t('friend.detail.note') }}</span>
              <n-button text size="tiny" @click="showNoteEdit = !showNoteEdit">
                {{ showNoteEdit ? t('common.cancel') : t('friend.detail.note_section') }}
              </n-button>
            </n-flex>
            <span v-if="!showNoteEdit" class="text-14px">
              {{ profileData.note || t('friend.detail.note_placeholder') }}
            </span>
            <n-flex v-else vertical :size="8">
              <n-input
                v-model:value="noteValue"
                type="textarea"
                :placeholder="t('friend.detail.note_placeholder')"
                :maxlength="1000"
                :autosize="{ minRows: 2, maxRows: 4 }"
                show-count />
              <n-button type="primary" size="small" :loading="savingNote" @click="handleSaveNote">
                {{ t('common.confirm') }}
              </n-button>
            </n-flex>
          </n-flex>

          <n-flex vertical :size="8">
            <n-flex align="center" justify="space-between">
              <span class="text-14px text-[--hula-text-secondary]">{{ t('friend.detail.display_name') }}</span>
              <n-button text size="tiny" @click="showDisplayNameEdit = !showDisplayNameEdit">
                {{ showDisplayNameEdit ? t('common.cancel') : t('friend.detail.edit_display_name') }}
              </n-button>
            </n-flex>
            <span v-if="!showDisplayNameEdit" class="text-14px">
              {{ profileData.remark || profileData.displayName || profileData.name }}
            </span>
            <n-flex v-else vertical :size="8">
              <n-input
                v-model:value="displayNameValue"
                :placeholder="t('friend.detail.display_name_placeholder')"
                :maxlength="256" />
              <n-button type="primary" size="small" :loading="savingDisplayName" @click="handleSaveDisplayName">
                {{ t('common.confirm') }}
              </n-button>
            </n-flex>
          </n-flex>

          <n-divider style="margin: 0" />

          <n-flex vertical :size="8">
            <span class="text-14px text-[--hula-text-secondary]">{{ t('friend.detail.actions') }}</span>
            <n-flex :size="8">
              <n-button type="primary" block @click="handleSendMessage">
                {{ t('friend.detail.send_message') }}
              </n-button>
              <n-button block @click="handleEncryptedChat">
                {{ t('friend.detail.encrypted_chat') }}
              </n-button>
            </n-flex>
            <n-button type="error" ghost block @click="handleRemoveFriend">
              {{ t('friend.detail.remove_friend') }}
            </n-button>
          </n-flex>
        </n-flex>

        <n-empty v-else :description="t('friend.detail.notFound')" />
      </n-spin>
    </n-drawer-content>
  </n-drawer>
</template>

<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import { useActionFeedback } from '@/composables/common/useActionFeedback'
import { OnlineEnum, ThemeEnum } from '@/enums'
import { type MatrixContact, useContactStore } from '@/stores/domains/chat/contacts'
import { useSettingStore } from '@/stores/domains/settings/setting'
import { AvatarUtils } from '@/utils/AvatarUtils'

const props = defineProps<{
  show: boolean
  userId: string
}>()

const emit = defineEmits<{
  'update:show': [value: boolean]
}>()

const { t } = useI18n()
const { showFeedback } = useActionFeedback()
const contactStore = useContactStore()
const settingStore = useSettingStore()

const visible = computed({
  get: () => props.show,
  set: (value) => emit('update:show', value)
})

const loading = ref(false)
const profileData = ref<MatrixContact | null>(null)
const showNoteEdit = ref(false)
const noteValue = ref('')
const savingNote = ref(false)
const showDisplayNameEdit = ref(false)
const displayNameValue = ref('')
const savingDisplayName = ref(false)

const avatarSrc = computed(() => AvatarUtils.getAvatarUrl(profileData.value?.avatarUrl ?? ''))

const displayName = computed(() => {
  if (!profileData.value) return ''
  return profileData.value.remark || profileData.value.displayName || profileData.value.name
})

const statusTagType = computed(() => {
  if (!profileData.value) return 'default'
  return profileData.value.activeStatus === OnlineEnum.ONLINE ? 'success' : 'default'
})

const statusLabel = computed(() => {
  if (!profileData.value) return ''
  return profileData.value.activeStatus === OnlineEnum.ONLINE ? t('friend.list.online') : t('friend.list.offline')
})

const friendStatusTagType = computed(() => {
  const status = profileData.value?.friendStatus
  if (status === 'favorite') return 'warning'
  if (status === 'blocked') return 'error'
  return 'info'
})

const friendStatusLabel = computed(() => {
  const status = profileData.value?.friendStatus
  if (status === 'favorite') return t('friend.status.favorite')
  if (status === 'blocked') return t('friend.status.blocked')
  if ((status as string) === 'hidden') return t('friend.status.hidden')
  return t('friend.status.normal')
})

const lastSeenText = computed(() => {
  if (!profileData.value) return ''
  if (profileData.value.activeStatus === OnlineEnum.ONLINE) return t('friend.list.online')
  if (profileData.value.lastOptTime && profileData.value.lastOptTime > 0) {
    return formatDate(profileData.value.lastOptTime)
  }
  return ''
})

const formatDate = (ts: number): string => {
  const date = new Date(ts)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffMins = Math.floor(diffMs / 60000)
  const diffHours = Math.floor(diffMs / 3600000)
  const diffDays = Math.floor(diffMs / 86400000)

  if (diffMins < 1) return t('friend.detail.just_now')
  if (diffMins < 60) return t('friend.detail.minutes_ago', { count: diffMins })
  if (diffHours < 24) return t('friend.detail.hours_ago', { count: diffHours })
  if (diffDays < 7) return t('friend.detail.days_ago', { count: diffDays })
  return date.toLocaleDateString()
}

const loadUserInfo = async () => {
  if (!props.userId) return

  loading.value = true
  try {
    const contact = contactStore.getContactByUserId(props.userId)
    if (contact) {
      profileData.value = { ...contact }
    } else {
      const profile = await contactStore.getUserProfile(props.userId)
      profileData.value = profile
    }
    noteValue.value = profileData.value?.note ?? profileData.value?.remark ?? ''
    displayNameValue.value = profileData.value?.remark ?? profileData.value?.displayName ?? ''
  } catch {
    profileData.value = null
  } finally {
    loading.value = false
  }
}

const handleSaveNote = async () => {
  if (!props.userId || !noteValue.value.trim()) return
  savingNote.value = true
  try {
    const success = await contactStore.setFriendNote(props.userId, noteValue.value.trim())
    if (success) {
      showFeedback(t('friend.detail.note_saved'), 'success', 'polite')
      showNoteEdit.value = false
      if (profileData.value) {
        profileData.value.note = noteValue.value.trim()
        profileData.value.remark = noteValue.value.trim()
      }
    }
  } catch {
    showFeedback(t('friend.detail.note_error'), 'error', 'assertive')
  } finally {
    savingNote.value = false
  }
}

const handleSaveDisplayName = async () => {
  if (!props.userId) return
  savingDisplayName.value = true
  try {
    const success = await contactStore.setFriendDisplayName(props.userId, displayNameValue.value.trim())
    if (success) {
      showFeedback(t('friend.detail.display_name_saved'), 'success', 'polite')
      showDisplayNameEdit.value = false
      if (profileData.value) {
        profileData.value.remark = displayNameValue.value.trim()
      }
    }
  } catch {
    showFeedback(t('friend.detail.display_name_error'), 'error', 'assertive')
  } finally {
    savingDisplayName.value = false
  }
}

const handleSendMessage = async () => {
  if (!props.userId) return
  const roomId = await contactStore.startDirectRoom(props.userId, false)
  if (roomId) {
    const { openMsgSessionByRoomId } = await import('@/hooks/session/openMsgSession')
    await openMsgSessionByRoomId(roomId)
  }
  visible.value = false
}

const handleEncryptedChat = async () => {
  if (!props.userId) return
  try {
    const roomId = await contactStore.startDirectRoom(props.userId, true)
    if (roomId) {
      const { openMsgSessionByRoomId } = await import('@/hooks/session/openMsgSession')
      await openMsgSessionByRoomId(roomId)
    }
    visible.value = false
  } catch {
    showFeedback(t('friend.detail.chat_error'), 'error', 'assertive')
  }
}

const handleRemoveFriend = async () => {
  if (!props.userId) return
  window.$dialog?.warning({
    title: t('friend.detail.remove_confirm.title'),
    content: t('friend.detail.remove_confirm.content'),
    positiveText: t('common.confirm'),
    negativeText: t('common.cancel'),
    onPositiveClick: async () => {
      const success = await contactStore.removeFromContacts(props.userId)
      if (success) {
        showFeedback(t('friend.detail.remove_success'), 'success', 'polite')
        visible.value = false
      } else {
        showFeedback(t('friend.detail.remove_error'), 'error', 'assertive')
      }
    }
  })
}

watch(() => props.userId, loadUserInfo, { immediate: true })
</script>
