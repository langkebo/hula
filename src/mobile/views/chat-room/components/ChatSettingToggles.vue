<template>
  <div class="bg-[--tjg-surface-panel] rounded-10px">
    <div class="p-15px text-14px font-medium">
      {{ t('mobile_chat_setting.setting_type', { t: title }) }}
    </div>
    <div class="flex justify-between items-center px-15px pb-12px">
      <div class="text-14px">{{ t('mobile_chat_setting.pintop') }}</div>
      <van-switch :model-value="!!activeItem?.top" @update:model-value="handleTop" size="20px" />
    </div>
    <div class="mx-15px border-b border-[--tjg-border-default]"></div>
    <div class="flex justify-between p-15px items-center">
      <div class="text-14px">{{ t('mobile_chat_setting.silent') }}</div>
      <van-switch
        :model-value="activeItem?.muteNotification === NotificationTypeEnum.NOT_DISTURB"
        @update:model-value="handleNotification"
        size="20px" />
    </div>
    <div v-if="canUpgrade" class="mx-15px border-b border-[--tjg-border-default]"></div>
    <div
      v-if="canUpgrade"
      v-clickable="t('room_advanced.room_upgrade.title')"
      class="flex justify-between p-15px items-center cursor-pointer"
      @click="emit('upgrade')">
      <div class="text-14px">{{ t('room_advanced.room_upgrade.title') }}</div>
      <div class="text-12px text-[--tjg-text-secondary] flex items-center gap-10px">
        <span>{{ currentVersion || '—' }}</span>
        <svg class="w-14px h-14px iconpark-icon"><use href="#right"></use></svg>
      </div>
    </div>
    <div v-if="canManage" class="mx-15px border-b border-[--tjg-border-default]"></div>
    <div
      v-if="canManage"
      v-clickable="t('room_advanced.allowlist.title')"
      class="flex justify-between p-15px items-center cursor-pointer"
      @click="emit('manage', 'allowlist')">
      <div class="text-14px">{{ t('room_advanced.allowlist.title') }}</div>
      <div class="text-12px text-[--tjg-text-secondary] flex items-center gap-10px">
        <span>{{ allowlistCount }}</span>
        <svg class="w-14px h-14px iconpark-icon"><use href="#right"></use></svg>
      </div>
    </div>
    <div v-if="canManage" class="mx-15px border-b border-[--tjg-border-default]"></div>
    <div
      v-if="canManage"
      v-clickable="t('room_advanced.denylist.title')"
      class="flex justify-between p-15px items-center cursor-pointer"
      @click="emit('manage', 'denylist')">
      <div class="text-14px">{{ t('room_advanced.denylist.title') }}</div>
      <div class="text-12px text-[--tjg-text-secondary] flex items-center gap-10px">
        <span>{{ denylistCount }}</span>
        <svg class="w-14px h-14px iconpark-icon"><use href="#right"></use></svg>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import { useActionFeedback } from '@/composables/common/useActionFeedback'
import { NotificationTypeEnum, RoomTypeEnum } from '@/enums'
import { matrixSessionService } from '@/services/matrix/auth/MatrixSessionService'
import { matrixRoomNotificationService } from '@/services/matrix/notifications/MatrixRoomNotificationService'
import { useChatStore } from '@/stores/domains/chat/chat'
import { useGlobalStore } from '@/stores/domains/widget/global'

defineOptions({
  name: 'ChatSettingToggles'
})

defineProps<{
  canUpgrade: boolean
  currentVersion: string | null
  canManage: boolean
  allowlistCount: number
  denylistCount: number
}>()

const emit = defineEmits<{
  upgrade: []
  manage: [tab: 'allowlist' | 'denylist']
}>()

const { t } = useI18n()
const { showFeedback } = useActionFeedback()

const chatStore = useChatStore()
const globalStore = useGlobalStore()
const { currentSessionRoomId } = storeToRefs(globalStore)
const { currentSession: activeItem } = storeToRefs(globalStore)

const isGroup = computed(() => globalStore.currentSession?.type === RoomTypeEnum.GROUP)
const title = computed(() =>
  isGroup.value ? t('mobile_chat_setting.type.group') : t('mobile_chat_setting.type.single_chat')
)

const handleTop = (value: boolean) => {
  const session = activeItem.value
  if (!session) return
  matrixSessionService
    .setSessionTop(currentSessionRoomId.value, value)
    .then(() => {
      chatStore.updateSession(currentSessionRoomId.value, { top: value })
      showFeedback(
        value ? t('mobile_chat_setting.pinned_success') : t('mobile_chat_setting.unpinned_success'),
        'success'
      )
    })
    .catch(() => {
      showFeedback(t('mobile_chat_setting.pin_failed'), 'error')
    })
}

const handleShield = (value: boolean) => {
  const session = activeItem.value
  if (!session) return
  matrixRoomNotificationService
    .setRoomShield(currentSessionRoomId.value, value)
    .then(() => {
      chatStore.updateSession(currentSessionRoomId.value, {
        shield: value
      })

      const tempRoomId = globalStore.currentSessionRoomId

      nextTick(() => {
        globalStore.updateCurrentSessionRoomId(tempRoomId)
      })

      showFeedback(
        value ? t('mobile_chat_setting.messages_muted') : t('mobile_chat_setting.messages_unmuted'),
        'success'
      )
    })
    .catch(() => {
      showFeedback(t('mobile_chat_setting.setting_failed'), 'error')
    })
}

const handleNotification = (value: boolean) => {
  const session = activeItem.value
  if (!session) return
  const newType = value ? NotificationTypeEnum.NOT_DISTURB : NotificationTypeEnum.RECEPTION
  if (session.shield) {
    handleShield(false)
  }
  matrixRoomNotificationService
    .setRoomNotification(currentSessionRoomId.value, newType)
    .then(() => {
      chatStore.updateSession(currentSessionRoomId.value, {
        muteNotification: newType
      })

      if (session.muteNotification === NotificationTypeEnum.NOT_DISTURB && newType === NotificationTypeEnum.RECEPTION) {
        chatStore.updateTotalUnreadCount()
      }

      if (newType === NotificationTypeEnum.NOT_DISTURB) {
        chatStore.updateTotalUnreadCount()
      }

      showFeedback(
        value ? t('mobile_chat_setting.notifications_silent') : t('mobile_chat_setting.notifications_enabled'),
        'success'
      )
    })
    .catch(() => {
      showFeedback(t('mobile_chat_setting.setting_failed'), 'error')
    })
}
</script>
