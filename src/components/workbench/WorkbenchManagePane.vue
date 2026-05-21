<template>
  <div class="detail-mode-view" data-test="detail-mode-manage">
    <section v-if="activeSpace" class="detail-card detail-card--manage" data-test="detail-manage-card">
      <div class="detail-card__title">{{ manageCardTitle }}</div>
      <p class="detail-card__hint">{{ activeSpace.name }}</p>

      <n-form label-placement="top" :show-feedback="false" class="detail-manage-form">
        <n-form-item v-if="manageMode === 'invite'" :label="t('space.invite')">
          <n-input
            :value="inviteUserId"
            :placeholder="t('space.invite_user_placeholder')"
            @update:value="emit('update:inviteUserId', $event)" />
        </n-form-item>

        <template v-else-if="manageMode === 'add-room'">
          <n-form-item :label="t('space.add_room')">
            <n-input
              :value="addRoomId"
              :placeholder="t('space.add_room_placeholder')"
              @update:value="emit('update:addRoomId', $event)" />
          </n-form-item>
          <n-checkbox :checked="addRoomSuggested" @update:checked="emit('update:addRoomSuggested', $event)">
            {{ t('space.add_room_suggested') }}
          </n-checkbox>
        </template>

        <template v-else-if="manageMode === 'settings'">
          <n-form-item :label="t('space.name')">
            <n-input
              :value="settingsName"
              :placeholder="t('space.name_placeholder')"
              @update:value="emit('update:settingsName', $event)" />
          </n-form-item>
          <n-form-item :label="t('space.topic')">
            <n-input
              :value="settingsTopic"
              type="textarea"
              :rows="3"
              :placeholder="t('space.topic_placeholder')"
              @update:value="emit('update:settingsTopic', $event)" />
          </n-form-item>
        </template>
      </n-form>

      <n-flex justify="flex-end" :size="12" class="detail-manage-actions">
        <n-button @click="emit('closeManagePane')">{{ t('common.cancel') }}</n-button>
        <n-button
          type="primary"
          :loading="manageSubmitting"
          :disabled="!canManageSpace"
          @click="emit('submitManagePane')">
          {{ t('common.confirm') }}
        </n-button>
      </n-flex>
    </section>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

type SpaceManageMode = 'invite' | 'add-room' | 'settings'

type SpaceListItem = {
  spaceId: string
  name: string
  topic?: string
  memberCount?: number
  childCount: number
}

const props = defineProps<{
  manageMode: SpaceManageMode | null
  canManageSpace: boolean
  manageSubmitting: boolean
  inviteUserId: string
  addRoomId: string
  addRoomSuggested: boolean
  settingsName: string
  settingsTopic: string
  activeSpace: SpaceListItem | null
}>()

const emit = defineEmits<{
  closeManagePane: []
  submitManagePane: []
  'update:inviteUserId': [value: string]
  'update:addRoomId': [value: string]
  'update:addRoomSuggested': [value: boolean]
  'update:settingsName': [value: string]
  'update:settingsTopic': [value: string]
}>()

const { t } = useI18n()

const manageCardTitle = computed(() => {
  switch (props.manageMode) {
    case 'invite':
      return t('space.invite_title')
    case 'add-room':
      return t('space.add_room_title')
    case 'settings':
      return t('space.settings_title')
    default:
      return t('space.details_title')
  }
})
</script>
